import React, { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { exportLeadsToCSV } from '../utils/csvUtils'

export default function Settings() {
  const { settings, updateSettings, leads, clearAll, openModal, addToast } = useCRM()
  const [form, setForm] = useState({ ...settings })
  const [confirmClear, setConfirmClear] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    updateSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    addToast('Settings saved', 'success')
  }

  const handleClearAll = () => {
    clearAll()
    setConfirmClear(false)
  }

  return (
    <div className="p-5 lg:p-6 space-y-6 pb-24 lg:pb-6 max-w-xl">
      <h1 className="font-syne font-bold text-white text-2xl">Settings</h1>

      {/* Revenue goal */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-syne font-semibold text-white text-base">Revenue Goal</h2>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide font-medium">
            Monthly Revenue Goal ($)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">$</span>
            <input
              className="input pl-7"
              type="number"
              min="0"
              placeholder="e.g. 10000"
              value={form.monthlyGoal || ''}
              onChange={e => set('monthlyGoal', parseFloat(e.target.value) || 0)}
            />
          </div>
          <p className="text-xs text-white/30 mt-1.5">Shown as a progress bar on the dashboard</p>
        </div>
      </div>

      {/* Smart flag thresholds */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-syne font-semibold text-white text-base">Smart Flag Thresholds</h2>

        <div>
          <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide font-medium">
            Stale Lead Threshold (days)
          </label>
          <input
            className="input"
            type="number"
            min="1"
            max="365"
            value={form.staleThreshold}
            onChange={e => set('staleThreshold', parseInt(e.target.value) || 7)}
          />
          <p className="text-xs text-white/30 mt-1.5">No activity for this many days → "Stale" flag</p>
        </div>

        <div>
          <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide font-medium">
            Gone Cold Threshold (days)
          </label>
          <input
            className="input"
            type="number"
            min="1"
            max="365"
            value={form.coldThreshold}
            onChange={e => set('coldThreshold', parseInt(e.target.value) || 5)}
          />
          <p className="text-xs text-white/30 mt-1.5">Hot leads with no activity for this many days → "Gone Cold" flag</p>
        </div>
      </div>

      {/* Save button */}
      <button onClick={handleSave} className="btn btn-primary w-full py-3">
        {saved ? '✓ Saved!' : 'Save Settings'}
      </button>

      {/* Data management */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <h2 className="font-syne font-semibold text-white text-base">Data Management</h2>
        <p className="text-xs text-white/40">
          All data is stored locally in your browser. Nothing is sent to any server.
          You have {leads.filter(l => !l.archived).length} active leads and {leads.filter(l => l.archived).length} archived.
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={() => exportLeadsToCSV(leads)}
            className="btn btn-ghost w-full"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M5 8l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export All Data to CSV
          </button>

          <button
            onClick={() => openModal('csvImport')}
            className="btn btn-ghost w-full"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 11V2M5 5l3-3 3 3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Import CSV
          </button>

          <button
            onClick={() => setConfirmClear(true)}
            className="btn btn-danger w-full mt-1"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 5h10M6 5V3h4v2M6 8v4M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="2" y="5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Clear All Data
          </button>
        </div>
      </div>

      {/* About */}
      <div className="glass rounded-2xl p-5">
        <h2 className="font-syne font-semibold text-white text-base mb-2">About Park CRM</h2>
        <p className="text-xs text-white/30 leading-relaxed">
          A personal sales organization tool for tracking cold call leads across AI Website and AI Receptionist services.
          Built with React + Tailwind. 100% local — no account, no servers, no tracking.
        </p>
        <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-1">
          <p className="text-xs text-white/20">Keyboard shortcuts: <span className="kbd">N</span> New · <span className="kbd">/</span> Search · <span className="kbd">D</span> Dashboard · <span className="kbd">P</span> Pipeline · <span className="kbd">L</span> List · <span className="kbd">T</span> Tasks</p>
        </div>
      </div>

      {/* Confirm clear modal */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full animate-fade-scale" onClick={e => e.stopPropagation()}>
            <h3 className="font-syne font-bold text-white text-lg mb-2">Clear All Data?</h3>
            <p className="text-white/50 text-sm mb-5">
              This will permanently delete all {leads.length} leads. This cannot be undone.
              Make sure to export first.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleClearAll} className="btn btn-danger flex-1">Clear Everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
