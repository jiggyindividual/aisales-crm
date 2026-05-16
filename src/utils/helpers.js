export const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const calculateLTV = (monthlyFee, setupFee) =>
  (parseFloat(monthlyFee) || 0) * 12 + (parseFloat(setupFee) || 0)

export const daysSince = (dateStr) => {
  if (!dateStr) return null
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86400000)
}

export const isNew = (dateAdded) => daysSince(dateAdded) === 0

// ── Stage definitions (IDs preserved for data compatibility) ──
export const STAGES = [
  { id: 'cold',                 label: 'New Lead',      color: '#555555' },
  { id: 'called-no-answer',     label: 'Contacting',    color: '#777777' },
  { id: 'contacted-interested', label: 'Qualified',     color: '#0088FF' },
  { id: 'demo-sent',            label: 'Discovery',     color: '#9B59B6' },
  { id: 'proposal-sent',        label: 'Proposal Sent', color: '#FF9500' },
  { id: 'closed-won',           label: 'Closed Won',    color: '#00FF88' },
  { id: 'closed-lost',          label: 'Closed Lost',   color: '#FF3B3B' },
  { id: 'do-not-call',          label: 'Do Not Call',   color: '#333333' },
]

export const ACTIVE_STAGE_IDS = ['cold','called-no-answer','contacted-interested','demo-sent','proposal-sent']

export const SERVICES = {
  'ai-website':      { label: 'AI Website',      color: '#0088FF' },
  'ai-receptionist': { label: 'AI Receptionist', color: '#00FF88' },
  'both':            { label: 'Both',            color: '#FFD700' },
}

export const INDUSTRIES = [
  'Restaurant','Salon','Auto Shop','Contractor','Retail','Medical','Barbershop','Other',
]

export const LEAD_SOURCES = ['Cold Call','Referral','Instagram','Walk-in','Other']

export const PRIORITIES = ['Hot','Warm','Cold']

export const PRIORITY_COLORS = {
  Hot:  '#FF3B3B',
  Warm: '#FF9500',
  Cold: '#8B8BFF',
}

// ── Heat level system ──
export const HEAT_LEVELS = {
  Nuclear: { color: '#FF2D55', bg: 'rgba(255,45,85,0.15)',   label: 'Nuclear', emoji: '☢',  rank: 4 },
  Hot:     { color: '#FF6B00', bg: 'rgba(255,107,0,0.15)',   label: 'Hot',     emoji: '🔥', rank: 3 },
  Warm:    { color: '#FF9500', bg: 'rgba(255,149,0,0.12)',   label: 'Warm',    emoji: '🌡',  rank: 2 },
  Cold:    { color: '#636366', bg: 'rgba(99,99,102,0.15)',   label: 'Cold',    emoji: '🧊', rank: 1 },
}

// ── Next action types ──
export const ACTION_TYPES = [
  { id: 'call',      label: 'Call',        icon: '📞' },
  { id: 'text',      label: 'Text',        icon: '💬' },
  { id: 'email',     label: 'Email',       icon: '✉️' },
  { id: 'meeting',   label: 'Meeting',     icon: '📅' },
  { id: 'proposal',  label: 'Send Proposal', icon: '📋' },
  { id: 'follow-up', label: 'Follow-Up',   icon: '🔁' },
  { id: 'invoice',   label: 'Invoice',     icon: '💰' },
  { id: 'nurture',   label: 'Nurture',     icon: '🌱' },
]

// ── Follow-up sequences ──
export const FOLLOW_UP_SEQUENCES = [
  { id: 'none',              label: 'Not Enrolled' },
  { id: 'proposal-followup', label: 'Proposal Follow-Up' },
  { id: 'no-show-recovery',  label: 'No-Show Recovery' },
  { id: 'cold-nurture',      label: 'Cold Lead Nurture' },
  { id: 'reactivation',      label: 'Reactivation' },
]

export const CALL_OUTCOMES = ['Answered','No Answer','Voicemail']

// ── Activity types for logging ──
export const ACTIVITY_TYPES = [
  { id: 'call',     label: 'Call',          icon: '📞', color: '#0088FF' },
  { id: 'text',     label: 'Text',          icon: '💬', color: '#34C759' },
  { id: 'email',    label: 'Email',         icon: '✉️',  color: '#00FF88' },
  { id: 'meeting',  label: 'Meeting',       icon: '📅', color: '#9B59B6' },
  { id: 'proposal', label: 'Proposal Sent', icon: '📋', color: '#FF9500' },
  { id: 'note',     label: 'Note',          icon: '📝', color: '#ffffff' },
]

export const getStage = (id) => STAGES.find(s => s.id === id) || STAGES[0]

