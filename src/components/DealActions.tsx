import { Button } from './ui'
import { STATUS, type Deal } from '@/escrow/abi'
import { useEscrowActions } from '@/hooks/useEscrowActions'
import { timeLeft } from '@/escrow/format'

interface Props {
  deal: Deal
  account: `0x${string}` | undefined
  nowSec: number
}

export function DealActions({ deal, account, nowSec }: Props) {
  const { busy, settle } = useEscrowActions()
  if (deal.status !== STATUS.Active || !account) return null

  const isPayer = account.toLowerCase() === deal.payer.toLowerCase()
  const isPayee = account.toLowerCase() === deal.payee.toLowerCase()
  if (!isPayer && !isPayee) return null

  const refundable = nowSec > Number(deal.deadline)
  const anyBusy = busy !== null

  if (isPayee) {
    return (
      <div className="space-y-2">
        <Button block variant="danger" loading={busy === `cancel-${deal.id}`} disabled={anyBusy} onClick={() => void settle('cancel', deal.id)}>
          Cancel and return USDC to payer
        </Button>
        <p className="text-xs text-white/50">Only you, as payee, can cancel. The payer gets the full deposit back.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="gold" loading={busy === `release-${deal.id}`} disabled={anyBusy} onClick={() => void settle('release', deal.id)}>
          Release
        </Button>
        <Button variant="ghost" loading={busy === `refund-${deal.id}`} disabled={anyBusy || !refundable} onClick={() => void settle('refund', deal.id)}>
          Refund
        </Button>
      </div>
      <p className="text-xs text-white/50">
        {refundable
          ? 'The deadline has passed. You can refund or still release.'
          : `Refund unlocks after the deadline (${timeLeft(deal.deadline, nowSec)}).`}
      </p>
    </div>
  )
}
