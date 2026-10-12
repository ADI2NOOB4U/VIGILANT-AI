import { useState } from 'react'
import { motion } from 'motion/react'
import type { ScanResult } from './types'
import { useBackendHealth } from './hooks/useBackendHealth'
import { Shell, type Page } from './components/Shell'
import { ScanPage } from './pages/ScanPage'
import { FeedPage } from './pages/FeedPage'
import { ScamBroadcastPage } from './pages/ScamBroadcastPage'
import { LegalKnowledgePage } from './pages/LegalKnowledgePage'
import { HistoryPage } from './pages/HistoryPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { AboutPage } from './pages/AboutPage'

export default function App() {
  const [page, setPage] = useState<Page>('scan')
  const [result, setResult] = useState<ScanResult | null>(null)
  const health = useBackendHealth()
  const [inspectUrl, setInspectUrl] = useState<string>('')
  const [targetLegalInstrumentId, setTargetLegalInstrumentId] = useState<string | undefined>(undefined)

  const handleInspectUrl = (url: string) => {
    setInspectUrl(url)
    setPage('scan')
  }

  const handleNavigateToLaw = (instrumentId?: string) => {
    setTargetLegalInstrumentId(instrumentId)
    setPage('laws')
  }

  const content =
    page === 'scan' ? (
      <ScanPage result={result} onResult={setResult} initialUrl={inspectUrl} />
    ) : page === 'feed' ? (
      <FeedPage onInspectUrl={handleInspectUrl} />
    ) : page === 'broadcasts' ? (
      <ScamBroadcastPage
        onInspectUrl={handleInspectUrl}
        onNavigateToLaw={handleNavigateToLaw}
      />
    ) : page === 'laws' ? (
      <LegalKnowledgePage initialInstrumentId={targetLegalInstrumentId} />
    ) : page === 'history' ? (
      <HistoryPage />
    ) : page === 'analysis' ? (
      <AnalysisPage />
    ) : (
      <AboutPage />
    )

  return (
    <Shell page={page} onNavigate={setPage} health={health}>
      <motion.div
        key={page}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {content}
      </motion.div>
    </Shell>
  )
}
