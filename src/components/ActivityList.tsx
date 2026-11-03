import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Card, TxLink } from './ui'
import { useActivity } from '@/escrow/activity'
import { ESCROW_CHAIN_ID } from '@/escrow/target'

const ICONS = {
  pending: <Clock className="size-4 text-gold" />,
  success: <CheckCircle2 className="size-4 text-[#6fe0a0]" />,
  failed: <XCircle className="size-4 text-[#ff9aa6]" />,
} as const

export function ActivityList() {
  const { address } = useAccount()
  const all = useActivity()
  const mine = all.filter(
    (a) => a.chainId === ESCROW_CHAIN_ID && address !== undefined && a.account.toLowerCase() === address.toLowerCase(),
  )

  if (!address) {
    return <Card className="text-center text-sm text-white/70">Connect your wallet to see your transactions.</Card>
  }
  if (mine.length === 0) {
    return (
      <Card className="text-center text-sm text-white/70">
        No transactions yet. Every approval, deposit, release, refund and cancel you send is listed here with an explorer link.
      </Card>
    )
  }
  return (
    <Card className="!p-2">
      <ul className="divide-y divide-white/10">
        {mine.map((a) => (
          <li key={a.hash} className="flex items-center gap-3 px-3 py-3.5">
            {ICONS[a.status]}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{a.label}</p>
              <p className="text-xs text-white/50">{new Date(a.at).toLocaleString()}</p>
            </div>
            <TxLink hash={a.hash} label="Explorer" />
          </li>
        ))}
      </ul>
    </Card>
  )
}
