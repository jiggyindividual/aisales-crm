import React, { useEffect, Suspense, lazy, Component } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { CRMProvider, useCRM } from './context/CRMContext'
import Layout from './components/Layout'
import Toast from './components/Toast'

// Lazy imports with chunk-error retry
const lazyLoad = (factory) =>
  lazy(() =>
    factory().catch(() => {
      window.location.reload()
      return { default: () => null }
    })
  )

const Dashboard   = lazyLoad(() => import('./components/Dashboard'))
const DailyTasks  = lazyLoad(() => import('./components/DailyTasks'))
const Pipeline    = lazyLoad(() => import('./components/Pipeline'))
const ListView    = lazyLoad(() => import('./components/ListView'))
const LeadDetail  = lazyLoad(() => import('./components/LeadDetail'))
const Reporting   = lazyLoad(() => import('./components/Reporting'))
const Archive     = lazyLoad(() => import('./components/Archive'))
const Settings    = lazyLoad(() => import('./components/Settings'))

// Error boundary — catches any render crash and shows a recovery screen
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error) {
    // ChunkLoadError = stale deployment cache — auto-reload fixes it
    if (
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module')
    ) {
      window.location.reload()
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-bg gap-4 px-6 text-center">
          <div className="text-5xl">⚠️</div>
          <h2 className="font-syne font-bold text-white text-xl">Something went wrong</h2>
          <p className="text-white/40 text-sm max-w-xs">
            Your data is safe. Click below to reload the app.
          </p>
          <button
            className="btn btn-primary mt-2"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function SkeletonPage() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(6)].map((_,i) => (
        <div key={i} className="skeleton h-12 rounded-xl" style={{ animationDelay: `${i*0.08}s` }} />
      ))}
    </div>
  )
}

function KeyboardShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()
  const { openModal } = useCRM()

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
        if (e.key === 'Escape') { e.target.blur(); return }
        return
      }
      switch (e.key) {
        case 'n': case 'N': e.preventDefault(); openModal('quickAdd'); break
        case '/':           e.preventDefault(); document.getElementById('global-search')?.focus(); break
        case 't': case 'T': navigate('/tasks'); break
        case 'd': case 'D': navigate('/'); break
        case 'p': case 'P': navigate('/pipeline'); break
        case 'l': case 'L': navigate('/list'); break
        case 'Escape':      openModal(null); break
        default: break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location, openModal])

  return null
}

function AppShell() {
  return (
    <>
      <KeyboardShortcuts />
      <Toast />
      <Layout>
        <Suspense fallback={<SkeletonPage />}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/tasks"     element={<DailyTasks />} />
            <Route path="/pipeline"  element={<Pipeline />} />
            <Route path="/list"      element={<ListView />} />
            <Route path="/leads/:id" element={<LeadDetail />} />
            <Route path="/reporting" element={<Reporting />} />
            <Route path="/archive"   element={<Archive />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="*"          element={<Dashboard />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <CRMProvider>
          <AppShell />
        </CRMProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
