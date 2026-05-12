import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import { SERVICES, formatDate, formatRelative, daysSince, isFollowUpToday, isFollowUpOverdue, computeFlags } from '../utils/helpers'

export default function DailyTasks() {
  const { leads, updateLead, logActivity, addToast } = useCRM()
  const navigate = useNavigate()

  const today = new Date(); today.setHours(0,0,0,0)

  const tasks = useMemo(() => {
    const all = leads.filter(l => !l.archived && l.followUpDate)
    const fu = new Date()
    return all.filter(l => {
      const d = new Date(l.followUpDate); d.setHours(0,0,0,0)
      return d <= today
    }).sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate))
  }, [leads])

  const overdue  = tasks.filter(l => isFollowUpOverdue(l.followUpDate))
  const dueToday = tasks.filter(l => isFollowUpToday(l.followUpDate))

  const handleCall = (lead) => {
    logActivity(lead.id, { type: 'call', outcome: 'Answered', notes: 'Quick logged from task view' })
    addToast('Call logged', 'success')
  }

  const completeFU = (lead) => {
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    updateLead(lead.id, { followUpDate: nextWeek.toISOString().slice(0, 10) })
    addToast('Follow-up rescheduled +7 days', 'info')
  }

  const clearFU = (lead) => {
    updateLead(lead.id, { followUpDate: '' })
    addToast('Follow-up cleared', 'success')
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="font-syne font-bold text-white text-2xl mb-2">You're all caught up!</h2>
        <p className="text-white/40 text-sm max-w-xs">No follow-ups due today. Go close some deals.</p>
      </div>
    )
  }

  function TaskCard({ lead, isOverdue }) {
    const flags = computeFlags(lead, {})
    const svc = SERVICES[lead.service]
    const overdueDays = isOverdue ? daysSince(lead.followUpDate) : 0

    return (
      <div
        className={`glass rounded-2xl p-4 border-l-2 transition-all hover:border-white/15 cursor-pointer ${
          isOverdue ? 'border-l-[#FF3B3B]' : 'border-l-[#0088FF]'
        }`}
        onClick={() => navigate(`/leads/${lead.id}`)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-white">{lead.businessName}</span>
              <span className="badge text-[9px]" style={{ background: svc?.color + '22', color: svc?.color }}>
                {svc?.label}
              </span>
              {isOverdue && (
                <span className="badge text-[9px] animate-pulse-overdue" style={{ background: '#FF3B3B22', color: '#FF3B3B' }}>
                  {overdueDays}d overdue
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-white/40">
              {lead.phone && <span>📞 {lead.phone}</span>}
              <span>Last: {formatRelative(lead.lastContacted)}</span>
              {lead.callAttemptCount > 0 && <span>{lead.callAttemptCount} calls</span>}
            </div>

            {lead.notes && (
              <p className="text-xs text-white/30 mt-2 line-clamp-1">"{lead.notes}"</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => handleCall(lead)}
              className="btn btn-xs bg-[#0088FF]/20 text-[#0088FF] hover:bg-[#0088FF]/30"
            >
              📞 Call
            </button>
            <button
              onClick={() => clearFU(lead)}
              className="btn btn-xs btn-ghost text-white/40"
            >
              ✓ Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-syne font-bold text-white text-2xl">Daily Tasks</h1>
        <span className="badge" style={{ background: '#FF3B3B22', color: '#FF3B3B', fontSize: 12 }}>
          {tasks.length} due
        </span>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <h2 className="font-syne font-semibold text-[#FF3B3B] text-sm mb-3 uppercase tracking-wide">
            🔴 Overdue ({overdue.length})
          </h2>
          <div className="space-y-3">
            {overdue.map(l => <TaskCard key={l.id} lead={l} isOverdue />)}
          </div>
        </section>
      )}

      {/* Due today */}
      {dueToday.length > 0 && (
        <section>
          <h2 className="font-syne font-semibold text-[#0088FF] text-sm mb-3 uppercase tracking-wide">
            📅 Due Today ({dueToday.length})
          </h2>
          <div className="space-y-3">
            {dueToday.map(l => <TaskCard key={l.id} lead={l} isOverdue={false} />)}
          </div>
        </section>
      )}
    </div>
  )
}
