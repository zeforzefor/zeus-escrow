import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '@/onchain-facts'
import type { DisplayState } from '@/escrow/format'
import { shortAddress } from '@/escrow/format'
import { ESCROW_CHAIN_ID } from '@/escrow/target'

type Variant = 'primary' | 'gold' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-electric text-white hover:bg-electric-soft shadow-[0_8px_28px_-10px_rgba(47,107,255,0.9)]',
  gold: 'bg-gold text-navy-950 hover:bg-gold-soft shadow-[0_8px_28px_-12px_rgba(245,196,81,0.8)]',
  ghost: 'bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/10',
  danger: 'bg-transparent text-[#ff9aa6] border border-[#ff7a8a]/40 hover:bg-[#ff7a8a]/10',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  block?: boolean
}

export function Button({ variant = 'primary', loading, block, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
        block ? 'w-full' : ''
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`glass rounded-3xl p-5 ${className}`}>{children}</section>
}

const BADGES: Record<DisplayState, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-electric/20 text-[#9bb8ff] border-electric/40' },
  expired: { label: 'Refundable', cls: 'bg-gold/15 text-gold border-gold/40' },
  released: { label: 'Released', cls: 'bg-[#6fe0a0]/15 text-[#6fe0a0] border-[#6fe0a0]/30' },
  refunded: { label: 'Refunded', cls: 'bg-white/10 text-[#d6def0] border-white/20' },
  cancelled: { label: 'Cancelled', cls: 'bg-[#ff7a8a]/15 text-[#ff9aa6] border-[#ff7a8a]/30' },
}

export function StatusBadge({ state }: { state: DisplayState }) {
  const badge = BADGES[state]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${badge.cls}`}>
      {badge.label}
    </span>
  )
}

export function TxLink({ hash, label = 'View on Arc explorer' }: { hash: string; label?: string }) {
  return (
    <a
      href={buildTxExplorerUrl(ESCROW_CHAIN_ID, hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-[#9bb8ff] hover:text-white"
    >
      {label} <ExternalLink className="size-3" />
    </a>
  )
}

export function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={buildAddressExplorerUrl(ESCROW_CHAIN_ID, address)}
      target="_blank"
      rel="noopener noreferrer"
      className="mono text-xs text-white/90 underline decoration-white/25 underline-offset-4 hover:decoration-gold"
    >
      {shortAddress(address)}
    </a>
  )
}

export function Money({ value, size = 'md' }: { value: string; size?: 'md' | 'xl' }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`display font-bold tabular-nums text-gold ${size === 'xl' ? 'text-5xl' : 'text-2xl'}`}>{value}</span>
      <span className={`font-medium text-white/70 ${size === 'xl' ? 'text-base' : 'text-xs'}`}>USDC</span>
    </span>
  )
}
