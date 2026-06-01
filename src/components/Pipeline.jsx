import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, HEAT_LEVELS, ACTIVE_STAGE_IDS, WIN_REASONS, LOSS_REASONS,
  computeFlags, getCardGlowClass, computeHeatScore, getHeatLevel, computeUrgency,
  filterByService, formatCurrency, formatRelative, calculateLTV, daysSince, getDaysInStage,
  getActivePipelineMRR, getProjectedMRR,
} from '../utils/helpers'

// ── Heat badge ──
function HeatBadge({ score }) {
  const level = getHeatLevel(score)
  const hl    = HEAT_LEVELS[level]
  return (
    <span className="badge text-[9px] font-bold" style={{ background: hl.bg, color: hl.color }}>
      {hl.emoji} {hl.label}
    </span>
  )
}

// ── Win/Loss reason picker ──
function WinLossPrompt({ stage, onSelect, onSkip }) {
  const reasons = stage === 'closed-won' ? WIN_REASONS : LOSS_REASONS
  const color   = stage === 'closed-won' ? '#00FF88' : '#EF4444'
  const ref     = useRef(null)
  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-50 glass rounded-xl shadow-2xl border border-white/10 min-w-[190px] p-2">
      <p className="text-[10px] text-white/40 px-2 py-1 font-semibold uppercase tracking-wide">
        {stage === 'closed-won' ? 'Why did you win?' : 'Why did you lose?'}
      </p>
      {reasons.map(r => (
        <button key={r.id} onClick={() => onSelect(r.id)}
          className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/[0.07] rounded-lg transition-colors"
          style={{ color }}>
          {r.label}
        </button>
      ))}
      <button onClick={onSkip} className="w-full text-left px-3 py-1.5 text-[11px] text-white/25 hover:text-white/50">Skip</button>
    </div>
  )
}

// ── Quick log bar (one-tap) ──
function QuickLogBar({ lead, quickLog }) {
  const BTNS = [
    { type: 'called',         icon: '📞' },
    { type: 'no-answer',      icon: '📵' },
    { type: 'callback',       icon: '🔁' },
    { type: 'not-interested', icon: '🚫' },
  ]
  return (
    <div className="flex gap-1 justify-center">
      {BTNS.map(b => (
        <button key={b.type} title={b.type}
          onClick={e => { e.stopPropagation(); quickLog(lead.id, b.type) }}
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs hover:bg-white/15 transition-colors"
        >{b.icon}</button>
      ))}
    </div>
  )
}

