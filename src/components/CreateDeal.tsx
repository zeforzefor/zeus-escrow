import { useMemo, useState } from 'react'
import { useNowSec } from '@/hooks/useDeals'
import { erc20Abi, isAddress } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Button, Card } from './ui'
import { useEscrowActions } from '@/hooks/useEscrowActions'
import { Amount, parseAmount, usdcDecimalsFor } from '@/onchain-money'
import { ESCROW_ADDRESS, ESCROW_CHAIN_ID, USDC_ADDRESS, CHAIN_FACTS } from '@/escrow/target'

const MAX_TITLE_BYTES = 140
const DEADLINE_CHIPS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
]

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const inDays = (days: number) => toLocalInput(new Date(Date.now() + days * 86400_000))

const fieldCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-white/30 focus:border-electric focus:bg-white/[0.09]'

function Label({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{children}</span>
      {hint && <span className="text-xs text-white/50">{hint}</span>}
    </div>
  )
}

export function CreateDeal({ onCreated }: { onCreated: () => void }) {
  const { address, isConnected, chainId } = useAccount()
  const { busy, step, createDeal } = useEscrowActions()
  const [payee, setPayee] = useState('')
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState(() => inDays(7))
  const [title, setTitle] = useState('')
  const nowSec = useNowSec(20000)

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ESCROW_CHAIN_ID,
    query: { enabled: address !== undefined, refetchInterval: 10000 },
  })

  const titleBytes = useMemo(() => new TextEncoder().encode(title.trim()).length, [title])

  const parsed = useMemo(() => {
    const trimmedPayee = payee.trim()
    let amountRaw: bigint | undefined
    try {
      const value = parseAmount(ESCROW_CHAIN_ID, amount || '0')
      if (value.isPositive()) amountRaw = value.raw
    } catch {
      amountRaw = undefined
    }
    const deadlineMs = new Date(deadline).getTime()
    const errors: Record<string, string> = {}
    if (trimmedPayee && !isAddress(trimmedPayee)) errors.payee = 'Enter a valid wallet address.'
    else if (trimmedPayee && address && trimmedPayee.toLowerCase() === address.toLowerCase()) {
      errors.payee = 'The payee must be a different wallet from yours.'
    }
    if (amount && amountRaw === undefined) errors.amount = 'Enter a valid amount, up to 6 decimals.'
    else if (amountRaw !== undefined && balance.data !== undefined && amountRaw > balance.data) {
      errors.amount = 'More than your USDC balance.'
    }
    if (!Number.isFinite(deadlineMs) || deadlineMs < (nowSec + 60) * 1000) errors.deadline = 'Pick a time in the future.'
    if (titleBytes > MAX_TITLE_BYTES) errors.title = `Keep the title under ${MAX_TITLE_BYTES} characters.`
    const ready =
      isAddress(trimmedPayee) &&
      amountRaw !== undefined &&
      titleBytes > 0 &&
      Object.keys(errors).length === 0
    return { trimmedPayee, amountRaw, deadlineMs, errors, ready }
  }, [payee, amount, deadline, titleBytes, balance.data, address, nowSec])

  const submit = async () => {
    if (!parsed.ready || parsed.amountRaw === undefined || !isAddress(parsed.trimmedPayee)) return
    const ok = await createDeal({
      payee: parsed.trimmedPayee,
      amount: parsed.amountRaw,
      deadline: BigInt(Math.floor(parsed.deadlineMs / 1000)),
      title: title.trim(),
    })
    if (ok) {
      setPayee('')
      setAmount('')
      setTitle('')
      setDeadline(inDays(7))
      onCreated()
    }
  }

  const balanceText =
    balance.data !== undefined ? `Balance ${Amount.fromRaw(balance.data, usdcDecimalsFor(ESCROW_CHAIN_ID)).toFixed(2)} USDC` : undefined
  const creating = busy === 'create'

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="display text-2xl font-bold">New deal</h2>
        <p className="mt-1 text-sm text-white/70">
          Lock USDC in escrow for a promoter. You decide when it is released.
        </p>
      </div>

      <div>
        <Label>Title</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 20 raid posts for the launch week"
          className={fieldCls}
          maxLength={200}
          autoComplete="off"
        />
        {parsed.errors.title && <p className="mt-1.5 text-xs text-[#ff9aa6]">{parsed.errors.title}</p>}
      </div>

      <div>
        <Label>Payee wallet</Label>
        <input
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
          placeholder="0x…"
          className={`${fieldCls} mono text-sm`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {parsed.errors.payee && <p className="mt-1.5 text-xs text-[#ff9aa6]">{parsed.errors.payee}</p>}
      </div>

      <div>
        <Label hint={balanceText}>Amount</Label>
        <div className="relative">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, '')
              if (/^\d*\.?\d*$/.test(value)) setAmount(value)
            }}
            placeholder="0.00"
            className={`${fieldCls} display pr-20 text-2xl font-bold tabular-nums`}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gold">USDC</span>
        </div>
        {parsed.errors.amount && <p className="mt-1.5 text-xs text-[#ff9aa6]">{parsed.errors.amount}</p>}
      </div>

      <div>
        <Label>Refund available after</Label>
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={fieldCls} />
        <div className="mt-2 flex flex-wrap gap-2">
          {DEADLINE_CHIPS.map((chip) => (
            <button
              key={chip.days}
              type="button"
              onClick={() => setDeadline(inDays(chip.days))}
              className="min-h-9 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-xs font-semibold text-white/80 hover:border-electric hover:text-white"
            >
              {chip.label}
            </button>
          ))}
        </div>
        {parsed.errors.deadline && <p className="mt-1.5 text-xs text-[#ff9aa6]">{parsed.errors.deadline}</p>}
        <p className="mt-2 text-xs text-white/55">
          After this time you can reclaim your USDC if you have not released it. The payee can cancel at any time.
        </p>
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
        <Button block variant="gold" disabled={!parsed.ready || !ESCROW_ADDRESS} loading={creating} onClick={() => void submit()}>
          {creating
            ? (step ?? 'Working…')
            : chainId !== ESCROW_CHAIN_ID
              ? `Switch to ${CHAIN_FACTS.name} and deposit`
              : 'Deposit and create deal'}
        </Button>
      )}
      {!ESCROW_ADDRESS && (
        <p className="text-xs text-[#ff9aa6]">Escrow contract address is not configured yet. See the notice above.</p>
      )}
      <p className="text-xs text-white/50">
        Two wallet confirmations: approve the exact amount, then deposit. Gas on Arc is paid in USDC, so keep a little extra.
      </p>
    </Card>
  )
}
