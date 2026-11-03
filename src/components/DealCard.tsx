import { ChevronRight } from 'lucide-react'
import { AddressLink, Card, Money, StatusBadge } from './ui'
import { DealActions } from './DealActions'
import type { Deal } from '@/escrow/abi'
import { STATUS } from '@/escrow/abi'
import { displayState, formatAmountUsdc, formatDeadline, timeLeft } from '@/escrow/format'

interface Props {
  deal: Deal
  account: `0x${string}` | undefined
  nowSec: number
  role: 'payer' | 'payee'
  onOpen: (id: bigint) => void
}

export function DealCard({ deal, account, nowSec, role, onOpen }: Props) {
  const state = displayState(deal, nowSec)
  const counterparty = role === 'payer' ? deal.payee : deal.payer
  return (
    <Card className="space-y-4 !p-4">
      <button type="button" onClick={() => onOpen(deal.id)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">Deal #{deal.id.toString()}</p>
            <h3 className="mt-0.5 truncate text-base font-semibold text-white">{deal.title}</h3>
          </div>
          <StatusBadge state={state} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <Money value={formatAmountUsdc(deal.amount)} />
          <span className="flex items-center gap-0.5 text-xs font-semibold text-[#9bb8ff]">
            Details <ChevronRight className="size-3.5" />
          </span>
        </div>
      </button>

      <div className="flex items-center justify-between gap-3 text-xs text-white/60">
        <span className="flex items-center gap-1.5">
          {role === 'payer' ? 'Payee' : 'Payer'} <AddressLink address={counterparty} />
        </span>
        <span className="text-right">
          {deal.status === STATUS.Active ? timeLeft(deal.deadline, nowSec) : formatDeadline(deal.deadline)}
        </span>
      </div>

      <DealActions deal={deal} account={account} nowSec={nowSec} />
    </Card>
  )
}
