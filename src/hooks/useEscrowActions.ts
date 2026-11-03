import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { escrowAbi } from '@/escrow/abi'
import { addActivity, setActivityStatus } from '@/escrow/activity'
import { parseTxError } from '@/escrow/format'
import { ESCROW_ADDRESS, ESCROW_CHAIN_ID, USDC_ADDRESS } from '@/escrow/target'

export interface NewDeal {
  payee: `0x${string}`
  amount: bigint
  deadline: bigint
  title: string
}

export function useEscrowActions() {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: ESCROW_CHAIN_ID })
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [step, setStep] = useState<string | null>(null)

  const track = useCallback(
    async (hash: `0x${string}`, label: string, dealId?: bigint) => {
      if (!address || !publicClient) throw new Error('Wallet not ready')
      addActivity({
        hash,
        label,
        chainId: ESCROW_CHAIN_ID,
        account: address,
        at: Date.now(),
        status: 'pending',
        dealId: dealId?.toString(),
        contract: ESCROW_ADDRESS,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      setActivityStatus(hash, receipt.status === 'success' ? 'success' : 'failed')
      if (receipt.status !== 'success') throw new Error('Transaction reverted onchain.')
    },
    [address, publicClient],
  )

  const guarded = useCallback(
    async (key: string, run: () => Promise<void>, success: string): Promise<boolean> => {
      if (!ESCROW_ADDRESS || !address || !publicClient) return false
      setBusy(key)
      try {
        if (chainId !== ESCROW_CHAIN_ID) await switchChainAsync({ chainId: ESCROW_CHAIN_ID })
        await run()
        toast.success(success)
        await queryClient.invalidateQueries()
        return true
      } catch (error) {
        const message = parseTxError(error)
        if (message) toast.error(message)
        return false
      } finally {
        setBusy(null)
        setStep(null)
      }
    },
    [address, chainId, publicClient, queryClient, switchChainAsync],
  )

  const createDeal = useCallback(
    (deal: NewDeal) =>
      guarded(
        'create',
        async () => {
          if (!ESCROW_ADDRESS || !address || !publicClient) return
          const allowance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, ESCROW_ADDRESS],
          })
          if (allowance < deal.amount) {
            setStep('Approve USDC in your wallet')
            const approveHash = await writeContractAsync({
              address: USDC_ADDRESS,
              abi: erc20Abi,
              functionName: 'approve',
              args: [ESCROW_ADDRESS, deal.amount],
              chainId: ESCROW_CHAIN_ID,
            })
            setStep('Waiting for approval to confirm')
            await track(approveHash, 'Approve USDC')
          }
          setStep('Confirm the deposit in your wallet')
          const hash = await writeContractAsync({
            address: ESCROW_ADDRESS,
            abi: escrowAbi,
            functionName: 'createDeal',
            args: [deal.payee, deal.amount, deal.deadline, deal.title],
            chainId: ESCROW_CHAIN_ID,
          })
          setStep('Waiting for the deal to confirm')
          await track(hash, `Create deal: ${deal.title}`)
        },
        'Deal created and funded',
      ),
    [address, guarded, publicClient, track, writeContractAsync],
  )

  const settle = useCallback(
    (fn: 'release' | 'refund' | 'cancel', dealId: bigint) => {
      const labels = { release: 'Release', refund: 'Refund', cancel: 'Cancel' } as const
      const done = { release: 'Funds released to the payee', refund: 'Deposit refunded', cancel: 'Deal cancelled' } as const
      return guarded(
        `${fn}-${dealId}`,
        async () => {
          if (!ESCROW_ADDRESS) return
          const hash = await writeContractAsync({
            address: ESCROW_ADDRESS,
            abi: escrowAbi,
            functionName: fn,
            args: [dealId],
            chainId: ESCROW_CHAIN_ID,
          })
          await track(hash, `${labels[fn]} deal #${dealId}`, dealId)
        },
        done[fn],
      )
    },
    [guarded, track, writeContractAsync],
  )

  return { busy, step, createDeal, settle }
}
