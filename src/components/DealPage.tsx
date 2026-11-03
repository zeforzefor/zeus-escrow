import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, Loader2, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AddressLink, Button, Card, Money, StatusBadge, TxLink } from './ui'
import { DealActions } from './DealActions'
import { useDeal, useDealTxs, useNowSec } from '@/hooks/useDeals'
import { useActivity } from '@/escrow/activity'
import { displayState, formatAmountUsdc, formatDeadline, timeLeft } from '@/escrow/format'
import { STATUS } from '@/escrow/abi'
import { DEPLOY_BLOCK, ESCROW_ADDRESS, ESCROW_CHAIN_ID } from '@/escrow/target'
import { buildShareLink } from '@/lib/share'

function useShareLink(id: bigint): string | undefined {
  const [link, setLink] = useState<string>()
  useEffect(() => {
    let cancelled = false
    void buildShareLink(`/deal/${id}`).then((url) => {
      if (!cancelled) setLink(url)
    })
    return () => {
      cancelled = true
    }
  }, [id])
  return link
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/50">{label}</span>
      <span className="text-right text-sm text-white">{children}</span>
    </div>
  )
}

export function DealPage({ id, onBack }: { id: bigint; onBack: () => void }) {
  const { address } = useAccount()
  const nowSec = useNowSec()
  const { deal, isLoading, isError } = useDeal(id)
  const chainTxs = useDealTxs(id)
  const activity = useActivity()
  const link = useShareLink(id)
  const [copied, setCopied] = useState(false)

  const txs = useMemo(() => {
    const onchain = chainTxs.data ?? []
    const known = new Set(onchain.map((t) => t.hash.toLowerCase()))
    const local = activity
      .filter(
        (a) =>
          a.dealId === id.toString() &&
          a.chainId === ESCROW_CHAIN_ID &&
          ESCROW_ADDRESS !== undefined &&
          a.contract?.toLowerCase() === ESCROW_ADDRESS.toLowerCase() &&
          !known.has(a.hash.toLowerCase()),
      )
      .map((a) => ({ label: a.label, hash: a.hash, blockNumber: 0n }))
    return [...onchain, ...local]
  }, [chainTxs.data, activity, id])

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  const share = async () => {
    if (!link) return
    if (typeof navigator.share !== 'function') return void copy()
    try {
      await navigator.share({ title: 'Zeus Escrow deal', url: link })
    } catch {

    }
  }

  const role = !deal || !address
    ? undefined
    : address.toLowerCase() === deal.payer.toLowerCase()
      ? 'payer'
      : address.toLowerCase() === deal.payee.toLowerCase()
        ? 'payee'
        : undefined

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="-ml-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white">
        <ArrowLeft className="size-4" /> All deals
      </button>

      {!ESCROW_ADDRESS ? (
        <Card className="text-sm text-white/70">The escrow contract is not configured for this app yet.</Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/60">
          <Loader2 className="size-4 animate-spin" /> Loading deal
        </div>
      ) : isError || !deal ? (
        <Card className="space-y-2 text-center">
          <h2 className="display text-xl font-bold">Deal #{id.toString()} not found</h2>
          <p className="text-sm text-white/70">This deal does not exist on the escrow contract, or the network is unreachable.</p>
        </Card>
      ) : (
        <>
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">Deal #{deal.id.toString()}</p>
                <h1 className="display mt-1 text-balance text-2xl font-bold leading-tight">{deal.title}</h1>
              </div>
              <StatusBadge state={displayState(deal, nowSec)} />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">In escrow</p>
              <Money value={formatAmountUsdc(deal.amount)} size="xl" />
            </div>

            <div className="divide-y divide-white/10 rounded-2xl bg-white/[0.04] px-4">
              <Row label="Payer">
                <AddressLink address={deal.payer} /> {role === 'payer' && <span className="ml-1 text-xs text-gold">(you)</span>}
              </Row>
              <Row label="Payee">
                <AddressLink address={deal.payee} /> {role === 'payee' && <span className="ml-1 text-xs text-gold">(you)</span>}
              </Row>
              <Row label="Refund opens">{formatDeadline(deal.deadline)}</Row>
              {deal.status === STATUS.Active && <Row label="Time">{timeLeft(deal.deadline, nowSec)}</Row>}
            </div>

            {address ? (
              <DealActions deal={deal} account={address} nowSec={nowSec} />
            ) : (
              deal.status === STATUS.Active && (
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <Button block onClick={show}>
                      Connect wallet to act on this deal
                    </Button>
                  )}
                </ConnectKitButton.Custom>
              )
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="display text-lg font-bold">Share this deal</h2>
            <p className="text-sm text-white/65">Anyone with this link can see the live status. Only the payer and payee can act.</p>
            <div className="mono break-all rounded-2xl bg-white/[0.06] px-3.5 py-3 text-xs text-white/80">{link ?? 'Preparing link…'}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" disabled={!link} onClick={() => void copy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button variant="ghost" disabled={!link} onClick={() => void share()}>
                <Share2 className="size-4" /> Share
              </Button>
            </div>
          </Card>

          <Card className="space-y-3">
            <h2 className="display text-lg font-bold">Transactions</h2>
            {txs.length === 0 ? (
              <p className="text-sm text-white/60">
                {DEPLOY_BLOCK === undefined
                  ? 'Transactions made from this browser appear here. Set the deployment block to also load every transaction for this deal from the chain.'
                  : chainTxs.isLoading
                    ? 'Loading transactions…'
                    : 'No transactions found for this deal yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-white/10">
                {txs.map((t) => (
                  <li key={t.hash} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-sm text-white">{t.label}</span>
                    <TxLink hash={t.hash} label="Explorer" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
