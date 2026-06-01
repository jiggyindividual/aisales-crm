import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, INDUSTRIES, OUR_WEBSITE_OPTIONS, NOT_INTERESTED_REASONS,
  WIN_REASONS, LOSS_REASONS, HEAT_LEVELS,
  computeFlags, computeHeatScore, getHeatLevel, computeUrgency, isNeglected,
  filterByService, sortLeads, matchesSearch,
  formatCurrency, formatRelative, calculateLTV, daysSince,
  isFollowUpOverdue,
} from '../utils/helpers'
import { exportLeadsToCSV } from '../utils/csvUtils'
import TodaysHits from './TodaysHits'

// ── Inline status dropdown cell ──────────────────────────────────────────────
function StatusCell({ value, options, onChange, openKey, setOpenKey, cellKey, stopClick }) {
  const isOpen   = openKey === cellKey
  const opt      = options.find(o => o.id === value) || options[0]
  const ref      = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenKey(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  return (
    <div className="relative" ref={ref} onClick={stopClick}>
      <button
        onClick={() => setOpenKey(isOpen ? null : cellKey)}
        className="px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all hover:opacity-80 flex items-center gap-1"
        style={{ background: opt.color + '25', color: opt.color, border: `1px solid ${opt.color}35` }}
      >
        {opt.label}
        <span className="text-[8px] opacity-50">▾</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 glass rounded-xl overflow-hidden shadow-2xl border border-white/10 min-w-[160px]">
          {options.map(o => (
            <button
              key={o.id}
              onClick={() => { onChange(o.id); setOpenKey(null) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/[0.07] transition-colors flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.color }} />
              <span style={{ color: o.color }}>{o.label}</span>
              {o.id === value && <span className="ml-auto text-white/30 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Win/Loss reason picker (inline after stage change) ───────────────────────
function WinLossPrompt({ stage, onSelect, onSkip }) {
  const reasons = stage === 'closed-won' ? WIN_REASONS : LOSS_REASONS
  const color   = stage === 'closed-won' ? '#00FF88' : '#EF4444'
  return (
    <div className="absolute left-0 top-full mt-1 z-50 glass rounded-xl overflow-hidden shadow-2xl border border-white/10 min-w-[200px] p-2">
      <p className="text-[10px] text-white/40 px-2 py-1 font-semibold uppercase tracking-wide">
        {stage === 'closed-won' ? 'Why did you win?' : 'Why did you lose?'}
      </p>
      {reasons.map(r => (
        <button key={r.id} onClick={() => onSelect(r.id)}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.07] transition-colors rounded-lg"
          style={{ color }}
        >
          {r.label}
        </button>
      ))}
      <button onClick={onSkip} className="w-full text-left px-3 py-1.5 text-[11px] text-white/25 hover:text-white/50">
        Skip
      </button>
    </div>
  )
}

// ── Urgency badge ────────────────────────────────────────────────────────────
function UrgencyBadge({ lead }) {
  const u = computeUrgency(lead)
  if (!u) return <span className="text-[11px] text-white/20">—</span>
  return (
    <span
      className="badge text-[10px] font-semibold whitespace-nowrap"
      style={{
        background: u.color + '20',
        color: u.color,
        animation: u.pulse ? 'pulseOverdue 2s ease-in-out infinite' : undefined,
      }}
    >
      {u.label}
    </span>
  )
}

// ── One-tap quick log bar ────────────────────────────────────────────────────
function QuickLogBar({ lead, quickLog }) {
  const BTNS = [
    { type: 'called',         icon: '📞', title: 'Called — Answered' },
    { type: 'no-answer',      icon: '📵', title: 'No Answer' },
    { type: 'callback',       icon: '🔁', title: 'Callback Requested' },
    { type: 'not-interested', icon: '🚫', title: 'Not Interested' },
  ]
  return (
    <div className="flex gap-1">
      {BTNS.map(b => (
        <button
          key={b.type}
          title={b.title}
          onClick={e => { e.stopPropagation(); quickLog(lead.id, b.type) }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-base hover:bg-white/10 transition-colors"
        >
          {b.icon}
        </button>
      ))}
    </div>
  )
}

// ── Main ListView ────────────────────────────────────────────────────────────
const SORT_OPTS = [
  { value: 'contactPriority', label: 'Priority' },
  { value: 'dateAdded',       label: 'Date Added' },
  { value: 'lastContacted',   label: 'Last Contact' },
  { value: 'stage',           label: 'Stage' },
  { value: 'ltv',             label: 'Deal Value' },
  { value: 'businessName',    label: 'Name A–Z' },
  { value: 'callAttempts',    label: 'Most Calls' },
]

export default function ListView() {
  const navigate = useNavigate()
  const { leads, serviceFilter, bulkUpdate, archiveLead, changeStage, updateLead, quickLog, setWinLossReason, openModal } = useCRM()

  // ── Inline editing state
  const [editCell, setEditCell]     = useState(null)   // 'leadId:field'
  const [editValue, setEditValue]   = useState('')
  const [openDropdown, setOpenDropdown] = useState(null) // 'leadId:field'
  const [winLossPrompt, setWinLossPrompt] = useState(null) // { leadId, stage, cellKey }

  // ── Filter / sort state
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState('contactPriority')
  const [dir, setDir]               = useState('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters]       = useState({
    stage: '', priority: '', urgency: '', neglected: false, noNextAction: false,
  })
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const activeFilterCount = Object.values(filters).filter(v => v && v !== false).length

  // ── Selected rows for bulk ops
  const [selected, setSelected]     = useState(new Set())

  const searchRef = useRef(null)

  // ── Computed rows
  const rows = useMemo(() => {
    let list = filterByService(leads.filter(l => !l.archived), serviceFilter)
    list = list.filter(l => matchesSearch(l, search))
    if (filters.stage)        list = list.filter(l => l.stage === filters.stage)
    if (filters.priority)     list = list.filter(l => l.priority === filters.priority)
    if (filters.neglected)    list = list.filter(l => isNeglected(l))
    if (filters.noNextAction) list = list.filter(l => !l.nextActionType)
    if (filters.urgency) {
      list = list.filter(l => {
        const u = computeUrgency(l)
        return u?.level === filters.urgency
      })
    }
    const sorted = sortLeads(list, sort, dir)
    return [...sorted.filter(l => l.pinned), ...sorted.filter(l => !l.pinned)]
  }, [leads, serviceFilter, search, filters, sort, dir])

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(rows.map(r => r.id)))
  const toggleOne   = (id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  // ── Inline text editing
  const startEdit = useCallback((leadId, field, currentValue, e) => {
    if (e) e.stopPropagation()
    setEditCell(`${leadId}:${field}`)
    setEditValue(currentValue || '')
    setOpenDropdown(null)
  }, [])

  const commitEdit = useCallback((leadId, field) => {
    updateLead(leadId, { [field]: editValue })
    setEditCell(null)
  }, [editValue, updateLead])

  // ── Stage change with win/loss prompt
  const handleStageChange = useCallback((leadId, newStage) => {
    changeStage(leadId, newStage)
    if (newStage === 'closed-won' || newStage === 'closed-lost') {
      setWinLossPrompt({ leadId, stage: newStage, cellKey: `${leadId}:stage` })
    }
    setOpenDropdown(null)
  }, [changeStage])

  // ── Bulk actions
  const [bulkStage, setBulkStage] = useState('')
  const handleBulkStage = () => {
    if (!bulkStage || !selected.size) return
    bulkUpdate([...selected], { stage: bulkStage })
    setSelected(new Set()); setBulkStage('')
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-white/[0.05] space-y-3">

        {/* Today's Hits */}
        <TodaysHits />

        {/* Search + controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input ref={searchRef} className="input pl-8" placeholder="Search name, phone, email…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <select className="input w-auto text-sm" value={sort} onChange={e => setSort(e.target.value)}>
            {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => setDir(d => d === 'asc' ? 'desc' : 'asc')} className="btn btn-ghost btn-sm">
            {dir === 'asc' ? '↑' : '↓'}
          </button>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn btn-sm ${showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'}`}
          >
            ⊞ {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filter'}
          </button>
          <button onClick={() => exportLeadsToCSV(rows)} className="btn btn-ghost btn-sm hidden lg:flex">
            ↓ Export
          </button>
          <button onClick={() => openModal('quickAdd')} className="btn btn-primary btn-sm">+ Add Lead</button>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 animate-slide-in-up">
            <select className="input w-auto text-xs py-1" value={filters.stage} onChange={e => setFilter('stage', e.target.value)}>
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className="input w-auto text-xs py-1" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
              <option value="">All Priorities</option>
              {['Hot','Warm','Cold'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="input w-auto text-xs py-1" value={filters.urgency} onChange={e => setFilter('urgency', e.target.value)}>
              <option value="">All Urgency</option>
              <option value="dead">Dead Cold</option>
              <option value="cold">Going Cold</option>
              <option value="warm">Follow Up</option>
            </select>
            {[
              { key: 'neglected',    label: '💸 Neglected' },
              { key: 'noNextAction', label: '⚡ No Action' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key, !filters[key])}
                className={`btn btn-sm ${filters[key] ? 'btn-primary' : 'btn-ghost'}`}>{label}</button>
            ))}
            <button onClick={() => setFilters({ stage:'', priority:'', urgency:'', neglected:false, noNextAction:false })}
              className="btn btn-ghost btn-sm text-white/40">Clear</button>
          </div>
        )}

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-white/[0.04] rounded-xl px-3 py-2 animate-slide-in-up">
            <span className="text-xs text-white/60">{selected.size} selected</span>
            <select className="input w-auto text-xs py-1" value={bulkStage} onChange={e => setBulkStage(e.target.value)}>
              <option value="">Move to stage…</option>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button onClick={handleBulkStage} disabled={!bulkStage} className="btn btn-ghost btn-xs">Apply</button>
            <button onClick={() => { [...selected].forEach(id => archiveLead(id)); setSelected(new Set()) }}
              className="btn btn-danger btn-xs">Archive</button>
            <button onClick={() => { exportLeadsToCSV(leads.filter(l => selected.has(l.id))) }}
              className="btn btn-ghost btn-xs">Export</button>
            <button onClick={() => setSelected(new Set())} className="btn btn-ghost btn-xs ml-auto">Deselect</button>
          </div>
        )}

        <p className="text-[11px] text-white/25">{rows.length} leads</p>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-syne font-semibold text-white text-lg mb-1">No leads found</h3>
            <p className="text-white/30 text-sm">Adjust filters or add your first lead</p>
          </div>
        ) : (
          <table className="w-full" style={{ minWidth: 1420 }}>
            <thead className="sticky top-0 z-20 bg-[#0a0a0a] border-b border-white/[0.06]">
              <tr>
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                </th>
                {/* Sticky business name header */}
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 sticky left-0 bg-[#0a0a0a] z-10 min-w-[180px]">Business</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[110px]">Phone</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[150px]">Email</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[140px]">Stage</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[120px]">Not Int. Reason</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[90px]">Their Site</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/40 w-12">Maps</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[120px]">Our Website</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[90px]">Last Contact</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[95px]">Urgency</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[160px]">Notes</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[130px]">Next Step</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/40 w-12">Calls</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40 min-w-[140px]">Quick Log</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((lead, rowIdx) => {
                const urgency    = computeUrgency(lead)
                const isSelected = selected.has(lead.id)
                const stageObj   = STAGES.find(s => s.id === lead.stage) || STAGES[0]
                const ourSiteObj = OUR_WEBSITE_OPTIONS.find(o => o.id === (lead.ourWebsite || 'none')) || OUR_WEBSITE_OPTIONS[0]
                const niReason   = NOT_INTERESTED_REASONS.find(r => r.id === lead.notInterestedReason)
                const winLossR   = lead.stage === 'closed-won'
                  ? WIN_REASONS.find(r => r.id === lead.winLossReason)?.label
                  : LOSS_REASONS.find(r => r.id === lead.winLossReason)?.label

                return (
                  <tr
                    key={lead.id}
                    className={`border-b border-white/[0.035] transition-colors group ${isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
                    style={{ animationDelay: `${Math.min(rowIdx, 8) * 0.02}s` }}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2.5" onClick={e => { e.stopPropagation(); toggleOne(lead.id) }}>
                      <input type="checkbox" checked={isSelected} readOnly className="rounded pointer-events-none" />
                    </td>

                    {/* Business Name — sticky, clickable to detail */}
                    <td
                      className="px-4 py-2.5 sticky left-0 z-10 cursor-pointer"
                      style={{ background: isSelected ? 'rgba(255,255,255,0.04)' : '#0e0e0e' }}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <div className="flex items-center gap-2">
                        {urgency && (
                          <div
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background: urgency.color,
                              animation: urgency.pulse ? 'pulseOverdue 2s ease-in-out infinite' : undefined,
                            }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-white font-semibold truncate leading-tight">
                            {lead.pinned && <span className="text-[#FFD700] mr-1">★</span>}
                            {lead.businessName || <span className="text-white/30">Untitled</span>}
                          </p>
                          {lead.ownerName && (
                            <p className="text-[11px] text-white/40 truncate">{lead.ownerName}</p>
                          )}
                          {/* Win/loss reason tag */}
                          {winLossR && (
                            <span className="text-[10px] font-medium" style={{ color: lead.stage === 'closed-won' ? '#00FF88' : '#EF4444' }}>
                              {winLossR}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone — inline edit */}
                    <EditTextCell
                      value={lead.phone}
                      placeholder="Add phone…"
                      cellKey={`${lead.id}:phone`}
                      editCell={editCell}
                      editValue={editValue}
                      onStartEdit={(e) => startEdit(lead.id, 'phone', lead.phone, e)}
                      onEditChange={setEditValue}
                      onCommit={() => commitEdit(lead.id, 'phone')}
                      onCancel={() => setEditCell(null)}
                    />

                    {/* Email — inline edit */}
                    <EditTextCell
                      value={lead.email}
                      placeholder="Add email…"
                      cellKey={`${lead.id}:email`}
                      editCell={editCell}
                      editValue={editValue}
                      onStartEdit={(e) => startEdit(lead.id, 'email', lead.email, e)}
                      onEditChange={setEditValue}
                      onCommit={() => commitEdit(lead.id, 'email')}
                      onCancel={() => setEditCell(null)}
                    />

                    {/* Stage — dropdown */}
                    <td className="px-3 py-2.5">
                      <div className="relative">
                        <StatusCell
                          value={lead.stage}
                          options={STAGES}
                          onChange={(val) => handleStageChange(lead.id, val)}
                          openKey={openDropdown}
                          setOpenKey={setOpenDropdown}
                          cellKey={`${lead.id}:stage`}
                          stopClick={e => e.stopPropagation()}
                        />
                        {/* Win/loss reason prompt */}
                        {winLossPrompt?.leadId === lead.id && (
                          <WinLossPrompt
                            stage={winLossPrompt.stage}
                            onSelect={(reason) => {
                              setWinLossReason(lead.id, reason)
                              setWinLossPrompt(null)
                            }}
                            onSkip={() => setWinLossPrompt(null)}
                          />
                        )}
                      </div>
                    </td>

                    {/* Not Interested Reason */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      {lead.stage === 'do-not-call' ? (
                        <StatusCell
                          value={lead.notInterestedReason || 'ghosted'}
                          options={NOT_INTERESTED_REASONS.map(r => ({ ...r, color: '#6B7280' }))}
                          onChange={(val) => updateLead(lead.id, { notInterestedReason: val })}
                          openKey={openDropdown}
                          setOpenKey={setOpenDropdown}
                          cellKey={`${lead.id}:niReason`}
                          stopClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-[11px] text-white/15">—</span>
                      )}
                    </td>

                    {/* Their Website */}
                    <EditLinkCell
                      value={lead.currentWebsite || lead.website}
                      placeholder="Add URL…"
                      cellKey={`${lead.id}:currentWebsite`}
                      editCell={editCell}
                      editValue={editValue}
                      onStartEdit={(e) => startEdit(lead.id, 'currentWebsite', lead.currentWebsite || lead.website, e)}
                      onEditChange={setEditValue}
                      onCommit={() => commitEdit(lead.id, 'currentWebsite')}
                      onCancel={() => setEditCell(null)}
                    />

                    {/* Maps link */}
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      {lead.mapsLink ? (
                        <a href={lead.mapsLink} target="_blank" rel="noopener noreferrer"
                          className="text-lg hover:opacity-70 transition-opacity" onClick={e => e.stopPropagation()}>
                          📍
                        </a>
                      ) : (
                        <span className="text-white/15 text-sm">—</span>
                      )}
                    </td>

                    {/* Our Website — dropdown */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <StatusCell
                        value={lead.ourWebsite || 'none'}
                        options={OUR_WEBSITE_OPTIONS}
                        onChange={(val) => updateLead(lead.id, { ourWebsite: val })}
                        openKey={openDropdown}
                        setOpenKey={setOpenDropdown}
                        cellKey={`${lead.id}:ourWebsite`}
                        stopClick={e => e.stopPropagation()}
                      />
                    </td>

                    {/* Last Contact */}
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-white/45 whitespace-nowrap">
                        {formatRelative(lead.lastContacted)}
                      </span>
                    </td>

                    {/* Urgency */}
                    <td className="px-3 py-2.5">
                      <UrgencyBadge lead={lead} />
                    </td>

                    {/* Notes — inline edit */}
                    <EditTextCell
                      value={lead.notes}
                      placeholder="Add note…"
                      cellKey={`${lead.id}:notes`}
                      editCell={editCell}
                      editValue={editValue}
                      onStartEdit={(e) => startEdit(lead.id, 'notes', lead.notes, e)}
                      onEditChange={setEditValue}
                      onCommit={() => commitEdit(lead.id, 'notes')}
                      onCancel={() => setEditCell(null)}
                      multiline
                    />

                    {/* Next Step — inline edit */}
                    <EditTextCell
                      value={lead.nextStep}
                      placeholder="Next step…"
                      cellKey={`${lead.id}:nextStep`}
                      editCell={editCell}
                      editValue={editValue}
                      onStartEdit={(e) => startEdit(lead.id, 'nextStep', lead.nextStep, e)}
                      onEditChange={setEditValue}
                      onCommit={() => commitEdit(lead.id, 'nextStep')}
                      onCancel={() => setEditCell(null)}
                    />

                    {/* Call count */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[11px] text-white/45 font-mono">{lead.callAttemptCount || 0}</span>
                    </td>

                    {/* Quick log */}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <QuickLogBar lead={lead} quickLog={quickLog} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Editable text cell component ─────────────────────────────────────────────
function EditTextCell({ value, placeholder, cellKey, editCell, editValue, onStartEdit, onEditChange, onCommit, onCancel, multiline }) {
  const isEditing = editCell === cellKey
  const inputRef  = useRef(null)

  useEffect(() => { if (isEditing) inputRef.current?.focus() }, [isEditing])

  if (isEditing) {
    return (
      <td className="px-3 py-1.5 min-w-[120px]" onClick={e => e.stopPropagation()}>
        {multiline ? (
          <textarea
            ref={inputRef}
            rows={2}
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
            className="w-full bg-white/[0.06] border border-white/20 rounded-md text-xs text-white px-2 py-1 outline-none resize-none"
          />
        ) : (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={onCommit}
            onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
            className="w-full bg-white/[0.06] border border-white/20 rounded-md text-xs text-white px-2 py-1.5 outline-none"
          />
        )}
      </td>
    )
  }

  return (
    <td
      className="px-3 py-2.5 cursor-text hover:bg-white/[0.03] transition-colors group/cell min-w-[120px]"
      onClick={onStartEdit}
    >
      {value ? (
        <span className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">{value}</span>
      ) : (
        <span className="text-[11px] text-white/15 group-hover/cell:text-white/30 transition-colors">{placeholder}</span>
      )}
    </td>
  )
}

// ── Editable link cell component ─────────────────────────────────────────────
function EditLinkCell({ value, placeholder, cellKey, editCell, editValue, onStartEdit, onEditChange, onCommit, onCancel }) {
  const isEditing = editCell === cellKey
  const inputRef  = useRef(null)
  const href      = value ? (value.startsWith('http') ? value : `https://${value}`) : null

  useEffect(() => { if (isEditing) inputRef.current?.focus() }, [isEditing])

  if (isEditing) {
    return (
      <td className="px-3 py-1.5 min-w-[90px]" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={editValue}
          placeholder="https://…"
          onChange={e => onEditChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel() }}
          className="w-full bg-white/[0.06] border border-white/20 rounded-md text-xs text-white px-2 py-1.5 outline-none"
        />
      </td>
    )
  }

  return (
    <td className="px-3 py-2.5 min-w-[90px]" onClick={e => e.stopPropagation()}>
      {href ? (
        <div className="flex items-center gap-1.5">
          <a href={href} target="_blank" rel="noopener noreferrer"
            className="text-[#0088FF] text-[11px] hover:underline truncate max-w-[70px]"
            onClick={e => e.stopPropagation()}>
            🔗 {value.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
          </a>
          <button className="text-white/20 hover:text-white/60 text-xs" onClick={onStartEdit}>✎</button>
        </div>
      ) : (
        <button className="text-[11px] text-white/15 hover:text-white/40 transition-colors" onClick={onStartEdit}>
          {placeholder}
        </button>
      )}
    </td>
  )
}
