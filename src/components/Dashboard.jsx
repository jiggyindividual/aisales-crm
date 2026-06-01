import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, PRIORITY_COLORS, HEAT_LEVELS, ACTION_TYPES,
  formatCurrency, formatDate, formatRelative, formatDateShort,
  computeFlags, computeHeatScore, getHeatLevel,
  computeContactPriority, getAISuggestion, getNeglectReason, isNeglected,
  calculateLTV, filterByService,
  isFollowUpToday, isFollowUpOverdue, daysSince,
  getMonthlyClosedRevenue, getTotalMRR, getWeightedPipelineValue,
  getActivePipelineMRR, getDaysInStage, ACTIVE_STAGE_IDS,
  getCallAnalytics, WIN_REASONS, LOSS_REASONS,
  filterByIndustry,
} from '../utils/helpers'
import TodaysHits from './TodaysHits'

const INDUSTRY_COLORS = [
  '#0088FF','#00FF88','#F59E0B','#8B5CF6','#EC4899',
  '#10B981','#3B82F6','#EF4444','#F97316','#6366F1',
]

// ── Shared sub-components ──

function HeatBadge({ score }) {
  const level = getHeatLevel(score)
  const hl = HEAT_LEVELS[level]
  return (
    <span
      className="badge text-[10px] font-bold"
      style={{ background: hl.bg, color: hl.color }}
    >
      {hl.emoji} {hl.label}
    </span>
  )
}

function StageBadge({ stageId }) {
  const stage = STAGES.find(s => s.id === stageId) || STAGES[0]
  return (
    <span
      className="badge text-[10px]"
      style={{ background: stage.color + '22', color: stage.color }}
    >
      {stage.label}
    </span>
  )
}

function StatCard({ label, value, sub, color, onClick, accent }) {
  return (
    <div
      className={`glass rounded-2xl p-5 flex flex-col gap-1.5 ${onClick ? 'cursor-pointer hover:border-white/15 transition-colors' : ''}`}
      style={accent ? { borderLeft: `3px solid ${accent}` } : {}}
      onClick={onClick}
    >
      <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider">{label}</p>
      <p className="font-syne font-bold text-2xl text-white" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  )
}

