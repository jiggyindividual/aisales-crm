import React from 'react'
import { useCRM } from '../context/CRMContext'

const STEPS = [
  { key: 'addedFirstLead',  label: 'Add your first lead',         icon: '👤' },
  { key: 'importedCSV',     label: 'Import a CSV',                icon: '📥' },
  { key: 'setRevenueGoal',  label: 'Set your monthly revenue goal', icon: '🎯' },
]

export default function Onboarding() {
  const { onboarding, dismissOnboarding, openModal } = useCRM()
  if (!onboarding) return null

  const allDone = STEPS.every(s => onboarding[s.key])
  if (allDone || onboarding.dismissed) return null

  const done = STEPS.filter(s => onboarding[s.key]).length
  const pct  = Math.round((done / STEPS.length) * 100)

  return (
    <div className="glass rounded-2xl p-5 border border-white/10 animate-fade-scale">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-syne font-semibold text-white text-sm">Getting Started</h3>
          <p className="text-xs text-white/40 mt-0.5">{done} of {STEPS.length} complete</p>
        </div>
        <button
          onClick={dismissOnboarding}
          className="text-white/30 hover:text-white/60 transition-colors text-xs"
        >
          Dismiss
        </button>
      </div>

      <div className="progress-bar mb-4">
        <div className="progress-fill bg-white/30" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2">
        {STEPS.map(step => (
          <div
            key={step.key}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              onboarding[step.key]
                ? 'opacity-50'
                : 'bg-white/[0.03] cursor-pointer hover:bg-white/[0.06]'
            }`}
            onClick={() => {
              if (onboarding[step.key]) return
              if (step.key === 'importedCSV') openModal('csvImport')
              if (step.key === 'addedFirstLead') openModal('quickAdd')
            }}
          >
            <span className="text-lg">{step.icon}</span>
            <span className="text-sm text-white/80 flex-1">{step.label}</span>
            {onboarding[step.key] ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3.5 3.5L13 4" stroke="#00FF88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/20" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