// ── Lead card ──
function KanbanCard({ lead, settings, isDragging, quickLog, setWinLossReason }) {
  const navigate     = useNavigate()
  const flags        = computeFlags(lead, settings)
  const glow         = getCardGlowClass(flags)
  const svc          = SERVICES[lead.service]
  const ltv          = calculateLTV(lead.monthlyFee, lead.setupFee)
  const sinceContact = daysSince(lead.lastContacted)
  const daysInStage  = getDaysInStage(lead)
  const heatScore    = computeHeatScore(lead)
  const urgency      = computeUrgency(lead)
  const [showWinLoss, setShowWinLoss] = useState(false)

  const relativeContact = sinceContact === null ? 'Never touched'
    : sinceContact === 0 ? 'Touched today'
    : sinceContact === 1 ? 'Touched yesterday'
    : `Touched ${sinceContact}d ago`

  return (
    <div
      className={`glass rounded-xl p-3 cursor-pointer select-none border-l-[3px] transition-shadow group ${isDragging ? 'opacity-0' : ''} ${glow}`}
      style={{ borderLeftColor: svc?.color || '#555' }}
      onClick={() => navigate(`/leads/${lead.id}`)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {lead.pinned && <span className="text-[#FFD700] text-xs mr-1">★</span>}
          <p className="text-white text-sm font-semibold leading-tight truncate">{lead.businessName}</p>
          {lead.ownerName && <p className="text-white/40 text-xs truncate mt-0.5">{lead.ownerName}</p>}
        </div>
        <HeatBadge score={heatScore} />
      </div>

      {/* Urgency badge */}
      {urgency && (
        <div className="mb-2">
          <span
            className="badge text-[9px] font-semibold"
            style={{
              background: urgency.color + '20',
              color: urgency.color,
              animation: urgency.pulse ? 'pulseOverdue 2s ease-in-out infinite' : undefined,
            }}
          >
            {urgency.label}
          </span>
        </div>
      )}

      {/* Deal value */}
      <div className="flex items-center justify-between mb-2">
        {ltv > 0 ? (
          <span className="text-[11px] font-semibold text-[#00FF88]">{formatCurrency(ltv)}</span>
        ) : (
          <span className="text-[10px] text-white/20">No value set</span>
        )}
        <span className="badge text-[9px]" style={{ background: svc?.color + '22', color: svc?.color }}>
          {svc?.label}
        </span>
      </div>

      {/* Last touched + days in stage */}
      <div className="flex items-center justify-between text-[10px] text-white/25 mb-2">
        <span>{relativeContact}</span>
        <span>{daysInStage}d in stage</span>
      </div>

      {/* One-tap quick log — visible on hover */}
      <div
        className="mt-2 pt-2 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <QuickLogBar lead={lead} quickLog={quickLog} />
      </div>
    </div>
  )
}

// ── Draggable wrapper ──
function DraggableCard({ lead, settings, quickLog, setWinLossReason }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? 'dragging-card' : ''}>
      <KanbanCard lead={lead} settings={settings} isDragging={isDragging} quickLog={quickLog} setWinLossReason={setWinLossReason} />
    </div>
  )
}

