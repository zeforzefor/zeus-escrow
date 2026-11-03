import { useState } from 'react'
import { Header } from '@/components/Header'
import { DealsList } from '@/components/DealsList'
import { CreateDeal } from '@/components/CreateDeal'
import { ActivityList } from '@/components/ActivityList'
import { DealPage } from '@/components/DealPage'
import { DeployPage } from '@/components/DeployPage'
import { MainnetNotice, SetupNotice, WrongNetwork } from '@/components/Notices'
import { useRoute } from '@/lib/route'

type Tab = 'deals' | 'new' | 'activity'

const TABS: { id: Tab; label: string }[] = [
  { id: 'deals', label: 'My deals' },
  { id: 'new', label: 'New deal' },
  { id: 'activity', label: 'Activity' },
]

export default function App() {
  const { route, navigate } = useRoute()
  const [tab, setTab] = useState<Tab>('deals')

  const goHome = (next: Tab = 'deals') => {
    setTab(next)
    navigate('/')
  }

  return (
    <div className="min-h-dvh pb-24">
      <Header onHome={() => goHome('deals')} />
      <main className="mx-auto max-w-xl space-y-4 px-4 pt-5">
        {route.name !== 'deploy' && <SetupNotice onDeploy={() => navigate('/deploy')} />}
        <WrongNetwork />

        {route.name === 'deploy' ? (
          <DeployPage onBack={() => goHome('deals')} />
        ) : route.name === 'deal' ? (
          <DealPage id={route.id} onBack={() => goHome('deals')} />
        ) : (
          <>
            <div className="px-1 pb-1">
              <h1 className="display text-balance text-3xl font-bold leading-[1.1]">
                Pay when the work is <span className="text-gold">done</span>.
              </h1>
              <p className="mt-2 max-w-[44ch] text-pretty text-sm text-white/70">
                Lock USDC for a promoter. Release it when they deliver, or take it back after the deadline. No fees, no admin.
              </p>
            </div>

            <MainnetNotice />

            <nav role="tablist" className="glass grid grid-cols-3 rounded-2xl p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                    tab === t.id ? 'bg-white text-[#050B1C]' : 'text-white/65 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {tab === 'deals' && <DealsList onOpen={(id) => navigate(`/deal/${id}`)} onNew={() => setTab('new')} />}
            {tab === 'new' && <CreateDeal onCreated={() => setTab('deals')} />}
            {tab === 'activity' && <ActivityList />}
          </>
        )}
      </main>
    </div>
  )
}
