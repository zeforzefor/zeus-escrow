import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { Inbox, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { Button, Card } from './ui'
import { DealCard } from './DealCard'
import { useMyDeals, useNowSec } from '@/hooks/useDeals'
import { ESCROW_ADDRESS } from '@/escrow/target'

type Role = 'payer' | 'payee'

export function DealsList({ onOpen, onNew }: { onOpen: (id: bigint) => void; onNew: () => void }) {
  const { address, isConnected } = useAccount()
  const { asPayer, asPayee, isLoading, isError } = useMyDeals(address)
  const nowSec = useNowSec()
  const [role, setRole] = useState<Role>('payer')

  if (!isConnected) {
    return (
      <Card className="space-y-4 text-center">
        <h2 className="display text-2xl font-bold">Connect to see your deals</h2>
        <p className="text-sm text-white/70">Deals you fund and deals sent to you will show up here.</p>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <Button block onClick={show}>
              Connect wallet
            </Button>
          )}
        </ConnectKitButton.Custom>
      </Card>
    )
  }

  const list = role === 'payer' ? asPayer : asPayee

  return (
    <div className="space-y-4">
      <div role="tablist" className="glass grid grid-cols-2 rounded-2xl p-1">
        {(['payer', 'payee'] as const).map((r) => {
          const count = r === 'payer' ? asPayer.length : asPayee.length
          const active = role === r
          return (
            <button
              key={r}
              role="tab"
              aria-selected={active}
              onClick={() => setRole(r)}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                active ? 'bg-electric text-white' : 'text-white/65 hover:text-white'
              }`}
            >
              {r === 'payer' ? 'As payer' : 'As payee'} <span className="tabular-nums opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {!ESCROW_ADDRESS ? (
        <Card className="text-center text-sm text-white/70">Connect the escrow contract to load deals.</Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/60">
          <Loader2 className="size-4 animate-spin" /> Loading deals
        </div>
      ) : isError ? (
        <Card className="text-center text-sm text-[#ff9aa6]">Could not load deals from the chain. Check your connection.</Card>
      ) : list.length === 0 ? (
        <Card className="space-y-3 py-8 text-center">
          <Inbox className="mx-auto size-8 text-gold" />
          <p className="text-sm text-white/70">
            {role === 'payer' ? 'You have not funded any deals yet.' : 'No deals have been sent to this wallet yet.'}
          </p>
          {role === 'payer' && (
            <Button variant="gold" onClick={onNew}>
              Create your first deal
            </Button>
          )}
        </Card>
      ) : (
        list.map((deal) => <DealCard key={deal.id.toString()} deal={deal} account={address} nowSec={nowSec} role={role} onOpen={onOpen} />)
      )}
    </div>
  )
}
