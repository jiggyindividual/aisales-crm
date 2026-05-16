import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  PointerSensor, TouchSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, PRIORITY_COLORS, HEAT_LEVELS, ACTION_TYPES, ACTIVE_STAGE_IDS,
  computeFlags, getCardGlowClass, computeHeatScore, getHeatLevel,
  filterByService, formatCurrency, formatRelative, calculateLTV, daysSince, getDaysInStage,
} from '../utils/helpers'

/* ── Heat badge ── */
function HeatBadge({ score }) {
  const level = getHeatLevel(score)
  const hl = HEAT_LEVELS[level]
  return (
    <span className="badge text-[9px] font-bold" style={{ background: hl.bg, color: hl.color }}>
      {hl.emoji} {hl.label}
    </span>
  )
}

/* ── Flag chips ── */
function FlagChips({ flags }) {
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(f => (
        <span
          key={f.type}
          className="badge text-[9px]"
          style={{
            background: f.color + '22', color: f.color,
            animation: (f.type === 'overdue' || f.type === 'action-overdue') ? 'pulseOverdue 2s ease-in-out infinite' : undefined,
          }}
        >
          {f.label}
        </span>
      ))}
    </div>
  )
}

/* ── Lead card ── */
function KanbanCard({ lead, settings, isDragging }) {
  const navigate = useNavigate()
  const flags        = computeFlags(lead, settings)
  const glow         = getCardGlowClass(flags)
  const svc          = SERVICES[lead.service]
  const ltv          = calculateLTV(lead.monthlyFee, lead.setupFee)
  const sinceContact = daysSince(lead.lastContacted)
  const daysInStage  = getDaysInStage(lead)
  const heatScore    = computeHeatScore(lead)
  const actionType   = ACTION_TYPES.find(a => a.id === lead.nextActionType)
  const actionOverdue = lead.nextActionDueAt && daysSince(lead.nextActionDueAt) > 0

  return (
    <div
      className={`glass rounded-xl p-3 cursor-pointer select-none border-l-[3px] transition-shadow hover:border-white/10 ${isDragging ? 'opacity-0' : ''} ${glow}`}
      style={{ borderLeftColor: svc?.color || '#555' }}
      onClick={() => navigate(`/leads/${lead.id}`)}
    >
      {/* Top row: name + heat badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {lead.pinned && <span className="text-[#FFD700] text-xs mr-1">★</span>}
          <p className="text-white text-sm font-semibold leading-tight truncate">{lead.businessName}</p>
          {lead.ownerName && <p className="text-white/40 text-xs truncate mt-0.5">{lead.ownerName}</p>}
        </div>
        <HeatBadge score={heatScore} />
      </div>

      {/* Flags */}
      {flags.length > 0 && <div className="mb-2"><FlagChips flags={flags} /></div>}

      {/* Next action */}
      {actionType ? (
        <div className={`flex items-center gap-1.5 mb-2 py-1.5 px-2.5 rounded-lg text-[10px] font-medium ${
          actionOverdue ? 'bg-[#FF3B3B]/10 text-[#FF3B3B]' : 'bg-white/[0.05] text-white/50'
        }`}>
          <span>{actionType.icon}</span>
          <span>{actionType.label}</span>
          {actionOverdue && <span className="ml-auto font-bold">OVERDUE</span>}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2 py-1.5 px-2.5 rounded-lg text-[10px] bg-[#FF9500]/8 text-[#FF9500]/70">
          <span>⚠</span>
          <span>No next action</span>
        </div>
      )}

      {/* Deal value + service */}
      <div className="flex items-center justify-between mb-2">
        {ltv > 0 ? (
          <span className="text-[11px] font-semibold text-[#00FF88]">{formatCurrency(ltv)}</span>
        ) : (
          <span className="text-[10px] text-white/20">No deal value</span>
        )}
        <span className="badge text-[9px]" style={{ background: svc?.color + '22', color: svc?.color }}>
          {svc?.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
        <span className="text-[10px] text-white/25">
          {sinceContact !== null ? `${sinceContact}d ago` : 'Never contacted'}
        </span>
        <span className="text-[10px] text-white/20">
          {daysInStage}d in stage
        </span>
        {lead.callAttemptCount > 0 && (
          <span className="text-[10px] text-white/25">📞 {lead.callAttemptCount}</span>
        )}
      </div>
    </div>
  )
}

/* ── Draggable wrapper ── */
function DraggableCard({ lead, settings }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? 'dragging-card' : ''}>
      <KanbanCard lead={lead} settings={settings} isDragging={isDragging} />
    </div>
  )
}

/* ── Droppable column ── */
function KanbanColumn({ stage, cards, settings, activeId }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id })
  const isDropTarget = isOver && activeId
  const colValue = cards.reduce((s,l) => s + calculateLTV(l.monthlyFee, l.setupFee), 0)

  return (
    <div className="flex-shrink-0 w-[240px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
          <h3 className="font-syne font-semibold text-white/70 text-xs uppercase tracking-wide">{stage.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {colValue > 0 && (
            <span className="text-[10px] text-white/25 font-mono">{formatCurrency(colValue)}</span>
          )}
          <span className="text-xs text-white/30 font-mono">{cards.length}</span>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`min-h-[120px] rounded-2xl p-2 space-y-2 border transition-all duration-150 ${isDropTarget ? 'drop-zone-active' : 'border-transparent'}`}
        style={{ background: isDropTarget ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.008)' }}
      >
        {/* Pinned first */}
        {[...cards.filter(c => c.pinned), ...cards.filter(c => !c.pinned)].map(lead => (
          <DraggableCard key={lead.id} lead={lead} settings={settings} />
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

export default function Pipeline() {
  const { leads, settings, serviceFilter, changeStage } = useCRM()
  const [activeId, setActiveId] = useState(null)
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

  const totalPipelineVal = useMemo(() =>
    ACTIVE_STAGE_IDS.reduce((s,id) => s + (cardsByStage[id]||[]).reduce((ss,l) => ss + calculateLTV(l.monthlyFee,l.setupFee), 0), 0),
    [cardsByStage]
  )

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
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05] flex-shrink-0">
        <div>
          <h1 className="font-syne font-bold text-white text-xl">Pipeline</h1>
          <p className="text-white/30 text-xs mt-0.5">
            {filtered.filter(l => ACTIVE_STAGE_IDS.includes(l.stage)).length} active · {formatCurrency(totalPipelineVal)} total value
          </p>
        </div>
        <button
          onClick={() => setShowClosed(s => !s)}
          className={`btn btn-ghost btn-sm text-xs ${showClosed ? 'text-white/60' : 'text-white/30'}`}
        >
          {showClosed ? 'Hide Closed' : 'Show Closed'}
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto kanban-scroll p-5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max pb-4">
            {visibleStages.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                cards={cardsByStage[stage.id] || []}
                settings={settings}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeLead && (
              <div className="drag-overlay-card w-[240px]">
                <KanbanCard lead={activeLead} settings={settings} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
