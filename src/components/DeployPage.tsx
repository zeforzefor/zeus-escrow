import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Rocket } from 'lucide-react'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { getAddress } from 'viem'
import { useAccount, useDeployContract, usePublicClient, useSwitchChain } from 'wagmi'
import { AddressLink, Button, Card, TxLink } from './ui'
import { escrowAbi } from '@/escrow/abi'
import { addActivity, setActivityStatus } from '@/escrow/activity'
import { ZEUS_ESCROW_BYTECODE } from '@/escrow/bytecode'
import { parseTxError } from '@/escrow/format'
import {
  ADDRESS_FROM_ENV,
  CHAIN_FACTS,
  ESCROW_ADDRESS,
  ESCROW_CHAIN_ID,
  IS_MAINNET,
  USDC_ADDRESS,
  saveDeployment,
} from '@/escrow/target'
import { buildAddressExplorerUrl } from '@/onchain-facts'

interface Deployed {
  address: `0x${string}`
  hash: `0x${string}`
  block: bigint
  usdcOk: boolean
}

type Phase = 'idle' | 'wallet' | 'confirming'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/50">{label}</span>
      <span className="text-right text-sm text-white">{children}</span>
    </div>
  )
}

export function DeployPage({ onBack }: { onBack: () => void }) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { deployContractAsync } = useDeployContract()
  const publicClient = usePublicClient({ chainId: ESCROW_CHAIN_ID })
  const [phase, setPhase] = useState<Phase>('idle')
  const [deployed, setDeployed] = useState<Deployed>()
  const [copied, setCopied] = useState(false)

  const deploy = async () => {
    if (!address || !publicClient) return
    try {
      setPhase('wallet')
      if (chainId !== ESCROW_CHAIN_ID) await switchChainAsync({ chainId: ESCROW_CHAIN_ID })
      const hash = await deployContractAsync({
        abi: escrowAbi,
        bytecode: ZEUS_ESCROW_BYTECODE,
        args: [USDC_ADDRESS],
        chainId: ESCROW_CHAIN_ID,
      })
      addActivity({
        hash,
        label: 'Deploy ZeusEscrow',
        chainId: ESCROW_CHAIN_ID,
        account: address,
        at: Date.now(),
        status: 'pending',
      })
      setPhase('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success' || !receipt.contractAddress) {
        setActivityStatus(hash, 'failed')
        throw new Error('Deployment transaction reverted.')
      }
      setActivityStatus(hash, 'success')
      const contractAddress = getAddress(receipt.contractAddress)
      let usdcOk = false
      try {
        const onchainUsdc = await publicClient.readContract({ address: contractAddress, abi: escrowAbi, functionName: 'usdc' })
        usdcOk = onchainUsdc.toLowerCase() === USDC_ADDRESS.toLowerCase()
      } catch {
        usdcOk = false
      }
      setDeployed({ address: contractAddress, hash, block: receipt.blockNumber, usdcOk })
      toast.success('ZeusEscrow deployed')
    } catch (error) {
      const message = parseTxError(error)
      if (message) toast.error(message)
    } finally {
      setPhase('idle')
    }
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }

  const useThisContract = () => {
    if (!deployed) return
    saveDeployment(deployed.address, deployed.block)
    window.location.assign('/')
  }

  const busy = phase !== 'idle'

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="-ml-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white">
        <ArrowLeft className="size-4" /> Back
      </button>

      {IS_MAINNET && (
        <div className="rounded-3xl border border-gold/40 bg-gold/10 p-4 text-sm text-white/85">
          You are about to deploy to Arc mainnet. The deployment is permanent and the gas is paid in real USDC from your wallet.
        </div>
      )}

      <Card className="space-y-5">
        <div>
          <h1 className="display text-2xl font-bold">Deploy Zeus Escrow</h1>
          <p className="mt-1 text-sm text-white/70">
            Deploys a new escrow contract from your connected wallet. Your wallet signs one transaction. There is no owner and no admin key, so
            nobody can change or pause the contract afterwards.
          </p>
        </div>

        <div className="divide-y divide-white/10 rounded-2xl bg-white/[0.04] px-4">
          <Row label="Network">
            {CHAIN_FACTS.name}{IS_MAINNET ? ' mainnet' : ''} ({ESCROW_CHAIN_ID})
          </Row>
          <Row label="USDC (constructor)">
            <AddressLink address={USDC_ADDRESS} />
          </Row>
          <Row label="Deployer">{address ? <AddressLink address={address} /> : <span className="text-white/50">Not connected</span>}</Row>
        </div>

        {!isConnected ? (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <Button block onClick={show}>
                Connect wallet
              </Button>
            )}
          </ConnectKitButton.Custom>
        ) : (
          <Button block variant="gold" loading={busy} onClick={() => void deploy()}>
            <Rocket className="size-4" />
            {phase === 'wallet'
              ? 'Confirm in your wallet…'
              : phase === 'confirming'
                ? 'Waiting for confirmation…'
                : chainId !== ESCROW_CHAIN_ID
                  ? `Switch to ${CHAIN_FACTS.name} and deploy`
                  : 'Deploy ZeusEscrow'}
          </Button>
        )}
        {!IS_MAINNET && (
          <p className="text-xs text-white/50">
            Gas on Arc is paid in USDC. If your wallet is empty, use the Get test USDC button in the Arc Studio sidebar.
          </p>
        )}
      </Card>

      {deployed && (
        <Card className="space-y-4 border-[#6fe0a0]/30">
          <div className="flex items-center gap-2 text-[#6fe0a0]">
            <CheckCircle2 className="size-5" />
            <h2 className="display text-lg font-bold">Deployed</h2>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">Contract address</p>
            <div className="mono break-all rounded-2xl bg-white/[0.06] px-3.5 py-3 text-xs text-white">{deployed.address}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => void copy(deployed.address)}>
              <Copy className="size-4" /> {copied ? 'Copied' : 'Copy address'}
            </Button>
            <a
              href={buildAddressExplorerUrl(ESCROW_CHAIN_ID, deployed.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm font-semibold text-white hover:bg-white/[0.12]"
            >
              Explorer <ExternalLink className="size-4" />
            </a>
          </div>

          <div className="divide-y divide-white/10 rounded-2xl bg-white/[0.04] px-4">
            <Row label="Deploy transaction">
              <TxLink hash={deployed.hash} label="View on Arc explorer" />
            </Row>
            <Row label="Block">
              <span className="tabular-nums">{deployed.block.toString()}</span>
            </Row>
            <Row label="USDC check">
              {deployed.usdcOk ? (
                <span className="text-[#6fe0a0]">Matches</span>
              ) : (
                <span className="text-[#ff9aa6]">Could not confirm</span>
              )}
            </Row>
          </div>

          <Button block onClick={useThisContract}>
            Use this contract in the app
          </Button>
          <p className="text-xs text-white/55">
            This saves the address in this browser. To make it permanent, add{' '}
            <span className="mono break-all">VITE_ZEUS_ESCROW_ADDRESS={deployed.address}</span> and{' '}
            <span className="mono">VITE_ZEUS_ESCROW_DEPLOY_BLOCK={deployed.block.toString()}</span> to <span className="mono">.env</span> and restart the
            dev server.
          </p>
        </Card>
      )}

      {ESCROW_ADDRESS && !deployed && (
        <Card className="space-y-2">
          <h2 className="display text-base font-bold">Currently in use</h2>
          <div className="flex items-center justify-between gap-3 text-sm text-white/70">
            <AddressLink address={ESCROW_ADDRESS} />
            <span className="text-xs">{ADDRESS_FROM_ENV ? 'Set in .env' : 'Saved in this browser'}</span>
          </div>
          <p className="text-xs text-white/50">Deploying again creates a separate escrow with its own deals.</p>
        </Card>
      )}
    </div>
  )
}
