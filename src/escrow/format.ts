import { BaseError, ContractFunctionRevertedError } from 'viem'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ESCROW_CHAIN_ID } from './target'
import { STATUS, type Deal } from './abi'

export const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

export function formatAmountUsdc(raw: bigint): string {
  return Amount.fromRaw(raw, usdcDecimalsFor(ESCROW_CHAIN_ID)).toFixed(2)
}

export function formatDeadline(deadline: bigint): string {
  return new Date(Number(deadline) * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeLeft(deadline: bigint, nowSec: number): string {
  const diff = Number(deadline) - nowSec
  if (diff <= 0) return 'Deadline passed'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${Math.max(m, 1)}m left`
}

export type DisplayState = 'active' | 'expired' | 'released' | 'refunded' | 'cancelled'

export function displayState(deal: Deal, nowSec: number): DisplayState {
  switch (deal.status) {
    case STATUS.Released:
      return 'released'
    case STATUS.Refunded:
      return 'refunded'
    case STATUS.Cancelled:
      return 'cancelled'
    default:
      return nowSec > Number(deal.deadline) ? 'expired' : 'active'
  }
}

const REVERTS: Record<string, string> = {
  InvalidPayee: 'The payee must be a valid address that is not your own.',
  InvalidAmount: 'Enter an amount greater than zero.',
  InvalidDeadline: 'The deadline must be in the future.',
  InvalidTitle: 'The title must be between 1 and 140 characters.',
  IncorrectDepositAmount: 'The escrow did not receive the exact amount. Nothing was deposited.',
  UnknownDeal: 'This deal does not exist.',
  DealNotActive: 'This deal has already been settled.',
  OnlyPayer: 'Only the payer can do this.',
  OnlyPayee: 'Only the payee can do this.',
  DeadlineNotPassed: 'A refund is only possible after the deadline has passed.',
}

export function parseTxError(error: unknown): string | null {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('user rejected') || message.includes('user denied')) return null
  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      return REVERTS[reverted.data.errorName] ?? `Transaction reverted (${reverted.data.errorName}).`
    }
  }
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Insufficient balance to cover this transaction.'
  }
  if (message.includes('network') || message.includes('timeout')) {
    return 'Network issue. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}
