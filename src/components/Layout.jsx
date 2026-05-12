import React, { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import QuickAddModal from './QuickAddModal'
import CSVImportModal from './CSVImportModal'
import Onboarding from './Onboarding'
import { SERVICES } from '../utils/helpers'

const NAV_ITEMS = [
  { to: '/',          icon: GridIcon,    label: 'Dashboard' },
  { to: '/tasks',     icon: TaskIcon,    label: 'Tasks',    badge: true },
  { to: '/pipeline',  icon: PipeIcon,    label: 'Pipeline' },
  { to: '/list',      icon: ListIcon,    label: 'List' },
  { to: '/reporting', icon: ChartIcon,   label: 'Reporting' },
  { to: '/archive',   icon: ArchiveIcon, label: 'Archive' },
  { to: '/settings',  icon: GearIcon,    label: 'Settings' },
]

function GridIcon()    { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg> }
function TaskIcon()    { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 4h12M3 9h8M3 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="14" cy="13" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12.5 13l1 1 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function PipeIcon()    { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="5" width="4" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="7" y="3" width="4" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="13" y="7" width="4" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg> }
function ListIcon()    { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function ChartIcon()   { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-5 4 2 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function ArchiveIcon() { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="5" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 8h14" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M3 5V4a1 1 0 011-1h10a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5"/></svg> }
function GearIcon()    { return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.22 4.22l1.41 1.41M12.37 12.37l1.41 1.41M4.22 13.78l1.41-1.41M12.37 5.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> }
function PlusIcon()    { return <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg> }

const SERVICE_OPTIONS = [
  { id: 'all',              label: 'All' },
  { id: 'ai-website',      label: 'AI Website',      color: '#0088FF' },
  { id: 'ai-receptionist', label: 'AI Receptionist', color: '#00FF88' },
  { id: 'both',            label: 'Both',            color: '#FFD700' },
]

function TaskBadge() {
  const { leads } = useCRM()
  const today = new Date(); today.setHours(0,0,0,0)
  const count = leads.filter(l => {
    if (l.archived || !l.followUpDate) return false
    const fu = new Date(l.followUpDate); fu.setHours(0,0,0,0)
    return fu <= today
  }).length
  if (!count) return null
  return (
    <span className="absolute -top-1 -right-1 bg-[#FF3B3B] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  )
}

function ServiceBar() {
  const { serviceFilter, setServiceFilter } = useCRM()
  return (
    <div className="service-bar bg-bg/90 backdrop-blur border-b border-white/[0.05] px-4 py-2.5">
      <div className="flex gap-1.5 max-w-full overflow-x-auto pb-0.5">
        {SERVICE_OPTIONS.map(opt => {
          const active = serviceFilter === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setServiceFilter(opt.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? 'text-black'
                  : 'text-white/40 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08]'
              }`}
              style={active ? { background: opt.color || '#fff', color: opt.id === 'all' ? '#000' : '#000' } : {}}
            >
              {opt.id !== 'all' && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                  style={{ background: opt.color, opacity: active ? 1 : 0.5 }}
                />
              )}
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function KbdHints() {
  return (
    <div className="hidden lg:flex items-center gap-3 px-4 py-2 border-t border-white/[0.04] text-white/20">
      {[['N','New'],['D','Dash'],['P','Pipeline'],['L','List'],['T','Tasks'],['/',  'Search']].map(([k,label]) => (
        <span key={k} className="flex items-center gap-1 text-[10px]">
          <span className="kbd">{k}</span>{label}
        </span>
      ))}
    </div>
  )
}

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { leads, activeModal, openModal, closeModal, serviceFilter } = useCRM()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const activeLeads = leads.filter(l => !l.archived)

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-white/[0.06] bg-bg flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <h1 className="font-syne font-bold text-white text-lg tracking-tight">Park CRM</h1>
          <p className="text-white/30 text-xs mt-0.5">{activeLeads.length} active leads</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
                }`
              }
            >
              <span className="relative">
                <Icon />
                {badge && <TaskBadge />}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Onboarding widget */}
        <div className="px-3 pb-3">
          <Onboarding />
        </div>

        <KbdHints />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="w-64 h-full bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-5 border-b border-white/[0.05]">
              <h1 className="font-syne font-bold text-white text-lg">Park CRM</h1>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                      isActive ? 'bg-white text-black' : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
                    }`
                  }
                >
                  <span className="relative"><Icon />{badge && <TaskBadge />}</span>
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-3 pb-3"><Onboarding /></div>
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <h1 className="font-syne font-bold text-white text-base">Park CRM</h1>
          <div className="w-6" />
        </header>

        {/* Service filter bar */}
        <ServiceBar />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0d0d0d]/95 backdrop-blur border-t border-white/[0.06] z-30 flex items-center px-1 pb-safe">
        {NAV_ITEMS.slice(0,4).map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2.5 gap-1 rounded-xl transition-colors ${
                isActive ? 'text-white' : 'text-white/30'
              }`
            }
          >
            <span className="relative"><Icon />{badge && <TaskBadge />}</span>
            <span className="text-[9px] font-medium">{label}</span>
          </NavLink>
        ))}
        <NavLink
          to="/reporting"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2.5 gap-1 rounded-xl transition-colors ${
              isActive ? 'text-white' : 'text-white/30'
            }`
          }
        >
          <ChartIcon />
          <span className="text-[9px] font-medium">More</span>
        </NavLink>
      </nav>

      {/* ── Floating quick-add button ── */}
      <button
        onClick={() => openModal('quickAdd')}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-13 h-13 rounded-full bg-white text-black shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        style={{ width: 52, height: 52 }}
        title="Quick add lead (N)"
      >
        <PlusIcon />
      </button>

      {/* ── Modals ── */}
      {activeModal === 'quickAdd' && <QuickAddModal onClose={closeModal} />}
      {activeModal === 'csvImport' && <CSVImportModal onClose={closeModal} />}
    </div>
  )
}
