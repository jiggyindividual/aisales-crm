import React, { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, INDUSTRIES, PRIORITY_COLORS,
  computeFlags, filterByService, sortLeads, matchesSearch,
  formatCurrency, formatRelative, formatDate, calculateLTV,
  isFollowUpOverdue, daysSince,
} from '../utils/helpers'
import { exportLeadsToCSV } from '../utils/csvUtils'

const SORT_OPTS = [
  { value: 'businessName', label: 'Name' },
  { value: 'stage',        label: 'Stage' },
  { value: 'priority',     label: 'Priority' },
  { value: 'ltv',          label: 'LTV' },
  { value: 'dateAdded',    label: 'Date Added' },
  { value: 'followUpDate', label: 'Follow-up' },
  { value: 'lastContacted',label: 'Last Contact' },
  { value: 'callAttempts', label: 'Calls' },
]

function ServiceBadge({ service }) {
  const s = SERVICES[service]
  if (!s) return null
  return (
    <span className="badge text-[10px]" style={{ background: s.color + '22', color: s.color }}>
      {s.label}
    </span>
  )
}

function FlagDots({ flags }) {
  return (
    <div className="flex gap-1">
      {flags.map(f => (
        <span key={f.type} title={f.label}
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: f.color }}
        />
      ))}
    </div>
  )
}

function InlineSelect({ value, options, onChange, colorMap }) {
  return (
    <select
      value={value}
      onChange={e => { e.stopPropagation(); onChange(e.target.value) }}
      onClick={e => e.stopPropagation()}
      className="input text-xs py-1 px-2"
      style={{ width: 'auto', minWidth: 100 }}
    >
      {options.map(o => (
        <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
      ))}
    </select>
  )
}

