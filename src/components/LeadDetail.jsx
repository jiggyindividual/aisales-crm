import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, INDUSTRIES, LEAD_SOURCES, PRIORITIES, PRIORITY_COLORS,
  CALL_OUTCOMES, ACTION_TYPES, ACTIVITY_TYPES, FOLLOW_UP_SEQUENCES, HEAT_LEVELS,
  computeFlags, computeHeatScore, getHeatLevel, getAISuggestion, getDaysInStage,
  calculateLTV, formatCurrency, formatDate, formatRelative, formatTime, daysSince, getStage,
} from '../utils/helpers'

/* ── Helpers ── */
function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

/* ── Heat badge ── */
function HeatDisplay({ score }) {
  const level = getHeatLevel(score)
  const hl = HEAT_LEVELS[level]
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="26" cy="26" r="22"
            fill="none"
            stroke={hl.color}
            strokeWidth="4"
            strokeDasharray={`${(score / 100) * 138} 138`}
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: hl.color }}>
          {score}
        </span>
      </div>
      <div>
        <p className="font-syne font-bold text-sm" style={{ color: hl.color }}>
          {hl.emoji} {hl.label}
        </p>
        <p className="text-[11px] text-white/30">Deal Heat</p>
      </div>
    </div>
  )
}

/* ── Log activity modal ── */
function LogActivityModal({ type: initialType, onSave, onClose }) {
  const [form, setForm] = useState({
    type: initialType,
    date: new Date().toISOString().slice(0, 10),
    outcome: 'Answered',
    subject: '',
    notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const actType = ACTIVITY_TYPES.find(a => a.id === form.type)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass rounded-2xl p-6 w-full max-w-md animate-fade-scale" onClick={e => e.stopPropagation()}>
        {/* Type selector */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {ACTIVITY_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => set('type', t.id)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                form.type === t.id
                  ? 'border-transparent text-black'
                  : 'border-white/[0.08] text-white/40 hover:border-white/20'
              }`}
              style={form.type === t.id ? { background: t.color } : {}}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <h3 className="font-syne font-bold text-white text-lg mb-4">
          Log {actType?.label || 'Activity'}
        </h3>

        <div className="space-y-3">
          <Field label="Date">
            <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
          </Field>
          {form.type === 'call' && (
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
          {(form.type === 'email' || form.type === 'proposal') && (
            <Field label="Subject">
              <input className="input" placeholder="Subject…" value={form.subject} onChange={e => set('subject', e.target.value)} />
            </Field>
          )}
          <Field label="Notes">
            <textarea className="input resize-none" rows={3} placeholder="Notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
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

/* ── Activity timeline entry ── */
function ActivityEntry({ act, index }) {
  const aType = ACTIVITY_TYPES.find(t => t.id === act.type) || { icon: '📝', color: '#ffffff', label: act.type }
  return (
    <div
      className="flex gap-3 animate-slide-in-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {/* Icon */}
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
          style={{ background: aType.color + '20' }}
        >
          {aType.icon}
        </div>
        <div className="w-px flex-1 mt-1" style={{ background: 'rgba(255,255,255,0.05)', minHeight: 8 }} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: aType.color }}>{aType.label}</span>
          {act.outcome && (
            <span className="badge text-[10px]" style={{
              background: act.outcome === 'Answered' ? '#00FF8822' : '#FF3B3B22',
              color: act.outcome === 'Answered' ? '#00FF88' : '#FF3B3B',
            }}>
              {act.outcome}
            </span>
          )}
          {act.subject && <span className="text-xs text-white/40 italic">"{act.subject}"</span>}
          <span className="ml-auto text-[10px] text-white/25 flex-shrink-0">
            {formatDate(act.date)} {formatTime(act.date)}
          </span>
        </div>
        {act.notes && <p className="text-sm text-white/60 leading-relaxed">{act.notes}</p>}
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
  const [activityModal, setActivityModal] = useState(null)
  const [newTag, setNewTag] = useState('')
  const [activeTab, setActiveTab] = useState('details')
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
    // Auto-set proposalSentAt when moving to proposal-sent
    if (newStage === 'proposal-sent' && !form.proposalSentAt) {
      set('proposalSentAt', new Date().toISOString())
    }
  }

  const handleActivitySave = (activity) => {
    logActivity(lead.id, { ...activity, date: new Date(activity.date).toISOString() })
    setActivityModal(null)
    addToast(`${ACTIVITY_TYPES.find(t=>t.id===activity.type)?.label || activity.type} logged`, 'success')
  }

  const addTag = () => {
    const tag = newTag.trim()
    if (!tag || form.tags?.includes(tag)) return
    set('tags', [...(form.tags || []), tag])
    setNewTag('')
  }

  const removeTag = (tag) => set('tags', (form.tags || []).filter(t => t !== tag))

  const ltv          = form ? calculateLTV(form.monthlyFee, form.setupFee) : 0
  const flags        = lead ? computeFlags(lead, {}) : []
  const heatScore    = lead ? computeHeatScore(lead) : 0
  const suggestion   = lead ? getAISuggestion(lead) : null
  const sinceContact = lead ? daysSince(lead.lastContacted) : null
  const daysInStage  = lead ? getDaysInStage(lead) : 0
  const svc          = form ? SERVICES[form.service] : null
  const actionType   = form ? ACTION_TYPES.find(a => a.id === form.nextActionType) : null
  const actionOverdue = form?.nextActionDueAt && daysSince(form.nextActionDueAt) > 0

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
        <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
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
        <div className={`flex items-center gap-1.5 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'} save-flash`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#00FF88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="text-xs text-[#00FF88]">Saved</span>
        </div>
        <button onClick={() => set('pinned', !form.pinned)} className={`btn btn-ghost btn-sm ${form.pinned ? 'text-[#FFD700]' : 'text-white/30'}`} title="Pin">★</button>
        <button onClick={() => { archiveLead(lead.id); navigate(-1) }} className="btn btn-ghost btn-sm text-white/30" title="Archive">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 5h12M5 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M3 5V4a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3"/></svg>
        </button>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* ── AI Suggestion banner ── */}
        {suggestion && (
          <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 border" style={{ background: 'rgba(0,136,255,0.06)', borderColor: 'rgba(0,136,255,0.2)' }}>
            <span className="text-sm flex-shrink-0 mt-0.5">⚡</span>
            <p className="text-sm text-white/70 leading-relaxed italic">"{suggestion}"</p>
          </div>
        )}

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
        <div className="grid grid-cols-4 gap-2.5">
          <div className="glass rounded-xl p-3 text-center col-span-1">
            <HeatDisplay score={heatScore} />
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="font-syne font-bold text-white text-xl">{lead.callAttemptCount || 0}</p>
            <p className="text-[10px] text-white/40">Calls</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="font-syne font-bold text-white text-xl">{sinceContact !== null ? `${sinceContact}d` : '—'}</p>
            <p className="text-[10px] text-white/40">Since Contact</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="font-syne font-bold text-xl" style={{ color: '#00FF88' }}>{formatCurrency(ltv)}</p>
            <p className="text-[10px] text-white/40">LTV</p>
          </div>
        </div>

        {/* ── Next Action panel (CTA box) ── */}
        <div className={`glass rounded-2xl p-4 border ${actionOverdue ? 'border-[#FF3B3B]/30' : 'border-white/[0.07]'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-syne font-semibold text-white text-sm">Next Action</h3>
            {!form.nextActionType && (
              <span className="badge text-[10px]" style={{ background: '#FF950022', color: '#FF9500' }}>⚠ Not Set</span>
            )}
            {actionOverdue && (
              <span className="badge text-[10px] animate-pulse-overdue" style={{ background: '#FF3B3B22', color: '#FF3B3B' }}>⚡ Overdue</span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Action type selector */}
            <div>
              <label className="text-[10px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {ACTION_TYPES.map(a => (
                  <button
                    key={a.id}
                    onClick={() => set('nextActionType', form.nextActionType === a.id ? '' : a.id)}
                    className={`py-1 px-2.5 rounded-lg text-[11px] font-semibold border transition-all ${
                      form.nextActionType === a.id
                        ? 'bg-white text-black border-transparent'
                        : 'border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/70'
                    }`}
                  >
                    {a.icon} {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className="text-[10px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                className="input"
                value={form.nextActionDueAt || ''}
                onChange={e => set('nextActionDueAt', e.target.value)}
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-[10px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Status</label>
              <div className="flex gap-1.5">
                {['pending','completed'].map(s => (
                  <button
                    key={s}
                    onClick={() => set('nextActionStatus', s)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-semibold border transition-all capitalize ${
                      form.nextActionStatus === s
                        ? s === 'completed'
                          ? 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/30'
                          : 'bg-white/10 text-white border-white/20'
                        : 'border-white/[0.08] text-white/40 hover:border-white/20'
                    }`}
                  >
                    {s === 'completed' ? '✓ Done' : '◎ Pending'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stage + Priority + Close Probability ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="glass rounded-xl p-4">
            <label className="text-[10px] text-white/40 mb-2 block uppercase tracking-wider font-semibold">Pipeline Stage</label>
            <select className="input mb-3" value={form.stage} onChange={e => handleStageSave(e.target.value)}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <label className="text-[10px] text-white/40 mb-2 block uppercase tracking-wider font-semibold">Priority</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PRIORITIES.map(p => (
                <button key={p} onClick={() => set('priority', p)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.priority === p ? 'border-transparent' : 'border-white/[0.08] text-white/40'
                  }`}
                  style={form.priority === p ? { background: PRIORITY_COLORS[p] + '33', color: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] + '55' } : {}}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Close Probability</label>
                <span className="text-xs font-bold text-white">{form.closeProbability || 0}%</span>
              </div>
              <input
                type="range" min="0" max="100" step="5"
                value={form.closeProbability || 0}
                onChange={e => set('closeProbability', parseInt(e.target.value))}
                className="w-full accent-white"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-1">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <label className="text-[10px] text-white/40 mb-2 block uppercase tracking-wider font-semibold">Service</label>
            <div className="grid grid-cols-1 gap-1.5 mb-3">
              {Object.entries(SERVICES).map(([k, v]) => (
                <button key={k} onClick={() => set('service', k)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-left flex items-center gap-2 ${
                    form.service === k ? 'text-black border-transparent' : 'border-white/[0.08] text-white/40 hover:border-white/20'
                  }`}
                  style={form.service === k ? { background: v.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color, opacity: form.service === k ? 1 : 0.5 }} />
                  {v.label}
                </button>
              ))}
            </div>
            <label className="text-[10px] text-white/40 mb-1.5 block uppercase tracking-wider font-semibold">Expected Close</label>
            <input
              type="date" className="input"
              value={form.expectedCloseDate || ''}
              onChange={e => set('expectedCloseDate', e.target.value)}
            />
            <div className="mt-2 text-[10px] text-white/30">
              {daysInStage > 0 && `In current stage: ${daysInStage} days`}
            </div>
          </div>
        </div>

        {/* ── Log activity buttons ── */}
        <div className="grid grid-cols-3 gap-2">
          {[['call','📞 Log Call'],['text','💬 Log Text'],['email','✉ Log Email'],['meeting','📅 Meeting'],['proposal','📋 Proposal'],['note','📝 Note']].map(([type, label]) => (
            <button
              key={type}
              onClick={() => setActivityModal(type)}
              className="btn btn-ghost py-3 flex-col gap-1 border border-white/[0.07] hover:border-white/20"
            >
              <span className="text-base">{label.split(' ')[0]}</span>
              <span className="text-[10px] text-white/40">{label.split(' ').slice(1).join(' ')}</span>
            </button>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-white/[0.06]">
          {[['details','Details'],['activity','Activity'],['followup','Follow-Up'],['history','Stage History']].map(([tab, label]) => (
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
          <div className="space-y-4 animate-slide-in-up">
            {/* Contact info */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h3 className="font-syne font-semibold text-white text-sm">Contact Info</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Business Name">
                  <input className="input" value={form.businessName} onChange={e => set('businessName', e.target.value)} />
                </Field>
                <Field label="Contact Name">
                  <input className="input" value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </Field>
                <Field label="Email">
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </Field>
                <Field label="Website">
                  <input className="input" placeholder="https://…" value={form.website || ''} onChange={e => set('website', e.target.value)} />
                </Field>
                <Field label="Industry">
                  <select className="input" value={form.industry} onChange={e => set('industry', e.target.value)}>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Address">
                  <div className="flex gap-2">
                    <input className="input flex-1" value={form.address} onChange={e => set('address', e.target.value)} />
                    {form.mapsLink && (
                      <a href={form.mapsLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm flex-shrink-0" onClick={e => e.stopPropagation()}>🗺</a>
                    )}
                  </div>
                </Field>
                <Field label="Lead Source">
                  <select className="input" value={form.leadSource} onChange={e => set('leadSource', e.target.value)}>
                    {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Social Links">
                  <input className="input" placeholder="Instagram, LinkedIn, etc." value={form.socialLinks || ''} onChange={e => set('socialLinks', e.target.value)} />
                </Field>
                <Field label="Best Time to Call">
                  <select className="input" value={form.bestTimeToCall} onChange={e => set('bestTimeToCall', e.target.value)}>
                    {['Morning','Afternoon','Evening'].map(t => <option key={t} value={t}>{t}</option>)}
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
                <Field label="Monthly Retainer ($)">
                  <input className="input" type="number" min="0" value={form.monthlyFee} onChange={e => set('monthlyFee', parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="LTV (auto-calculated)">
                  <div className="input bg-white/[0.03] flex items-center justify-between">
                    <span className="font-semibold" style={{ color: '#00FF88' }}>{formatCurrency(ltv)}</span>
                    <span className="text-white/25 text-xs">retainer × 12 + setup</span>
                  </div>
                </Field>
                <Field label="Follow-Up Date">
                  <input className="input" type="date" value={form.followUpDate || ''} onChange={e => set('followUpDate', e.target.value)} />
                </Field>
                <Field label="Has Website?">
                  <div className="flex gap-2">
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => set('hasWebsite', v)}
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
            </div>

            {/* Notes */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Notes</h3>
              <textarea className="input resize-none" rows={5} placeholder="Free-form notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
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
                {!form.tags?.length && <p className="text-white/25 text-xs">No tags yet</p>}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Add tag… (e.g. 'left voicemail')" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} />
                <button onClick={addTag} className="btn btn-ghost btn-sm">Add</button>
              </div>
            </div>

            {/* Meta */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Lead Meta</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Date Added',      formatDate(lead.dateAdded)],
                  ['Lead Age',        `${daysSince(lead.dateAdded)} days`],
                  ['Last Contacted',  formatRelative(lead.lastContacted)],
                  ['Call Attempts',   lead.callAttemptCount || 0],
                  ['Days in Stage',   `${daysInStage} days`],
                  ['Proposal Sent',   form.proposalSentAt ? formatDate(form.proposalSentAt) : '—'],
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
          <div className="space-y-0 animate-slide-in-up">
            {activities.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-white/30 text-sm">No activity logged yet</p>
                <div className="flex gap-2 justify-center mt-4 flex-wrap">
                  <button onClick={() => setActivityModal('call')} className="btn btn-ghost btn-sm">Log Call</button>
                  <button onClick={() => setActivityModal('text')} className="btn btn-ghost btn-sm">Log Text</button>
                  <button onClick={() => setActivityModal('email')} className="btn btn-ghost btn-sm">Log Email</button>
                  <button onClick={() => setActivityModal('meeting')} className="btn btn-ghost btn-sm">Log Meeting</button>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                {activities.map((act, i) => (
                  <ActivityEntry key={act.id || i} act={act} index={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Follow-up tab ── */}
        {activeTab === 'followup' && (
          <div className="space-y-4 animate-slide-in-up">
            {/* Sequence enrollment */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Follow-Up Sequence</h3>
              <div className="grid grid-cols-1 gap-2">
                {FOLLOW_UP_SEQUENCES.map(seq => (
                  <button
                    key={seq.id}
                    onClick={() => set('followUpSequence', seq.id)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all text-left ${
                      form.followUpSequence === seq.id
                        ? 'bg-white/10 text-white border-white/20'
                        : 'border-white/[0.07] text-white/40 hover:border-white/15 hover:text-white/60'
                    }`}
                  >
                    {form.followUpSequence === seq.id && <span className="mr-2 text-[#00FF88]">✓</span>}
                    {seq.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Suggested follow-up actions */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-syne font-semibold text-white text-sm mb-3">Suggested Actions</h3>
              <div className="space-y-2">
                {[
                  { icon: '💬', text: 'Send a follow-up text', stage: ['proposal-sent','contacted-interested'] },
                  { icon: '📋', text: 'Send proof / case study', stage: ['contacted-interested','demo-sent'] },
                  { icon: '📅', text: 'Send calendar link', stage: ['cold','called-no-answer','contacted-interested'] },
                  { icon: '🎯', text: 'Ask direct closing question', stage: ['proposal-sent','demo-sent'] },
                  { icon: '🔁', text: 'Send reactivation message', stage: ['cold','called-no-answer'] },
                  { icon: '📧', text: 'Send proposal follow-up email', stage: ['proposal-sent'] },
                ].filter(s => s.stage.includes(form.stage)).map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.07] hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-sm text-white/60">{s.text}</span>
                    <svg className="ml-auto flex-shrink-0" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                ))}
                {![...['proposal-sent','contacted-interested','demo-sent','cold','called-no-answer']].includes(form.stage) && (
                  <p className="text-white/25 text-sm text-center py-4">
                    {form.stage === 'closed-won' ? '🎉 Deal closed — no follow-up needed.' : 'No suggested actions for this stage.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stage history tab ── */}
        {activeTab === 'history' && (
          <div className="glass rounded-2xl p-5 animate-slide-in-up">
            <StageHistory history={lead.stageHistory} />
          </div>
        )}
      </div>

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
