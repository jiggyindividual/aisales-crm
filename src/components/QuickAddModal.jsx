import React, { useState, useEffect, useRef } from 'react'
import { useCRM } from '../context/CRMContext'
import { STAGES, SERVICES, ACTION_TYPES } from '../utils/helpers'

export default function QuickAddModal({ onClose }) {
  const { addLead } = useCRM()
  const firstRef = useRef(null)
  const [form, setForm] = useState({
    businessName:    '',
    ownerName:       '',
    phone:           '',
    service:         'ai-website',
    stage:           'cold',
    priority:        'Cold',
    closeProbability: 25,
    nextActionType:  '',
  })

  useEffect(() => {
    firstRef.current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.businessName.trim()) { firstRef.current?.focus(); return }
    addLead({ ...form })
    onClose()
  }

  return (
    <div className="modal-overlay bottom-sheet" onClick={onClose}>
      <div className="modal-content glass rounded-2xl p-6 w-full max-w-md animate-fade-scale" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-syne font-bold text-white text-lg">Quick Add Lead</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 mb-1 block font-semibold uppercase tracking-wide">Business Name *</label>
            <input
              ref={firstRef}
              className="input"
              placeholder="e.g. Tony's Pizza"
              value={form.businessName}
              onChange={e => set('businessName', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block font-semibold uppercase tracking-wide">Contact Name</label>
              <input className="input" placeholder="Tony Romano" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block font-semibold uppercase tracking-wide">Phone</label>
              <input className="input" placeholder="(555) 000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block font-semibold uppercase tracking-wide">Service</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(SERVICES).map(([key, svc]) => (
                <button
                  key={key}
                  onClick={() => set('service', key)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    form.service === key ? 'text-black border-transparent' : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                  }`}
                  style={form.service === key ? { background: svc.color } : {}}
                >
                  {svc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block font-semibold uppercase tracking-wide">Stage</label>
              <select className="input" value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block font-semibold uppercase tracking-wide">Priority</label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {['Hot','Warm','Cold'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Close probability */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-white/40 font-semibold uppercase tracking-wide">Close Probability</label>
              <span className="text-xs font-bold text-white">{form.closeProbability}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="5"
              value={form.closeProbability}
              onChange={e => set('closeProbability', parseInt(e.target.value))}
              className="w-full accent-white"
            />
          </div>

          {/* Next action */}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block font-semibold uppercase tracking-wide">First Action</label>
            <div className="flex flex-wrap gap-1.5">
              {ACTION_TYPES.slice(0, 5).map(a => (
                <button
                  key={a.id}
                  onClick={() => set('nextActionType', form.nextActionType === a.id ? '' : a.id)}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.nextActionType === a.id ? 'bg-white text-black border-transparent' : 'border-white/[0.08] text-white/40 hover:border-white/20'
                  }`}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary flex-1">Save Lead</button>
        </div>

        <p className="text-center text-white/20 text-xs mt-3">
          Press <span className="kbd">Enter</span> to save · <span className="kbd">Esc</span> to close
        </p>
      </div>
    </div>
  )
}
