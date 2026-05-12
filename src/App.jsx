import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { CRMProvider, useCRM } from './context/CRMContext'
import Layout from './components/Layout'
import Toast from './components/Toast'

const Dashboard   = lazy(() => import('./components/Dashboard'))
const DailyTasks  = lazy(() => import('./components/DailyTasks'))
const Pipeline    = lazy(() => import('./components/Pipeline'))
const ListView    = lazy(() => import('./components/ListView'))
const LeadDetail  = lazy(() => import('./components/LeadDetail'))
const Reporting   = lazy(() => import('./components/Reporting'))
const Archive     = lazy(() => import('./components/Archive'))
const Settings    = lazy(() => import('./components/Settings'))

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
      // Skip if typing in an input/textarea/select
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
      <CRMProvider>
        <AppShell />
      </CRMProvider>
    </BrowserRouter>
  )
}