// ── Days a lead has been in its current stage ──
export const getDaysInStage = (lead) => {
  const history = lead.stageHistory || []
  const last = history[history.length - 1]
  if (!last) return daysSince(lead.dateAdded) || 0
  return daysSince(last.timestamp) || 0
}

// ── Heat score (0–100) ──
export const computeHeatScore = (lead) => {
  if (lead.stage === 'closed-won') return 100
  if (['closed-lost','do-not-call'].includes(lead.stage)) return 0

  let score = 0

  // Stage weight (0–45)
  const stageScores = {
    'cold': 5, 'called-no-answer': 12,
    'contacted-interested': 28, 'demo-sent': 38, 'proposal-sent': 45,
  }
  score += stageScores[lead.stage] || 0

  // Deal value (0–20)
  const ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
  if (ltv >= 10000) score += 20
  else if (ltv >= 5000) score += 15
  else if (ltv >= 2000) score += 10
  else if (ltv > 0) score += 5

  // Close probability (0–15)
  score += Math.round(((lead.closeProbability || 0) / 100) * 15)

  // Recency of contact (−5 to +15)
  const sinceContact = daysSince(lead.lastContacted)
  if (sinceContact === null) score -= 5
  else if (sinceContact === 0) score += 15
  else if (sinceContact === 1) score += 12
  else if (sinceContact <= 3) score += 8
  else if (sinceContact <= 7) score += 3
  else score -= 3

  // Activity count (0–10)
  score += Math.min(10, (lead.activities || []).length * 2)

  // Overdue action = high urgency (+10)
  if (lead.nextActionDueAt && daysSince(lead.nextActionDueAt) > 0) score += 10

  // No next action = needs attention (−10)
  if (!lead.nextActionType) score -= 10

  return Math.max(0, Math.min(100, Math.round(score)))
}

export const getHeatLevel = (score) => {
  if (score >= 75) return 'Nuclear'
  if (score >= 50) return 'Hot'
  if (score >= 25) return 'Warm'
  return 'Cold'
}

// ── Smart flags ──
export const computeFlags = (lead, settings = {}) => {
  const staleThreshold = settings.staleThreshold ?? 7
  const coldThreshold  = settings.coldThreshold  ?? 5
  const flags = []
  const sinceContact = daysSince(lead.lastContacted)
  const sinceAdded   = daysSince(lead.dateAdded)
  const isActive = !lead.archived &&
    lead.stage !== 'closed-won' &&
    lead.stage !== 'closed-lost' &&
    lead.stage !== 'do-not-call'

  if (sinceAdded === 0)
    flags.push({ type: 'new', label: 'New', color: '#0088FF' })

  if (lead.callAttemptCount >= 3 && isActive)
    flags.push({ type: 'on-fire', label: '🔥 On Fire', color: '#FF6B00' })

  if (lead.priority === 'Hot' && sinceContact !== null && sinceContact >= coldThreshold && isActive)
    flags.push({ type: 'gone-cold', label: 'Gone Cold', color: '#8B8BFF' })

  if (isActive && sinceContact !== null && sinceContact >= staleThreshold)
    flags.push({ type: 'stale', label: 'Stale', color: '#FF9500' })

  if (lead.followUpDate && isActive) {
    const fu = new Date(lead.followUpDate); fu.setHours(0,0,0,0)
    const today = new Date();              today.setHours(0,0,0,0)
    if (fu < today) flags.push({ type: 'overdue', label: 'Overdue', color: '#FF3B3B' })
  }

  if (lead.nextActionDueAt && isActive && daysSince(lead.nextActionDueAt) > 0)
    flags.push({ type: 'action-overdue', label: '⚡ Action Due', color: '#FF3B3B' })

  return flags
}

export const getCardGlowClass = (flags) => {
  if (flags.some(f => f.type === 'overdue' || f.type === 'action-overdue')) return 'overdue-glow'
  if (flags.some(f => f.type === 'stale'))     return 'stale-glow'
  if (flags.some(f => f.type === 'gone-cold')) return 'gone-cold-glow'
  if (flags.some(f => f.type === 'on-fire'))   return 'on-fire-glow'
  return ''
}

