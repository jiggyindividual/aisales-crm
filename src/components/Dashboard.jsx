import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, PRIORITY_COLORS,
  formatCurrency, formatDate, formatRelative,
  computeFlags, calculateLTV, filterByService,
  isFollowUpToday, isFollowUpOverdue, daysSince,
  getMonthlyClosedRevenue, getTotalMRR,
} from '../utils/helpers'

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div
      className={`glass rounded-2xl p-5 flex flex-col gap-2 ${onClick ? 'cursor-pointer hover:border-white/15 transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-white/40 font-medium uppercase tracking-wide">{label}</p>
      <p className="font-syne font-bold text-2xl text-white" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  )
}

function SmallFlag({ flag }) {
  return (
    <span
      className="badge text-[10px]"
      style={{ background: flag.color + '22', color: flag.color }}
    >
      {flag.label}
    </span>
  )
}

function LeadRow({ lead, onClick }) {
  const flags = computeFlags(lead, {})
  const svc = SERVICES[lead.service]
  return (
    <div
      onClick={() => onClick(lead.id)}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer rounded-xl"
    >
      <div
        className="w-1.5 h-10 rounded-full flex-shrink-0"
        style={{ background: svc?.color || '#555' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{lead.businessName}</p>
        <p className="text-xs text-white/40 truncate">{lead.phone}</p>
      </div>
      <div className="flex gap-1 flex-wrap justify-end">
        {flags.slice(0, 2).map(f => <SmallFlag key={f.type} flag={f} />)}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { leads, settings, serviceFilter, openModal } = useCRM()
  const navigate = useNavigate()

  const filtered = useMemo(() => filterByService(leads.filter(l => !l.archived), serviceFilter), [leads, serviceFilter])
  const closedWon = useMemo(() => filtered.filter(l => l.stage === 'closed-won'), [filtered])
  const active = useMemo(() => filtered.filter(l => l.stage !== 'closed-won' && l.stage !== 'closed-lost' && l.stage !== 'do-not-call'), [filtered])

  const monthMRR   = useMemo(() => getMonthlyClosedRevenue(filtered), [filtered])
  const totalMRR   = useMemo(() => getTotalMRR(filtered), [filtered])
  const allLeads   = leads.filter(l => !l.archived)

  // Pipeline value
  const pipelineVal = useMemo(() =>
    active.reduce((s, l) => s + calculateLTV(l.monthlyFee, l.setupFee), 0), [active])

  // Setup fee revenue
  const setupRevenue = useMemo(() =>
    closedWon.reduce((s, l) => s + (parseFloat(l.setupFee) || 0), 0), [closedWon])

  // Goal progress
  const goalPct = settings.monthlyGoal > 0 ? Math.min(100, Math.round((monthMRR / settings.monthlyGoal) * 100)) : 0

  // Stage counts
  const stageCounts = useMemo(() =>
    STAGES.map(s => ({ ...s, count: filtered.filter(l => l.stage === s.id).length })), [filtered])

  // Follow-ups due today / overdue
  const followUpsToday = useMemo(() =>
    allLeads.filter(l => l.followUpDate && isFollowUpToday(l.followUpDate)), [allLeads])
  const followUpsOverdue = useMemo(() =>
    allLeads.filter(l => l.followUpDate && isFollowUpOverdue(l.followUpDate) && !isFollowUpToday(l.followUpDate)), [allLeads])

  // Stale leads
  const stale = useMemo(() =>
    filtered.filter(l => {
      const days = daysSince(l.lastContacted)
      return days !== null && days >= settings.staleThreshold &&
        l.stage !== 'closed-won' && l.stage !== 'closed-lost' && l.stage !== 'do-not-call'
    }), [filtered, settings])

  // Gone cold
  const goneCold = useMemo(() =>
    filtered.filter(l => {
      const days = daysSince(l.lastContacted)
      return l.priority === 'Hot' && days !== null && days >= settings.coldThreshold &&
        l.stage !== 'closed-won' && l.stage !== 'closed-lost'
    }), [filtered, settings])

  // Hot leads
  const hotLeads = useMemo(() =>
    filtered.filter(l => l.priority === 'Hot' && l.stage !== 'closed-won' && l.stage !== 'closed-lost'), [filtered])

  // Calls today
  const today = new Date().toDateString()
  const callsToday = useMemo(() =>
    allLeads.reduce((s, l) =>
      s + (l.activities || []).filter(a => a.type === 'call' && new Date(a.date).toDateString() === today).length
    , 0), [allLeads])

  // Conversion rate
  const convRate = allLeads.length > 0 ? Math.round((closedWon.length / allLeads.length) * 100) : 0

  // Best industry
  const industryWins = useMemo(() => {
    const counts = {}
    closedWon.forEach(l => { counts[l.industry] = (counts[l.industry] || 0) + 1 })
    return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]
  }, [closedWon])

  // Service breakdown
  const svcBreakdown = useMemo(() =>
    Object.entries(SERVICES).map(([k, v]) => ({
      ...v, id: k,
      count: allLeads.filter(l => l.service === k).length,
      closedWon: allLeads.filter(l => l.service === k && l.stage === 'closed-won').length,
      mrr: allLeads.filter(l => l.service === k && l.stage === 'closed-won').reduce((s,l) => s+(parseFloat(l.monthlyFee)||0), 0),
    })), [allLeads])

  const maxStage = Math.max(...stageCounts.map(s => s.count), 1)

  return (
    <div className="p-5 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-bold text-white text-2xl">Dashboard</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openModal('csvImport')}
            className="btn btn-ghost btn-sm hidden lg:flex"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v8M4 7l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Import CSV
          </button>
          <button onClick={() => openModal('quickAdd')} className="btn btn-primary btn-sm">
            + New Lead
          </button>
        </div>
      </div>

      {/* Revenue goal */}
      {settings.monthlyGoal > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wide font-medium">Monthly Revenue Goal</p>
              <p className="font-syne font-bold text-white text-xl mt-1">
                {formatCurrency(monthMRR)}
                <span className="text-white/30 text-sm font-normal ml-2">/ {formatCurrency(settings.monthlyGoal)}</span>
              </p>
            </div>
            <span className="font-syne font-bold text-3xl" style={{ color: goalPct >= 100 ? '#00FF88' : '#fff' }}>
              {goalPct}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${goalPct}%`,
                background: goalPct >= 100 ? '#00FF88' : goalPct >= 60 ? '#FF9500' : '#0088FF',
              }}
            />
          </div>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={allLeads.length}
          sub={`${closedWon.length} closed won`} />
        <StatCard label="Pipeline Value" value={formatCurrency(pipelineVal)}
          sub="active opportunities" />
        <StatCard label="Total MRR" value={formatCurrency(totalMRR)}
          sub="from closed won" color="#00FF88" />
        <StatCard label="Setup Revenue" value={formatCurrency(setupRevenue)}
          sub="one-time fees" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Calls Today" value={callsToday} sub="logged calls" />
        <StatCard label="Conversion" value={`${convRate}%`} sub="cold → closed won" />
        <StatCard label="Hot Leads" value={hotLeads.length} sub="high priority" color="#FF3B3B"
          onClick={() => navigate('/list')} />
        <StatCard label="Best Industry" value={industryWins?.[0] || '—'}
          sub={industryWins ? `${industryWins[1]} won` : 'no wins yet'} />
      </div>

      {/* Service breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {svcBreakdown.map(s => (
          <div key={s.id} className="glass rounded-2xl p-5 border-l-2" style={{ borderLeftColor: s.color }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <p className="text-xs text-white/40 font-medium uppercase tracking-wide">{s.label}</p>
            </div>
            <p className="font-syne font-bold text-white text-xl">{s.count} leads</p>
            <div className="flex gap-4 mt-2">
              <span className="text-xs text-white/40">{s.closedWon} won</span>
              <span className="text-xs" style={{ color: s.color }}>{formatCurrency(s.mrr)}/mo</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline by stage */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-syne font-semibold text-white text-base mb-4">Pipeline Stages</h2>
          <div className="space-y-2.5">
            {stageCounts.map(s => (
              <div key={s.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/50">{s.label}</span>
                  <span className="text-xs font-semibold text-white/70">{s.count}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill funnel-bar"
                    style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          {/* Follow-ups due today */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-syne font-semibold text-white text-base">
                Follow-ups Today
                {followUpsToday.length > 0 && (
                  <span className="ml-2 badge" style={{ background: '#0088FF22', color: '#0088FF' }}>
                    {followUpsToday.length}
                  </span>
                )}
              </h2>
              <button onClick={() => navigate('/tasks')} className="text-xs text-white/30 hover:text-white/70">View all →</button>
            </div>
            {followUpsToday.length === 0 ? (
              <p className="text-white/25 text-sm">All caught up! No follow-ups due today.</p>
            ) : (
              <div className="space-y-1">
                {followUpsToday.slice(0, 4).map(l => (
                  <LeadRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
                ))}
                {followUpsToday.length > 4 && (
                  <button onClick={() => navigate('/tasks')} className="text-xs text-white/40 hover:text-white/70 pl-4">
                    + {followUpsToday.length - 4} more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Overdue */}
          {followUpsOverdue.length > 0 && (
            <div className="glass rounded-2xl p-5 border border-[#FF3B3B]/20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-syne font-semibold text-white text-base">
                  Overdue
                  <span className="ml-2 badge animate-pulse-overdue" style={{ background: '#FF3B3B22', color: '#FF3B3B' }}>
                    {followUpsOverdue.length}
                  </span>
                </h2>
              </div>
              <div className="space-y-1">
                {followUpsOverdue.slice(0, 3).map(l => (
                  <LeadRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hot leads */}
      {hotLeads.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-semibold text-white text-base">🔥 Hot Leads</h2>
            <button onClick={() => navigate('/list')} className="text-xs text-white/30 hover:text-white/70">See all →</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
            {hotLeads.slice(0, 6).map(l => (
              <LeadRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Stale & Gone Cold alerts */}
      {(stale.length > 0 || goneCold.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {stale.length > 0 && (
            <div className="glass rounded-2xl p-5 border border-[#FF9500]/20">
              <h2 className="font-syne font-semibold text-white text-sm mb-3">
                ⚠ Stale Leads
                <span className="ml-2 badge" style={{ background: '#FF950022', color: '#FF9500' }}>{stale.length}</span>
              </h2>
              <div className="space-y-1">
                {stale.slice(0, 4).map(l => (
                  <LeadRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
                ))}
              </div>
            </div>
          )}
          {goneCold.length > 0 && (
            <div className="glass rounded-2xl p-5 border border-[#8B8BFF]/20">
              <h2 className="font-syne font-semibold text-white text-sm mb-3">
                🧊 Gone Cold
                <span className="ml-2 badge" style={{ background: '#8B8BFF22', color: '#8B8BFF' }}>{goneCold.length}</span>
              </h2>
              <div className="space-y-1">
                {goneCold.slice(0, 4).map(l => (
                  <LeadRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
