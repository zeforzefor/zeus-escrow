import { ConnectKitButton } from 'connectkit'
import { Wallet, Zap } from 'lucide-react'
import { shortAddress } from '@/escrow/format'
import { CHAIN_FACTS, IS_MAINNET } from '@/escrow/target'

export function Header({ onHome }: { onHome: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
        <button onClick={onHome} className="flex min-h-11 items-center gap-2.5" aria-label="Zeus Escrow home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gold text-navy-950">
            <Zap className="size-5" strokeWidth={2.5} />
          </span>
          <span className="text-left leading-tight">
            <span className="display block text-lg font-bold">Zeus Escrow</span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/60">
              <span className={`size-1.5 rounded-full ${IS_MAINNET ? 'bg-[#6fe0a0]' : 'bg-gold'}`} />
              {CHAIN_FACTS.name}{IS_MAINNET ? ' mainnet' : ''}
            </span>
          </span>
        </button>

        <ConnectKitButton.Custom>
          {({ isConnected, show, address }) => (
            <button
              onClick={show}
              className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all active:scale-[0.98] ${
                isConnected ? 'border border-white/15 bg-white/[0.07] text-white' : 'bg-electric text-white'
              }`}
            >
              <Wallet className="size-4" />
              {isConnected && address ? <span className="mono text-xs">{shortAddress(address)}</span> : 'Connect'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