export default function ListView() {
  const navigate = useNavigate()
  const { leads, serviceFilter, bulkUpdate, archiveLead, changeStage, updateLead, addToast } = useCRM()

  const [search, setSearch]       = useState('')
  const [sort, setSort]           = useState('dateAdded')
  const [dir, setDir]             = useState('desc')
  const [selected, setSelected]   = useState(new Set())
  const [filters, setFilters]     = useState({ stage: '', industry: '', priority: '', hasWebsite: '', stale: false, overdue: false, isNew: false, tagged: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [bulkStage, setBulkStage] = useState('')
  const [bulkService, setBulkService] = useState('')
  const searchRef = useRef(null)

  // Wire global search focus
  React.useEffect(() => {
    const el = document.getElementById('global-search')
    if (el) { el.onfocus = () => searchRef.current?.focus() }
  }, [])

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const rows = useMemo(() => {
    let list = filterByService(leads.filter(l => !l.archived), serviceFilter)
    list = list.filter(l => matchesSearch(l, search))
    if (filters.stage)     list = list.filter(l => l.stage === filters.stage)
    if (filters.industry)  list = list.filter(l => l.industry === filters.industry)
    if (filters.priority)  list = list.filter(l => l.priority === filters.priority)
    if (filters.hasWebsite) list = list.filter(l => filters.hasWebsite === 'yes' ? l.hasWebsite : !l.hasWebsite)
    if (filters.stale)    list = list.filter(l => { const d = daysSince(l.lastContacted); return d !== null && d >= 7 })
    if (filters.overdue)  list = list.filter(l => l.followUpDate && isFollowUpOverdue(l.followUpDate))
    if (filters.isNew)    list = list.filter(l => daysSince(l.dateAdded) === 0)
    if (filters.tagged)   list = list.filter(l => l.tags?.includes(filters.tagged))

    const sorted = sortLeads(list, sort, dir)
    // Pinned always first
    return [...sorted.filter(l => l.pinned), ...sorted.filter(l => !l.pinned)]
  }, [leads, serviceFilter, search, filters, sort, dir])

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.id)))
  }
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sortBy = (col) => {
    if (sort === col) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setDir('asc') }
  }

  const SortTh = ({ col, children }) => (
    <th
      className="px-3 py-3 text-left text-[10px] text-white/40 font-semibold uppercase tracking-wide cursor-pointer hover:text-white/70 whitespace-nowrap select-none"
      onClick={() => sortBy(col)}
    >
      {children}
      {sort === col && <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )

  const handleBulkAction = (action) => {
    const ids = [...selected]
    if (!ids.length) return
    if (action === 'archive') {
      ids.forEach(id => archiveLead(id))
      setSelected(new Set())
    } else if (action === 'stage' && bulkStage) {
      bulkUpdate(ids, { stage: bulkStage })
      setSelected(new Set())
    } else if (action === 'service' && bulkService) {
      bulkUpdate(ids, { service: bulkService })
      setSelected(new Set())
    } else if (action === 'export') {
      const toExport = leads.filter(l => ids.includes(l.id))
      exportLeadsToCSV(toExport, 'park-crm-selection')
    }
  }

  const activeFilterCount = Object.entries(filters).filter(([k,v]) => v && v !== '').length

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.05] space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[180px] relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              id="global-search"
              ref={searchRef}
              className="input pl-8"
              placeholder="Search name, phone, email, tags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Sort */}
          <select className="input w-auto" value={sort} onChange={e => setSort(e.target.value)}>
            {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => setDir(d => d === 'asc' ? 'desc' : 'asc')} className="btn btn-ghost btn-sm">
            {dir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn btn-sm ${showFilters || activeFilterCount > 0 ? 'btn-primary' : 'btn-ghost'}`}
          >
            ⊞ Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>

          {/* Export */}
          <button onClick={() => exportLeadsToCSV(rows)} className="btn btn-ghost btn-sm hidden lg:flex">
            ↓ Export
          </button>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 animate-slide-in-up">
            <select className="input w-auto text-xs py-1" value={filters.stage} onChange={e => setFilter('stage', e.target.value)}>
              <option value="">All Stages</option>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select className="input w-auto text-xs py-1" value={filters.industry} onChange={e => setFilter('industry', e.target.value)}>
              <option value="">All Industries</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select className="input w-auto text-xs py-1" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
              <option value="">All Priorities</option>
              {['Hot','Warm','Cold'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="input w-auto text-xs py-1" value={filters.hasWebsite} onChange={e => setFilter('hasWebsite', e.target.value)}>
              <option value="">Website: Any</option>
              <option value="yes">Has Website</option>
              <option value="no">No Website</option>
            </select>
            {[
              { key: 'stale',   label: '⚠ Stale' },
              { key: 'overdue', label: '🔴 Overdue' },
              { key: 'isNew',   label: '✨ New' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key, !filters[key])}
                className={`btn btn-sm ${filters[key] ? 'btn-primary' : 'btn-ghost'}`}
              >
                {label}
              </button>
            ))}
            <button onClick={() => setFilters({ stage:'',industry:'',priority:'',hasWebsite:'',stale:false,overdue:false,isNew:false,tagged:'' })}
              className="btn btn-ghost btn-sm text-white/40">
              Clear
            </button>
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
            <button onClick={() => handleBulkAction('stage')} disabled={!bulkStage} className="btn btn-ghost btn-xs">Apply Stage</button>
            <select className="input w-auto text-xs py-1" value={bulkService} onChange={e => setBulkService(e.target.value)}>
              <option value="">Change service…</option>
              {Object.entries(SERVICES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => handleBulkAction('service')} disabled={!bulkService} className="btn btn-ghost btn-xs">Apply</button>
            <button onClick={() => handleBulkAction('export')} className="btn btn-ghost btn-xs">Export</button>
            <button onClick={() => handleBulkAction('archive')} className="btn btn-danger btn-xs">Archive</button>
            <button onClick={() => setSelected(new Set())} className="btn btn-ghost btn-xs ml-auto">Deselect</button>
          </div>
        )}
      </div>

      {/* Count */}
      <div className="px-5 py-2 flex-shrink-0">
        <p className="text-xs text-white/30">{rows.length} leads</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-syne font-semibold text-white text-lg mb-1">No leads found</h3>
            <p className="text-white/30 text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-white/[0.05]">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-2 py-3 w-4" />
                <SortTh col="businessName">Business</SortTh>
                <th className="px-3 py-3 text-left text-[10px] text-white/40 font-semibold uppercase tracking-wide">Service</th>
                <SortTh col="stage">Stage</SortTh>
                <SortTh col="priority">Priority</SortTh>
                <SortTh col="ltv">LTV</SortTh>
                <SortTh col="followUpDate">Follow-up</SortTh>
                <SortTh col="lastContacted">Last Contact</SortTh>
                <SortTh col="callAttempts">Calls</SortTh>
                <th className="px-3 py-3 text-left text-[10px] text-white/40 font-semibold uppercase tracking-wide">Flags</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((lead, i) => {
                const flags = computeFlags(lead, {})
                const svc = SERVICES[lead.service]
                const ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
                const stage = STAGES.find(s => s.id === lead.stage)
                const isSelected = selected.has(lead.id)

                return (
                  <tr
                    key={lead.id}
                    className={`border-b border-white/[0.03] cursor-pointer transition-colors card-enter hover:bg-white/[0.03] ${
                      isSelected ? 'bg-white/[0.05]' : ''
                    }`}
                    style={{ animationDelay: `${Math.min(i, 8) * 0.03}s` }}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td className="px-3 py-3" onClick={e => { e.stopPropagation(); toggleOne(lead.id) }}>
                      <input type="checkbox" checked={isSelected} readOnly className="rounded pointer-events-none" />
                    </td>

                    {/* Pin star */}
                    <td className="px-2 py-3">
                      {lead.pinned && <span className="text-[#FFD700] text-xs">★</span>}
                    </td>

                    {/* Business */}
                    <td className="px-3 py-3">
                      <div>
                        <p className="text-sm text-white font-medium">{lead.businessName}</p>
                        {lead.ownerName && <p className="text-xs text-white/40">{lead.ownerName}</p>}
                      </div>
                    </td>

                    {/* Service */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        className="input text-xs py-1"
                        style={{ minWidth: 130 }}
                        value={lead.service}
                        onChange={e => updateLead(lead.id, { service: e.target.value })}
                        onClick={e => e.stopPropagation()}
                      >
                        {Object.entries(SERVICES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>

                    {/* Stage */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        className="input text-xs py-1"
                        style={{ minWidth: 140 }}
                        value={lead.stage}
                        onChange={e => changeStage(lead.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                      >
                        {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>

                    {/* Priority */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        className="input text-xs py-1"
                        style={{ minWidth: 80 }}
                        value={lead.priority}
                        onChange={e => updateLead(lead.id, { priority: e.target.value })}
                        onClick={e => e.stopPropagation()}
                      >
                        {['Hot','Warm','Cold'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>

                    {/* LTV */}
                    <td className="px-3 py-3 text-sm text-white/60 whitespace-nowrap">
                      {ltv > 0 ? formatCurrency(ltv) : '—'}
                    </td>

                    {/* Follow-up */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="date"
                        className="input text-xs py-1"
                        style={{ minWidth: 120 }}
                        value={lead.followUpDate || ''}
                        onChange={e => updateLead(lead.id, { followUpDate: e.target.value })}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>

                    {/* Last contact */}
                    <td className="px-3 py-3 text-xs text-white/40 whitespace-nowrap">
                      {formatRelative(lead.lastContacted)}
                    </td>

                    {/* Call count */}
                    <td className="px-3 py-3 text-xs text-white/40 text-center">
                      {lead.callAttemptCount || 0}
                    </td>

                    {/* Flags */}
                    <td className="px-3 py-3">
                      <FlagDots flags={flags} />
                    </td>

                    {/* Quick actions */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateLead(lead.id, { called: !lead.called })}
                          title="Toggle called"
                          className={`btn btn-xs ${lead.called ? 'bg-[#00FF88]/20 text-[#00FF88]' : 'btn-ghost'}`}
                        >
                          📞
                        </button>
                        <button
                          onClick={() => archiveLead(lead.id)}
                          title="Archive"
                          className="btn btn-xs btn-ghost text-white/30 hover:text-white/60"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="4" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M1 4h10M4 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 4V3a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2"/></svg>
                        </button>
                      </div>
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