// ── AI-style rule-based sales suggestion ──
export const getAISuggestion = (lead) => {
  if (['closed-won','closed-lost','do-not-call'].includes(lead.stage)) return null

  const sinceContact = daysSince(lead.lastContacted)
  const daysInStage  = getDaysInStage(lead)
  const overdue      = lead.nextActionDueAt ? daysSince(lead.nextActionDueAt) : null

  if (lead.stage === 'proposal-sent') {
    if (sinceContact !== null && sinceContact >= 4)
      return `Call now — proposal sent ${sinceContact}d ago with no follow-up logged.`
    if (sinceContact !== null && sinceContact >= 2)
      return 'Follow up today — ask if they reviewed the proposal.'
  }

  if (overdue !== null && overdue > 0)
    return `Action overdue by ${overdue}d. Don't let this one slip.`

  if (!lead.nextActionType)
    return 'No next action set. Every active lead needs a clear next step.'

  if (sinceContact === null)
    return 'Never contacted. First contact sets the tone — reach out now.'

  if (sinceContact >= 6)
    return `Untouched for ${sinceContact} days. Send a quick text or call today.`

  if (lead.stage === 'contacted-interested' && sinceContact >= 2)
    return 'They expressed interest — book the discovery call before they go cold.'

  if (lead.stage === 'demo-sent' && sinceContact >= 1)
    return 'Discovery done. Send the proposal while interest is still high.'

  if (lead.stage === 'cold' && sinceContact === null)
    return 'Fresh lead. Make first contact within 24 hours for best results.'

  if (daysInStage >= 10)
    return `Stuck in "${getStage(lead.stage).label}" for ${daysInStage} days. Move forward or move on.`

  return null
}

// ── Neglect detection ──
export const isNeglected = (lead) => {
  if (lead.archived) return false
  if (['closed-won','closed-lost','do-not-call'].includes(lead.stage)) return false
  const sinceContact = daysSince(lead.lastContacted)
  const daysInStage  = getDaysInStage(lead)
  if (!lead.nextActionType) return true
  if (lead.nextActionDueAt && daysSince(lead.nextActionDueAt) > 0) return true
  if (lead.stage === 'proposal-sent' && sinceContact !== null && sinceContact >= 2) return true
  if (sinceContact !== null && sinceContact >= 3) return true
  if (daysInStage >= 7) return true
  return false
}

export const getNeglectReason = (lead) => {
  const sinceContact = daysSince(lead.lastContacted)
  const daysInStage  = getDaysInStage(lead)
  if (lead.stage === 'proposal-sent' && sinceContact !== null && sinceContact >= 2)
    return `Proposal sent — no follow-up in ${sinceContact}d`
  if (lead.nextActionDueAt && daysSince(lead.nextActionDueAt) > 0)
    return `Action overdue by ${daysSince(lead.nextActionDueAt)}d`
  if (!lead.nextActionType)
    return 'No next action set'
  if (sinceContact !== null && sinceContact >= 3)
    return `No contact in ${sinceContact} days`
  if (daysInStage >= 7)
    return `Stuck in stage ${daysInStage} days`
  return 'Needs attention'
}

// ── Contact priority score for "Who to Call Next" ranking ──
export const computeContactPriority = (lead) => {
  let score = computeHeatScore(lead) * 0.5

  // Overdue action = biggest urgency signal
  if (lead.nextActionDueAt && daysSince(lead.nextActionDueAt) > 0) score += 35

  // Proposal sent + no follow-up = money on the table
  if (lead.stage === 'proposal-sent') {
    const sc = daysSince(lead.lastContacted)
    if (sc !== null && sc >= 2) score += 30
    else if (sc !== null && sc >= 1) score += 15
  }

  // No next action = needs attention
  if (!lead.nextActionType) score += 12

  // Deal value bonus (up to 15 pts)
  const ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
  score += Math.min(15, ltv / 1000)

  // Stale = leaking (up to 15 pts)
  const sinceContact = daysSince(lead.lastContacted)
  if (sinceContact !== null && sinceContact >= 5) score += 15
  else if (sinceContact !== null && sinceContact >= 3) score += 8

  return score
}

