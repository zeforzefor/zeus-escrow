import { AlertTriangle, Link2Off } from 'lucide-react'
import { useAccount, useSwitchChain } from 'wagmi'
import { Button } from './ui'
import { CHAIN_FACTS, ESCROW_ADDRESS, ESCROW_CHAIN_ID, IS_MAINNET } from '@/escrow/target'

export function SetupNotice({ onDeploy }: { onDeploy: () => void }) {
  if (ESCROW_ADDRESS) return null
  return (
    <div className="flex gap-3 rounded-3xl border border-gold/40 bg-gold/10 p-4">
      <Link2Off className="mt-0.5 size-5 shrink-0 text-gold" />
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-gold">Escrow contract not connected</p>
        <p className="text-white/75">Deploy the escrow to {CHAIN_FACTS.name} from your connected wallet. It takes one transaction.</p>
        <Button variant="gold" onClick={onDeploy}>
          Deploy Zeus Escrow
        </Button>
      </div>
    </div>
  )
}

export function MainnetNotice() {
  if (!IS_MAINNET) return null
  return (
    <div className="flex gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" />
      <p className="text-sm text-white/75">
        This app moves real USDC on Arc mainnet. Transactions are final. Check the payee address before you deposit.
      </p>
    </div>
  )
}

export function WrongNetwork() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  if (!isConnected || chainId === ESCROW_CHAIN_ID) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border border-electric/50 bg-electric/15 p-4">
      <p className="text-sm text-white/85">Your wallet is on another network.</p>
      <Button loading={isPending} onClick={() => switchChain({ chainId: ESCROW_CHAIN_ID })}>
        Switch to {CHAIN_FACTS.name}
      </Button>
    </div>
  )
}
