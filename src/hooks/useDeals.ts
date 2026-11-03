import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReadContract, useReadContracts, usePublicClient } from 'wagmi'
import { escrowAbi, type Deal, type DealStatus } from '@/escrow/abi'
import { DEPLOY_BLOCK, ESCROW_ADDRESS, ESCROW_CHAIN_ID } from '@/escrow/target'

const REFRESH_MS = 8000

interface RawDeal {
  payer: `0x${string}`
  payee: `0x${string}`
  amount: bigint
  deadline: bigint
  title: string
  status: number
}

function toDeal(id: bigint, raw: RawDeal): Deal {
  return { id, ...raw, status: raw.status as DealStatus }
}

export function useNowSec(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function useDeal(id: bigint | undefined) {
  const query = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'getDeal',
    args: id === undefined ? undefined : [id],
    chainId: ESCROW_CHAIN_ID,
    query: { enabled: ESCROW_ADDRESS !== undefined && id !== undefined, refetchInterval: REFRESH_MS, retry: 1 },
  })
  const deal = useMemo(
    () => (query.data && id !== undefined ? toDeal(id, query.data) : undefined),
    [query.data, id],
  )
  return { deal, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}

export function useMyDeals(account: `0x${string}` | undefined) {
  const enabled = ESCROW_ADDRESS !== undefined && account !== undefined
  const payerIds = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'getDealIdsByPayer',
    args: account ? [account] : undefined,
    chainId: ESCROW_CHAIN_ID,
    query: { enabled, refetchInterval: REFRESH_MS },
  })
  const payeeIds = useReadContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: 'getDealIdsByPayee',
    args: account ? [account] : undefined,
    chainId: ESCROW_CHAIN_ID,
    query: { enabled, refetchInterval: REFRESH_MS },
  })

  const ids = useMemo(() => {
    const all = new Map<string, bigint>()
    for (const id of [...(payerIds.data ?? []), ...(payeeIds.data ?? [])]) all.set(id.toString(), id)
    return [...all.values()]
  }, [payerIds.data, payeeIds.data])

  const details = useReadContracts({
    contracts: ids.map((id) => ({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: 'getDeal' as const,
      args: [id] as const,
      chainId: ESCROW_CHAIN_ID,
    })),
    query: { enabled: enabled && ids.length > 0, refetchInterval: REFRESH_MS },
  })

  const { asPayer, asPayee } = useMemo(() => {
    const payer: Deal[] = []
    const payee: Deal[] = []
    details.data?.forEach((res, i) => {
      if (res.status !== 'success' || !account) return
      const deal = toDeal(ids[i], res.result as RawDeal)
      if (deal.payer.toLowerCase() === account.toLowerCase()) payer.push(deal)
      if (deal.payee.toLowerCase() === account.toLowerCase()) payee.push(deal)
    })
    const newest = (a: Deal, b: Deal) => (a.id < b.id ? 1 : -1)
    return { asPayer: payer.sort(newest), asPayee: payee.sort(newest) }
  }, [details.data, ids, account])

  return {
    asPayer,
    asPayee,
    isLoading: enabled && (payerIds.isLoading || payeeIds.isLoading || (ids.length > 0 && details.isLoading)),
    isError: payerIds.isError || payeeIds.isError,
  }
}

export interface DealTx {
  label: string
  hash: `0x${string}`
  blockNumber: bigint
}

export function useDealTxs(id: bigint | undefined) {
  const client = usePublicClient({ chainId: ESCROW_CHAIN_ID })
  return useQuery({
    queryKey: ['deal-txs', id?.toString(), ESCROW_ADDRESS, DEPLOY_BLOCK?.toString()],
    enabled: client !== undefined && id !== undefined && ESCROW_ADDRESS !== undefined && DEPLOY_BLOCK !== undefined,
    refetchInterval: 15000,
    retry: 1,
    queryFn: async (): Promise<DealTx[]> => {
      if (!client || id === undefined || !ESCROW_ADDRESS || DEPLOY_BLOCK === undefined) return []
      const base = { address: ESCROW_ADDRESS, abi: escrowAbi, fromBlock: DEPLOY_BLOCK, toBlock: 'latest' as const }
      const [created, released, refunded, cancelled] = await Promise.all([
        client.getContractEvents({ ...base, eventName: 'DealCreated', args: { dealId: id } }),
        client.getContractEvents({ ...base, eventName: 'DealReleased', args: { dealId: id } }),
        client.getContractEvents({ ...base, eventName: 'DealRefunded', args: { dealId: id } }),
        client.getContractEvents({ ...base, eventName: 'DealCancelled', args: { dealId: id } }),
      ])
      const tag = (label: string, logs: { transactionHash: `0x${string}`; blockNumber: bigint }[]) =>
        logs.map((l) => ({ label, hash: l.transactionHash, blockNumber: l.blockNumber }))
      return [
        ...tag('Deal created and funded', created),
        ...tag('Released to payee', released),
        ...tag('Refunded to payer', refunded),
        ...tag('Cancelled by payee', cancelled),
      ].sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1))
    },
  })
}