// ── Droppable column ──
function KanbanColumn({ stage, cards, settings, activeId, quickLog, setWinLossReason }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id })
  const isDropTarget = isOver && activeId
  const colMRR = cards.reduce((s,l) => s + (parseFloat(l.monthlyFee) || 0), 0)

  return (
    <div className="flex-shrink-0 w-[240px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
          <h3 className="font-syne font-semibold text-white/70 text-xs uppercase tracking-wide">{stage.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {colMRR > 0 && <span className="text-[10px] text-white/25">{formatCurrency(colMRR)}/mo</span>}
          <span className="text-xs text-white/30 font-mono">{cards.length}</span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[120px] rounded-2xl p-2 space-y-2 border transition-all duration-150 ${isDropTarget ? 'drop-zone-active' : 'border-transparent'}`}
        style={{ background: isDropTarget ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.008)' }}
      >
        {[...cards.filter(c => c.pinned), ...cards.filter(c => !c.pinned)].map(lead => (
          <DraggableCard key={lead.id} lead={lead} settings={settings} quickLog={quickLog} setWinLossReason={setWinLossReason} />
        ))}
        {cards.length === 0 && (
          <div className={`h-16 rounded-xl flex items-center justify-center border-dashed border transition-colors ${isDropTarget ? 'border-white/30' : 'border-white/[0.06]'}`}>
            <p className="text-white/20 text-xs">Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Revenue projection bar ──
function RevenueBar({ leads, settings, updateSettings }) {
  const [editRate, setEditRate] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const projRate   = settings.projectionRate || 30
  const activeMRR  = useMemo(() => getActivePipelineMRR(leads), [leads])
  const projected  = useMemo(() => getProjectedMRR(leads, projRate), [leads, projRate])

  const saveRate = () => {
    const val = parseInt(rateInput)
    if (val > 0 && val <= 100) updateSettings({ projectionRate: val })
    setEditRate(false)
  }

  return (
    <div className="mx-5 mt-4 glass rounded-2xl px-5 py-4 flex items-center gap-8 flex-wrap"
      style={{ borderColor: 'rgba(0,255,136,0.1)' }}>
      <div>
        <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">Pipeline MRR Potential</p>
        <p className="font-syne font-bold text-white text-lg">
          {formatCurrency(activeMRR)}<span className="text-white/30 text-sm font-normal">/mo</span>
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">all active leads</p>
      </div>

      <div className="w-px h-8 bg-white/10 hidden lg:block" />

      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
            If You Close{' '}
            {editRate ? (
              <input autoFocus type="number" min="1" max="100" className="input text-xs py-0.5 w-12 text-center inline-block"
                value={rateInput} onChange={e => setRateInput(e.target.value)}
                onBlur={saveRate}
                onKeyDown={e => { if (e.key === 'Enter') saveRate(); if (e.key === 'Escape') setEditRate(false) }}
              />
            ) : (
              <button className="underline decoration-dotted hover:text-white/70" onClick={() => { setEditRate(true); setRateInput(String(projRate)) }}>
                {projRate}%
              </button>
            )}
          </p>
        </div>
        <p className="font-syne font-bold text-lg" style={{ color: '#00FF88' }}>
          {formatCurrency(projected)}<span className="text-[#00FF88]/40 text-sm font-normal">/mo</span>
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">projected revenue</p>
      </div>
    </div>
  )
}

// ── Main Pipeline ──
export default function Pipeline() {
  const { leads, settings, serviceFilter, changeStage, quickLog, setWinLossReason, updateSettings } = useCRM()
  const [activeId, setActiveId]     = useState(null)
  const [showClosed, setShowClosed] = useState(false)

  const filtered = useMemo(() =>
    filterByService(leads.filter(l => !l.archived), serviceFilter),
    [leads, serviceFilter]
  )

  const visibleStages = useMemo(() =>
    showClosed ? STAGES : STAGES.filter(s => s.id !== 'closed-lost' && s.id !== 'do-not-call'),
    [showClosed]
  )

  const cardsByStage = useMemo(() => {
    const map = {}
    STAGES.forEach(s => { map[s.id] = [] })
    filtered.forEach(l => { if (map[l.stage]) map[l.stage].push(l) })
    return map
  }, [filtered])

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null
  const activeCount = ACTIVE_STAGE_IDS.reduce((s,id) => s + (cardsByStage[id]?.length || 0), 0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const handleDragStart = ({ active }) => setActiveId(active.id)
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const fromLead = leads.find(l => l.id === active.id)
    if (!fromLead) return
    const toStage = STAGES.find(s => s.id === over.id)
    if (!toStage || fromLead.stage === toStage.id) return
    changeStage(fromLead.id, toStage.id)
    if (toStage.id === 'closed-won' || toStage.id === 'closed-lost') {
      // Win/loss prompt handled in card component for drag
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] flex-shrink-0">
        <div>
          <h1 className="font-syne font-bold text-white text-xl">Pipeline</h1>
          <p className="text-white/30 text-xs mt-0.5">{activeCount} active leads</p>
        </div>
        <button onClick={() => setShowClosed(s => !s)}
          className={`btn btn-ghost btn-sm text-xs ${showClosed ? 'text-white/60' : 'text-white/30'}`}>
          {showClosed ? 'Hide Closed' : 'Show Closed'}
        </button>
      </div>

      {/* Revenue projection bar */}
      <RevenueBar leads={filtered} settings={settings} updateSettings={updateSettings} />

      {/* Board */}
      <div className="flex-1 overflow-x-auto kanban-scroll p-5">
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max pb-4">
            {visibleStages.map(stage => (
              <KanbanColumn key={stage.id} stage={stage}
                cards={cardsByStage[stage.id] || []}
                settings={settings} activeId={activeId}
                quickLog={quickLog} setWinLossReason={setWinLossReason}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeLead && (
              <div className="drag-overlay-card w-[240px]">
                <KanbanCard lead={activeLead} settings={settings} quickLog={quickLog} setWinLossReason={setWinLossReason} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