// ── Formatters ──
export const formatCurrency = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatDateShort = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatRelative = (d) => {
  if (!d) return 'Never'
  const days = daysSince(d)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days/7)}w ago`
  return `${Math.floor(days/30)}mo ago`
}

export const formatTime = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Default lead factory ──
export const createDefaultLead = (overrides = {}) => ({
  id:                generateId(),
  businessName:      '',
  ownerName:         '',
  email:             '',
  phone:             '',
  bestTimeToCall:    'Morning',
  address:           '',
  mapsLink:          '',
  website:           '',
  socialLinks:       '',
  industry:          'Other',
  hasWebsite:        false,
  service:           'ai-website',
  leadSource:        'Cold Call',
  setupFee:          0,
  monthlyFee:        0,
  closeProbability:  25,
  expectedCloseDate: '',
  stage:             'cold',
  followUpDate:      '',
  nextActionType:    '',
  nextActionDueAt:   '',
  nextActionStatus:  'pending',
  followUpSequence:  'none',
  proposalSentAt:    '',
  priority:          'Cold',
  called:            false,
  emailSent:         false,
  notes:             '',
  tags:              [],
  pinned:            false,
  archived:          false,
  dateAdded:         new Date().toISOString(),
  lastContacted:     null,
  callAttemptCount:  0,
  stageHistory:      [{ stage: 'cold', timestamp: new Date().toISOString() }],
  activities:        [],
  ...overrides,
})

// ── Filtering ──
export const filterByService = (leads, filter) => {
  if (!filter || filter === 'all') return leads
  return leads.filter(l => l.service === filter)
}

// ── Sorting ──
export const sortLeads = (leads, sort, dir) => {
  return [...leads].sort((a, b) => {
    let va, vb
    switch (sort) {
      case 'businessName':     va = a.businessName?.toLowerCase(); vb = b.businessName?.toLowerCase(); break
      case 'stage':            va = STAGES.findIndex(s=>s.id===a.stage); vb = STAGES.findIndex(s=>s.id===b.stage); break
      case 'priority':         va = ['Hot','Warm','Cold'].indexOf(a.priority); vb = ['Hot','Warm','Cold'].indexOf(b.priority); break
      case 'ltv':              va = calculateLTV(a.monthlyFee,a.setupFee); vb = calculateLTV(b.monthlyFee,b.setupFee); break
      case 'followUpDate':     va = a.followUpDate||'zzz'; vb = b.followUpDate||'zzz'; break
      case 'dateAdded':        va = a.dateAdded; vb = b.dateAdded; break
      case 'lastContacted':    va = a.lastContacted||''; vb = b.lastContacted||''; break
      case 'callAttempts':     va = a.callAttemptCount||0; vb = b.callAttemptCount||0; break
      case 'closeProbability': va = a.closeProbability||0; vb = b.closeProbability||0; break
      case 'heatScore':        va = computeHeatScore(a); vb = computeHeatScore(b); break
      case 'daysInStage':      va = getDaysInStage(a); vb = getDaysInStage(b); break
      case 'nextAction':       va = a.nextActionDueAt||'zzz'; vb = b.nextActionDueAt||'zzz'; break
      case 'contactPriority':  va = computeContactPriority(a); vb = computeContactPriority(b); break
      default:                 va = a.businessName?.toLowerCase(); vb = b.businessName?.toLowerCase()
    }
    if (va < vb) return dir === 'asc' ? -1 :  1
    if (va > vb) return dir === 'asc' ?  1 : -1
    return 0
  })
}

export const matchesSearch = (lead, q) => {
  if (!q) return true
  const s = q.toLowerCase()
  return (
    lead.businessName?.toLowerCase().includes(s) ||
    lead.ownerName?.toLowerCase().includes(s) ||
    lead.phone?.toLowerCase().includes(s) ||
    lead.email?.toLowerCase().includes(s) ||
    lead.tags?.some(t => t.toLowerCase().includes(s))
  )
}

export const isFollowUpToday = (d) => {
  if (!d) return false
  return new Date(d).toDateString() === new Date().toDateString()
}

export const isFollowUpOverdue = (d) => {
  if (!d) return false
  const fu = new Date(d); fu.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)
  return fu < today
}

// ── Revenue helpers ──
export const getMonthlyClosedRevenue = (leads) => {
  const now = new Date()
  return leads
    .filter(l => l.stage === 'closed-won' && !l.archived)
    .filter(l => {
      const e = l.stageHistory?.find(s => s.stage === 'closed-won')
      if (!e) return false
      const d = new Date(e.timestamp)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, l) => s + (parseFloat(l.monthlyFee)||0), 0)
}

export const getTotalMRR = (leads) =>
  leads.filter(l => l.stage === 'closed-won' && !l.archived)
       .reduce((s,l) => s + (parseFloat(l.monthlyFee)||0), 0)

export const getPipelineValue = (leads) =>
  leads.filter(l => !l.archived && l.stage !== 'closed-lost' && l.stage !== 'do-not-call')
       .reduce((s,l) => s + calculateLTV(l.monthlyFee, l.setupFee), 0)

export const getWeightedPipelineValue = (leads) =>
  leads
    .filter(l => !l.archived && ACTIVE_STAGE_IDS.includes(l.stage))
    .reduce((s,l) => s + calculateLTV(l.monthlyFee, l.setupFee) * ((l.closeProbability || 0) / 100), 0)

export const getActiveMRRPotential = (leads) =>
  leads
    .filter(l => !l.archived && ACTIVE_STAGE_IDS.includes(l.stage))
    .reduce((s,l) => s + (parseFloat(l.monthlyFee)||0), 0)