// ── "Who to Contact Next" ranked lead card ──
function ContactCard({ lead, rank, onClick }) {
  const score = computeHeatScore(lead)
  const suggestion = getAISuggestion(lead)
  const ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
  const actionType = ACTION_TYPES.find(a => a.id === lead.nextActionType)
  const isOverdue = lead.nextActionDueAt && daysSince(lead.nextActionDueAt) > 0

  return (
    <div
      onClick={() => onClick(lead.id)}
      className="flex gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer border-b border-white/[0.04] last:border-0"
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-6 text-right">
        <span className="text-xs font-mono text-white/20 font-bold">#{rank}</span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{lead.businessName}</span>
          <HeatBadge score={score} />
          <StageBadge stageId={lead.stage} />
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/40">
          {ltv > 0 && (
            <span style={{ color: '#00FF88' }} className="font-semibold">{formatCurrency(ltv)}</span>
          )}
          <span>Last contact: {formatRelative(lead.lastContacted)}</span>
          {actionType && (
            <span className={`font-medium ${isOverdue ? 'text-[#FF3B3B]' : 'text-white/50'}`}>
              {actionType.icon} {actionType.label}{isOverdue ? ' (overdue)' : ''}
            </span>
          )}
          {!lead.nextActionType && (
            <span className="text-[#FF9500] font-medium">⚠ No next action</span>
          )}
        </div>

        {suggestion && (
          <p className="text-[11px] text-white/50 italic leading-relaxed">
            "{suggestion}"
          </p>
        )}
      </div>

      {/* Arrow */}
      <div className="flex-shrink-0 flex items-center">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Neglected lead row ──
function NeglectRow({ lead, onClick }) {
  const reason = getNeglectReason(lead)
  const ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
  const score = computeHeatScore(lead)

  return (
    <div
      onClick={() => onClick(lead.id)}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer rounded-xl"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-medium truncate">{lead.businessName}</span>
          <HeatBadge score={score} />
        </div>
        <p className="text-[11px] text-[#FF9500] mt-0.5 font-medium">{reason}</p>
      </div>
      {ltv > 0 && (
        <span className="text-xs font-semibold text-white/40 flex-shrink-0">{formatCurrency(ltv)}</span>
      )}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Mini follow-up row ──
function FollowUpRow({ lead, onClick }) {
  const flags = computeFlags(lead, {})
  return (
    <div
      onClick={() => onClick(lead.id)}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer rounded-xl"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{lead.businessName}</p>
        <p className="text-[11px] text-white/40 truncate">{lead.ownerName || lead.phone}</p>
      </div>
      <div className="flex gap-1 flex-wrap justify-end">
        {flags.slice(0, 2).map(f => (
          <span key={f.type} className="badge text-[10px]" style={{ background: f.color + '22', color: f.color }}>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { leads, settings, industryFilter, openModal } = useCRM()
  const navigate = useNavigate()

  const allActive = useMemo(() => leads.filter(l => !l.archived), [leads])
  const filtered  = useMemo(() => filterByIndustry(allActive, industryFilter), [allActive, industryFilter])

  const closedWon   = useMemo(() => filtered.filter(l => l.stage === 'closed-won'), [filtered])
  const closedLost  = useMemo(() => filtered.filter(l => l.stage === 'closed-lost'), [filtered])
  const active      = useMemo(() => filtered.filter(l => ACTIVE_STAGE_IDS.includes(l.stage)), [filtered])
  const callStats   = useMemo(() => getCallAnalytics(allActive), [allActive])

  // Meetings booked = any lead that has EVER reached Booked Meeting or Meeting Held stage
  const meetingsBooked = useMemo(() =>
    allActive.filter(l =>
      l.stage === 'contacted-interested' ||
      l.stage === 'demo-sent' ||
      (l.stageHistory || []).some(h =>
        h.stage === 'contacted-interested' || h.stage === 'demo-sent'
      )
    ).length
  , [allActive])

  // Win rate = closed-won ÷ total calls dialed (shown as 00.00%)
  const winRate = useMemo(() => {
    const calls = callStats.totalCalls
    if (!calls) return null
    return (closedWon.length / calls * 100).toFixed(2)
  }, [closedWon, callStats.totalCalls])

  // Meeting success rate = closed-won ÷ meetings ever booked (shown as 00.00%)
  const meetingWonRate = useMemo(() => {
    if (!meetingsBooked) return null
    return (closedWon.length / meetingsBooked * 100).toFixed(2)
  }, [closedWon, meetingsBooked])

  // ── Revenue ──
  const monthMRR       = useMemo(() => getMonthlyClosedRevenue(filtered), [filtered])
  const totalMRR       = useMemo(() => getTotalMRR(filtered), [filtered])
  const weightedPipeline = useMemo(() => getWeightedPipelineValue(filtered), [filtered])
  const activeMRRPot   = useMemo(() => getActivePipelineMRR(filtered), [filtered])
  const pipelineVal    = useMemo(() => active.reduce((s,l) => s + calculateLTV(l.monthlyFee, l.setupFee), 0), [active])
  const goalPct        = settings.monthlyGoal > 0 ? Math.min(100, Math.round((monthMRR / settings.monthlyGoal) * 100)) : 0
  const avgDealSize    = active.length > 0 ? Math.round(pipelineVal / active.length) : 0

  // ── Command Center ──
  const today = new Date().toDateString()
  const callsToday     = useMemo(() =>
    allActive.reduce((s,l) =>
      s + (l.activities||[]).filter(a => a.type==='call' && new Date(a.date).toDateString()===today).length
    , 0), [allActive])
  const followUpsToday   = useMemo(() => allActive.filter(l => l.followUpDate && isFollowUpToday(l.followUpDate)), [allActive])
  const followUpsOverdue = useMemo(() => allActive.filter(l => l.followUpDate && isFollowUpOverdue(l.followUpDate) && !isFollowUpToday(l.followUpDate)), [allActive])
  const actionsOverdue   = useMemo(() => active.filter(l => l.nextActionDueAt && daysSince(l.nextActionDueAt) > 0), [active])
  const proposalNoFollowUp = useMemo(() => active.filter(l => l.stage === 'proposal-sent' && daysSince(l.lastContacted) >= 2), [active])

  // ── Ranked "Who to Contact Next" ──
  const rankedLeads = useMemo(() =>
    [...active]
      .sort((a,b) => computeContactPriority(b) - computeContactPriority(a))
      .slice(0, 7)
  , [active])

  // ── Neglected leads ──
  const neglected = useMemo(() =>
    active.filter(l => isNeglected(l))
      .sort((a,b) => computeContactPriority(b) - computeContactPriority(a))
      .slice(0, 6)
  , [active])

  // ── Pipeline funnel ──
  const stageCounts = useMemo(() =>
    STAGES.map(s => ({
      ...s,
      count: filtered.filter(l => l.stage === s.id).length,
      value: filtered.filter(l => l.stage === s.id).reduce((sum,l) => sum + calculateLTV(l.monthlyFee, l.setupFee), 0),
    }))
  , [filtered])
  const maxStageCount = Math.max(...stageCounts.map(s => s.count), 1)

  // ── Nuclear / Hot deals ──
  const hotDealCount = useMemo(() =>
    active.filter(l => {
      const s = computeHeatScore(l)
      return s >= 50
    }).length
  , [active])

  return (
    <div className="p-5 lg:p-6 space-y-6 pb-24 lg:pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-syne font-bold text-white text-2xl">Command Center</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal('csvImport')} className="btn btn-ghost btn-sm hidden lg:flex">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v8M4 7l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Import
          </button>
          <button onClick={() => openModal('quickAdd')} className="btn btn-primary btn-sm">+ New Lead</button>
        </div>
      </div>

      {/* ── Revenue goal bar ── */}
      {settings.monthlyGoal > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">Monthly Revenue Goal</p>
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
            <div className="progress-fill" style={{
              width: `${goalPct}%`,
              background: goalPct >= 100 ? '#00FF88' : goalPct >= 60 ? '#FF9500' : '#0088FF',
            }} />
          </div>
        </div>
      )}

      {/* ── Workspace label ── */}
      {industryFilter !== 'all' && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] text-white/30 font-semibold uppercase tracking-wider">Workspace:</span>
          <span className="badge text-xs font-bold" style={{ background: 'rgba(0,136,255,0.15)', color: '#0088FF' }}>
            {industryFilter}
          </span>
          <span className="text-[11px] text-white/25">{filtered.length} leads</span>
        </div>
      )}

      {/* ── All-industry breakdown (only when viewing All) ── */}
      {industryFilter === 'all' && (() => {
        const byIndustry = {}
        allActive.forEach(l => {
          const ind = l.industry || 'Other'
          if (!byIndustry[ind]) byIndustry[ind] = { count: 0, won: 0, mrr: 0 }
          byIndustry[ind].count++
          if (l.stage === 'closed-won') { byIndustry[ind].won++; byIndustry[ind].mrr += parseFloat(l.monthlyFee) || 0 }
        })
        const rows = Object.entries(byIndustry).sort((a,b) => b[1].count - a[1].count)
        if (rows.length <= 1) return null
        return (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.05]">
              <h2 className="font-syne font-bold text-white text-sm">All Industries Overview</h2>
              <p className="text-[11px] text-white/30 mt-0.5">Click a tab above to filter by workspace</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {rows.map(([ind, stats], i) => (
                <div key={ind} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: INDUSTRY_COLORS[i % INDUSTRY_COLORS.length] }} />
                  <span className="text-sm text-white font-medium flex-1">{ind}</span>
                  <span className="text-xs text-white/40">{stats.count} leads</span>
                  <span className="text-xs text-white/40">{stats.won} won</span>
                  {stats.mrr > 0 && <span className="text-xs font-semibold" style={{ color: '#00FF88' }}>{formatCurrency(stats.mrr)}/mo</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Today's Hits ── */}
      <TodaysHits />

      {/* ── Call Analytics ── */}
      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">Call Performance</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Total Calls Dialed</p>
            <p className="font-syne font-bold text-2xl text-white">{callStats.totalCalls}</p>
            <p className="text-[11px] text-white/30 mt-1">{callStats.answered} answered</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Answer Rate</p>
            <p className="font-syne font-bold text-2xl" style={{ color: callStats.answerRate >= 30 ? '#00FF88' : callStats.answerRate >= 15 ? '#F59E0B' : '#EF4444' }}>
              {callStats.answerRate}%
            </p>
            <p className="text-[11px] text-white/30 mt-1">answered ÷ dialed</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Win Rate</p>
            <p className="font-syne font-bold text-2xl font-mono" style={{ color: parseFloat(winRate) >= 5 ? '#00FF88' : parseFloat(winRate) > 0 ? '#F59E0B' : '#fff' }}>
              {winRate !== null ? `${winRate}%` : '0.00%'}
            </p>
            <p className="text-[11px] text-white/30 mt-1">
              {closedWon.length} won · {callStats.totalCalls} calls dialed
            </p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Meetings Booked</p>
            <p className="font-syne font-bold text-2xl text-white">{meetingsBooked}</p>
            <p className="text-[11px] text-white/30 mt-1">all time</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Meeting → Won</p>
            <p className="font-syne font-bold text-2xl font-mono" style={{ color: parseFloat(meetingWonRate) >= 20 ? '#00FF88' : parseFloat(meetingWonRate) > 0 ? '#F59E0B' : '#fff' }}>
              {meetingWonRate !== null ? `${meetingWonRate}%` : '0.00%'}
            </p>
            <p className="text-[11px] text-white/30 mt-1">
              {closedWon.length} won of {meetingsBooked} meetings
            </p>
          </div>
        </div>
      </div>

      {/* ── Today's Action Stats ── */}
      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">Today's Focus</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            className={`glass rounded-2xl p-4 cursor-pointer hover:border-white/15 transition-colors ${followUpsToday.length > 0 ? 'border-[#0088FF]/30' : ''}`}
            style={followUpsToday.length > 0 ? { borderColor: 'rgba(0,136,255,0.25)' } : {}}
            onClick={() => navigate('/tasks')}
          >
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Follow-Ups</p>
            <p className="font-syne font-bold text-2xl" style={{ color: followUpsToday.length > 0 ? '#0088FF' : '#fff' }}>
              {followUpsToday.length}
            </p>
            <p className="text-[11px] text-white/30 mt-1">due today</p>
          </div>

          <div
            className={`glass rounded-2xl p-4 cursor-pointer hover:border-white/15 transition-colors`}
            style={followUpsOverdue.length > 0 ? { borderColor: 'rgba(255,59,59,0.3)' } : {}}
            onClick={() => navigate('/tasks')}
          >
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Overdue</p>
            <p className="font-syne font-bold text-2xl" style={{ color: followUpsOverdue.length > 0 ? '#FF3B3B' : '#fff' }}>
              {followUpsOverdue.length + actionsOverdue.length}
            </p>
            <p className="text-[11px] text-white/30 mt-1">need action now</p>
          </div>

          <div
            className="glass rounded-2xl p-4 cursor-pointer hover:border-white/15 transition-colors"
            style={proposalNoFollowUp.length > 0 ? { borderColor: 'rgba(255,149,0,0.3)' } : {}}
            onClick={() => navigate('/pipeline')}
          >
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Proposals</p>
            <p className="font-syne font-bold text-2xl" style={{ color: proposalNoFollowUp.length > 0 ? '#FF9500' : '#fff' }}>
              {proposalNoFollowUp.length}
            </p>
            <p className="text-[11px] text-white/30 mt-1">need follow-up</p>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-1">Calls Today</p>
            <p className="font-syne font-bold text-2xl text-white">{callsToday}</p>
            <p className="text-[11px] text-white/30 mt-1">logged</p>
          </div>
        </div>
      </div>

      {/* ── Revenue Strip ── */}
      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">Pipeline Revenue</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Pipeline Value"
            value={formatCurrency(pipelineVal)}
            sub={`${active.length} active deals`}
            accent="#0088FF"
          />
          <StatCard
            label="Weighted Pipeline"
            value={formatCurrency(weightedPipeline)}
            sub="by close probability"
            color="#9B59B6"
            accent="#9B59B6"
          />
          <StatCard
            label="MRR Potential"
            value={`${formatCurrency(activeMRRPot)}/mo`}
            sub="from active pipeline"
            accent="#FF9500"
          />
          <StatCard
            label="Total MRR"
            value={formatCurrency(totalMRR)}
            sub="from closed won"
            color="#00FF88"
            accent="#00FF88"
          />
        </div>
      </div>

      {/* ── Secondary metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Avg Deal Size" value={formatCurrency(avgDealSize)} sub="active pipeline" />
        <StatCard label="Hot Deals" value={hotDealCount} sub="Heat ≥ Hot" color="#FF6B00" onClick={() => navigate('/list')} />
        <StatCard label="Closed Won" value={closedWon.length} sub="all time" color="#00FF88" />
        <StatCard label="Neglected" value={neglected.length} sub="need attention" color={neglected.length > 0 ? '#FF9500' : undefined} />
      </div>

      {/* ── Who to Contact Next ── */}
      {rankedLeads.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="font-syne font-bold text-white text-base">Who to Contact Next</h2>
              <p className="text-[11px] text-white/30 mt-0.5">Ranked by urgency, deal value, and heat</p>
            </div>
            <button onClick={() => navigate('/list')} className="text-xs text-white/30 hover:text-white/70 transition-colors">
              View all →
            </button>
          </div>
          <div>
            {rankedLeads.map((lead, i) => (
              <ContactCard key={lead.id} lead={lead} rank={i + 1} onClick={(id) => navigate(`/leads/${id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Neglected Leads ── */}
      {neglected.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden border border-[#FF9500]/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <h2 className="font-syne font-bold text-white text-base">
                💸 Money Leaking Here
                <span className="ml-2 badge animate-pulse-overdue" style={{ background: '#FF950022', color: '#FF9500' }}>
                  {neglected.length}
                </span>
              </h2>
              <p className="text-[11px] text-white/30 mt-0.5">These leads are being neglected — act now</p>
            </div>
          </div>
          <div className="p-2">
            {neglected.map(l => (
              <NeglectRow key={l.id} lead={l} onClick={(id) => navigate(`/leads/${id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Follow-ups + Overdue ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-syne font-semibold text-white text-sm">
              Follow-Ups Today
              {followUpsToday.length > 0 && (
                <span className="ml-2 badge" style={{ background: '#0088FF22', color: '#0088FF' }}>{followUpsToday.length}</span>
              )}
            </h2>
            <button onClick={() => navigate('/tasks')} className="text-xs text-white/30 hover:text-white/70">View all →</button>
          </div>
          {followUpsToday.length === 0 ? (
            <p className="text-white/25 text-sm">All caught up — no follow-ups due today.</p>
          ) : (
            <div className="space-y-0.5">
              {followUpsToday.slice(0, 4).map(l => (
                <FollowUpRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
              ))}
              {followUpsToday.length > 4 && (
                <button onClick={() => navigate('/tasks')} className="text-xs text-white/40 hover:text-white/70 px-4 py-2">
                  + {followUpsToday.length - 4} more
                </button>
              )}
            </div>
          )}
        </div>

        {followUpsOverdue.length > 0 ? (
          <div className="glass rounded-2xl p-5 border border-[#FF3B3B]/20">
            <h2 className="font-syne font-semibold text-white text-sm mb-3">
              Overdue Follow-Ups
              <span className="ml-2 badge animate-pulse-overdue" style={{ background: '#FF3B3B22', color: '#FF3B3B' }}>
                {followUpsOverdue.length}
              </span>
            </h2>
            <div className="space-y-0.5">
              {followUpsOverdue.slice(0, 4).map(l => (
                <FollowUpRow key={l.id} lead={l} onClick={() => navigate(`/leads/${l.id}`)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-5">
            <h2 className="font-syne font-semibold text-white text-sm mb-3">Pipeline Stages</h2>
            <div className="space-y-2.5">
              {stageCounts.filter(s => s.id !== 'do-not-call').map(s => (
                <div key={s.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/50">{s.label}</span>
                    <div className="flex items-center gap-2">
                      {s.value > 0 && <span className="text-[10px] text-white/30">{formatCurrency(s.value)}</span>}
                      <span className="text-xs font-semibold text-white/60">{s.count}</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill funnel-bar" style={{ width: `${(s.count / maxStageCount) * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Pipeline funnel (when overdue visible above) ── */}
      {followUpsOverdue.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="font-syne font-semibold text-white text-sm mb-4">Pipeline Stages</h2>
          <div className="space-y-2.5">
            {stageCounts.filter(s => s.id !== 'do-not-call').map(s => (
              <div key={s.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/50">{s.label}</span>
                  <div className="flex items-center gap-2">
                    {s.value > 0 && <span className="text-[10px] text-white/30">{formatCurrency(s.value)}</span>}
                    <span className="text-xs font-semibold text-white/60">{s.count}</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill funnel-bar" style={{ width: `${(s.count / maxStageCount) * 100}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
