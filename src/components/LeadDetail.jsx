import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, INDUSTRIES, LEAD_SOURCES, PRIORITIES, PRIORITY_COLORS, CALL_OUTCOMES,
  computeFlags, calculateLTV, formatCurrency, formatDate, formatRelative, formatTime,
  daysSince, getStage,
} from '../utils/helpers'

/* ── Activity type icons ── */
function ActivityIcon({ type }) {
  if (type === 'call')  return <span className="text-[#0088FF]">📞</span>
  if (type === 'email') return <span className="text-[#00FF88]">✉️</span>
  return <span className="text-white/40">📝</span>
}

/* ── Field wrapper ── */
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-1 block font-medium uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

/* ── Log activity modal ── */
function LogActivityModal({ type, onSave, onClose }) {
  const [form, setForm] = useState({
    type,
    date: new Date().toISOString().slice(0, 10),
    outcome: 'Answered',
    subject: '',
    notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass rounded-2xl p-6 w-full max-w-md animate-fade-scale" onClick={e => e.stopPropagation()}>
        <h3 className="font-syne font-bold text-white text-lg mb-4 capitalize">
          Log {type === 'note' ? 'a Note' : `a ${type.charAt(0).toUpperCase()+type.slice(1)}`}
        </h3>
        <div className="space-y-3">
          <Field label="Date">
            <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          {type === 'call' && (
            <Field label="Outcome">
              <div className="grid grid-cols-3 gap-2">
                {CALL_OUTCOMES.map(o => (
                  <button key={o} onClick={() => set('outcome', o)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      form.outcome === o ? 'bg-white text-black border-transparent' : 'border-white/10 text-white/50 hover:border-white/25'
                    }`}
                  >{o}</button>
                ))}
              </div>
            </Field>
          )}
          {type === 'email' && (
            <Field label="Subject">
              <input className="input" placeholder="Email subject…" value={form.subject} onChange={e => set('subject', e.target.value)} />
            </Field>
          )}
          <Field label="Notes">
            <textarea className="input resize-none" rows={3} placeholder="Add notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={() => onSave(form)} className="btn btn-primary flex-1">Save</button>
        </div>
      </div>
    </div>
  )
}

/* ── Stage history ── */
function StageHistory({ history }) {
  return (
    <div className="space-y-2">
      {[...(history || [])].reverse().map((entry, i) => {
        const stage = STAGES.find(s => s.id === entry.stage)
        return (
          <div key={i} className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: stage?.color || '#555' }} />
            <div>
              <p className="text-xs text-white/60">{stage?.label || entry.stage}</p>
              <p className="text-[10px] text-white/30">{formatDate(entry.timestamp)} {formatTime(entry.timestamp)}</p>
              {entry.note && <p className="text-[10px] text-white/40 mt-0.5 italic">"{entry.note}"</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { leads, updateLead, changeStage, logActivity, archiveLead, addToast } = useCRM()

  const lead = leads.find(l => l.id === id)

  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)
  const [activityModal, setActivityModal] = useState(null) // 'call' | 'email' | 'note'
  const [newTag, setNewTag] = useState('')
  const [activeTab, setActiveTab] = useState('details') // 'details' | 'activity' | 'history'
  const saveTimer = useRef(null)

  useEffect(() => {
    if (lead) setForm({ ...lead })
  }, [id])

  useEffect(() => {
    if (!form || !lead) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateLead(lead.id, form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [form])

  const set = useCallback((k, v) => setForm(f => f ? { ...f, [k]: v } : f), [])

  const handleStageSave = (newStage) => {
    set('stage', newStage)
    changeStage(lead.id, newStage)
  }

  const handleActivitySave = (activity) => {
    logActivity(lead.id, {
      ...activity,
      date: new Date(activity.date).toISOString(),
    })
    setActivityModal(null)
    addToast(`${activity.type.charAt(0).toUpperCase()+activity.type.slice(1)} logged`, 'success')
  }

  const addTag = () => {
    const tag = newTag.trim()
    if (!tag || form.tags?.includes(tag)) return
    set('tags', [...(form.tags || []), tag])
    setNewTag('')
  }

  const removeTag = (tag) => set('tags', (form.tags || []).filter(t => t !== tag))

  const ltv = form ? calculateLTV(form.monthlyFee, form.setupFee) : 0
  const flags = lead ? computeFlags(lead, {}) : []
  const sinceContact = lead ? daysSince(lead.lastContacted) : null
  const svc = form ? SERVICES[form.service] : null

  if (!lead || !form) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_,i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
      </div>
    )
  }

  const activities = [...(lead.activities || [])].reverse()

  return (
    <div className="min-h-full pb-24 lg:pb-6">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-white/[0.05] px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 5L7 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {form.pinned && <span className="text-[#FFD700]">★</span>}
            <h1 className="font-syne font-bold text-white text-lg truncate">{form.businessName || 'Untitled Lead'}</h1>
          </div>
          <p className="text-white/40 text-xs">{form.ownerName}</p>
        </div>

        {/* Save indicator */}
        <div className={`flex items-center gap-1.5 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'} save-flash`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#00FF88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-xs text-[#00FF88]">Saved</span>
        </div>

        {/* Pin / Archive */}
        <button
          onClick={() => set('pinned', !form.pinned)}
          className={`btn btn-ghost btn-sm ${form.pinned ? 'text-[#FFD700]' : 'text-white/30'}`}
          title="Pin lead"
        >★</button>
        <button
          onClick={() => { archiveLead(lead.id); navigate(-1) }}
          className="btn btn-ghost btn-sm text-white/30"
          title="Archive lead"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5h12M5 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M3 5V4a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3"/></svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* ── Smart flags ── */}
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {flags.map(f => (
              <span key={f.type} className="badge" style={{ background: f.color + '22', color: f.color, fontSize: 11 }}>
                {f.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3 text-center">
            <p className="font-syne font-bold text-white text-xl">{lead.callAttemptCount || 0}</p>
            <p className="text-xs text-white/40">Call Attempts</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="font-syne font-bold text-white text-xl">{sinceContact !== null ? `${sinceContact}d` : '—'}</p>
            <p className="text-xs text-white/40">Since Contact</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="font-syne font-bold text-white text-xl" style={{ color: '#00FF88' }}>{formatCurrency(ltv)}</p>
            <p className="text-xs text-white/40">LTV</p>
          </div>
        </div>

        {/* ── Service & Stage ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-4">
            <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide font-medium">Service</label>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(SERVICES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => set('service', k)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-2 ${
                    form.service === k ? 'text-black border-transparent' : 'border-white/[0.08] text-white/40 hover:border-white/20'
                  }`}
                  style={form.service === k ? { background: v.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: v.color, opacity: form.service === k ? 1 : 0.5 }} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide font-medium">Stage</label>
            <select
              className="input mb-2"
              value={form.stage}
              onChange={e => handleStageSave(e.target.value)}
            >
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide font-medium">Priority</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => set('priority', p)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.priority === p ? 'border-transparent' : 'border-white/[0.08] text-white/40'
                  }`}
                  style={form.priority === p ? { background: PRIORITY_COLORS[p] + '33', color: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] + '55' } : {}}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Log activity buttons ── */}
        <div className="grid grid-cols-3 gap-2">
          {[['call','📞 Log Call','#0088FF'],['email','✉ Log Email','#00FF88'],['note','📝 Add Note','#fff']].map(([type, label, color]) => (
            <button
              key={type}
              onClick={() => setActivityModal(type)}
              className="btn btn-ghost py-3 flex-col gap-1 border border-white/[0.07] hover:border-white/20"
            >
              <span className="text-lg">{label.split(' ')[0]}</span>
              <span className="text-xs text-white/50">{label.split(' ').slice(1).join(' ')}</span>
            </button>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-white/[0.06]">
          {[['details','Details'],['activity','Activity'],['history','Stage History']].map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {label}
              {tab === 'activity' && lead.activities?.length > 0 && (
                <span className="ml-1.5 badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                  {lead.activities.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Details tab ── */}
        {activeTab === 'details' && (
          <div className="space-y-5 animate-slide-in-up">
            {/* Contact info */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h3 className="font-syne font-semibold text-white text-sm">Contact Info</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Business Name">
                  <input className="input" value={form.businessName} onChange={e => set('businessName', e.target.value)} />
                </Field>
                <Field label="Owner Name">
                  <input className="input" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </Field>
                <Field label="Email">
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </Field>
                <Field label="Address">
                  <input className="input" value={form.address} onChange={e => set('address', e.target.value)} />
                </Field>
                <Field label="Google Maps Link">
                  <div className="flex gap-2">
                    <input className="input flex-1" value={form.mapsLink} onChange={e => set('mapsLink', e.target.value)} placeholder="https://maps.google.com/…" />
                    {form.mapsLink && (
                      <a href={form.mapsLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm flex-shrink-0" onClick={e => e.stopPropagation()}>
                        🗺
                      </a>
                    )}
                  </div>
                </Field>
                <Field label="Best Time to Call">
                  <select className="input" value={form.bestTimeToCall} onChange={e => set('bestTimeToCall', e.target.value)}>
                    {['Morning','Afternoon','Evening'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Industry">
                  <select className="input" value={form.industry} onChange={e => set('industry', e.target.value)}>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* Deal info */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h3 className="font-syne font-semibold text-white text-sm">Deal Info</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Setup Fee ($)">
                  <input className="input" type="number" min="0" value={form.setupFee} onChange={e => set('setupFee', parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="Monthly Fee ($)">
                  <input className="input" type="number" min="0" value={form.monthlyFee} onChange={e => set('monthlyFee', parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="LTV (auto)">
                  <div className="input bg-white/[0.03] flex items-center justify-between">
                    <span className="font-semibold" style={{ color: '#00FF88' }}>{formatCurrency(ltv)}</span>
                    <span className="text-white/25 text-xs">monthly × 12 + setup</span>
                  </div>
                </Field>
                <Field label="Lead Source">
                  <select className="input" value={form.leadSource} onChange={e => set('leadSource', e.target.value)}>
                    {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Follow-up Date">
                  <input className="input" type="date" value={form.followUpDate || ''} onChange={e => set('followUpDate', e.target.value)} />
                </Field>
                <Field label="Has Website?">
                  <div className="flex gap-2">
                    {[true, false].map(v => (
                      <button
                        key={String(v)}
                        onClick={() => set('hasWebsite', v)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          form.hasWebsite === v ? 'bg-white text-black border-transparent' : 'border-white/[0.08] text-white/40 hover:border-white/20'
                        }`}
                      >
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Checkboxes */}
              <div className="flex gap-4 pt-2 border-t border-white/[0.05]">
                {[['called','📞 Called'],['emailSent','✉ Email Sent']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form[key]}
                      onChange={e => set(key, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-white/60">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Notes</h3>
              <textarea
                className="input resize-none"
                rows={4}
                placeholder="Free-form notes about this lead…"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>

            {/* Tags */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.tags || []).map(tag => (
                  <span key={tag} className="tag-pill">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-white/30 hover:text-white/70 ml-1">×</button>
                  </span>
                ))}
                {!(form.tags?.length) && <p className="text-white/25 text-xs">No tags yet</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Add a tag… (e.g. 'left voicemail')"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                />
                <button onClick={addTag} className="btn btn-ghost btn-sm">Add</button>
              </div>
            </div>

            {/* Meta */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Lead Meta</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Date Added',    formatDate(lead.dateAdded)],
                  ['Lead Age',      `${daysSince(lead.dateAdded)} days`],
                  ['Last Contacted',formatRelative(lead.lastContacted)],
                  ['Call Attempts', lead.callAttemptCount || 0],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-white/30 mb-0.5">{k}</p>
                    <p className="text-white/70 font-medium">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Activity tab ── */}
        {activeTab === 'activity' && (
          <div className="space-y-3 animate-slide-in-up">
            {activities.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-white/30 text-sm">No activity logged yet</p>
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={() => setActivityModal('call')} className="btn btn-ghost btn-sm">Log Call</button>
                  <button onClick={() => setActivityModal('email')} className="btn btn-ghost btn-sm">Log Email</button>
                  <button onClick={() => setActivityModal('note')} className="btn btn-ghost btn-sm">Add Note</button>
                </div>
              </div>
            ) : activities.map((act, i) => (
              <div key={act.id || i} className="glass rounded-xl p-4 flex gap-3 animate-slide-in-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06]">
                  <ActivityIcon type={act.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white/70 capitalize">{act.type}</span>
                    {act.outcome && (
                      <span className="badge text-[10px]" style={{
                        background: act.outcome === 'Answered' ? '#00FF8822' : '#FF3B3B22',
                        color: act.outcome === 'Answered' ? '#00FF88' : '#FF3B3B',
                      }}>
                        {act.outcome}
                      </span>
                    )}
                    {act.subject && <span className="text-xs text-white/40">"{act.subject}"</span>}
                    <span className="ml-auto text-[10px] text-white/25">
                      {formatDate(act.date)} {formatTime(act.date)}
                    </span>
                  </div>
                  {act.notes && <p className="text-sm text-white/60">{act.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Stage history tab ── */}
        {activeTab === 'history' && (
          <div className="glass rounded-2xl p-5 animate-slide-in-up">
            <StageHistory history={lead.stageHistory} />
          </div>
        )}
      </div>

      {/* Activity modal */}
      {activityModal && (
        <LogActivityModal
          type={activityModal}
          onSave={handleActivitySave}
          onClose={() => setActivityModal(null)}
        />
      )}
    </div>
  )
}
