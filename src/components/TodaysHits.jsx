import React, { useState, useMemo } from 'react'
import { useCRM } from '../context/CRMContext'
import { getCallsToday, computeStreak } from '../utils/helpers'

export default function TodaysHits() {
  const { leads, settings, updateSettings } = useCRM()
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const dailyTarget  = settings.dailyTarget || 20
  const callsToday   = useMemo(() => getCallsToday(leads), [leads])
  const streak       = useMemo(() => computeStreak(leads, dailyTarget), [leads, dailyTarget])
  const pct          = Math.min(100, dailyTarget > 0 ? Math.round((callsToday / dailyTarget) * 100) : 0)
  const isComplete   = callsToday >= dailyTarget

  const saveTarget = () => {
    const val = parseInt(targetInput)
    if (val > 0) updateSettings({ dailyTarget: val })
    setEditingTarget(false)
  }

  return (
    <div
      className="glass rounded-2xl p-4 border"
      style={{ borderColor: isComplete ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-white">
            Today's Hits:{' '}
            <span style={{ color: isComplete ? '#00FF88' : '#fff' }} className="font-bold">{callsToday}</span>
            <span className="text-white/35"> / {dailyTarget} calls</span>
          </span>
          {streak > 0 && (
            <span className="badge text-[11px]" style={{ background: 'rgba(255,107,0,0.15)', color: '#FF6B00' }}>
              🔥 {streak}-day streak
            </span>
          )}
          {isComplete && (
            <span className="badge text-[11px]" style={{ background: 'rgba(0,255,136,0.12)', color: '#00FF88' }}>
              🎯 Crushed it!
            </span>
          )}
        </div>

        {editingTarget ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus type="number" min="1" max="200"
              className="input text-xs py-1 w-16 text-center"
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              onBlur={saveTarget}
              onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditingTarget(false) }}
            />
            <button onClick={saveTarget} className="btn btn-ghost btn-xs">✓</button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingTarget(true); setTargetInput(String(dailyTarget)) }}
            className="text-white/25 hover:text-white/60 text-sm transition-colors"
            title="Edit daily target"
          >⚙</button>
        )}
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${pct}%`,
            background: isComplete
              ? '#00FF88'
              : pct >= 70 ? '#0088FF' : '#F59E0B',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}
