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

export const STAGES = [
  { id: 'cold',                 label: 'Cold/Not Called',       color: '#555555' },
  { id: 'called-no-answer',     label: 'Called–No Answer',      color: '#777777' },
  { id: 'contacted-interested', label: 'Contacted–Interested',  color: '#0088FF' },
  { id: 'demo-sent',            label: 'Demo Sent',             color: '#9B59B6' },
  { id: 'proposal-sent',        label: 'Proposal Sent',         color: '#FF9500' },
  { id: 'closed-won',           label: 'Closed Won',            color: '#00FF88' },
  { id: 'closed-lost',          label: 'Closed Lost',           color: '#FF3B3B' },
  { id: 'do-not-call',          label: 'Do Not Call',           color: '#333333' },
]

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

export const CALL_OUTCOMES = ['Answered','No Answer','Voicemail']

export const getStage = (id) => STAGES.find(s => s.id === id) || STAGES[0]

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
  return flags
}

export const getCardGlowClass = (flags) => {
  if (flags.some(f => f.type === 'overdue'))   return 'overdue-glow'
  if (flags.some(f => f.type === 'stale'))     return 'stale-glow'
  if (flags.some(f => f.type === 'gone-cold')) return 'gone-cold-glow'
  if (flags.some(f => f.type === 'on-fire'))   return 'on-fire-glow'
  return ''
}

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

export const createDefaultLead = (overrides = {}) => ({
  id:               generateId(),
  businessName:     '',
  ownerName:        '',
  email:            '',
  phone:            '',
  bestTimeToCall:   'Morning',
  address:          '',
  mapsLink:         '',
  industry:         'Other',
  hasWebsite:       false,
  service:          'ai-website',
  leadSource:       'Cold Call',
  setupFee:         0,
  monthlyFee:       0,
  stage:            'cold',
  followUpDate:     '',
  priority:         'Cold',
  called:           false,
  emailSent:        false,
  notes:            '',
  tags:             [],
  pinned:           false,
  archived:         false,
  dateAdded:        new Date().toISOString(),
  lastContacted:    null,
  callAttemptCount: 0,
  stageHistory:     [{ stage: 'cold', timestamp: new Date().toISOString() }],
  activities:       [],
  ...overrides,
})

export const filterByService = (leads, filter) => {
  if (!filter || filter === 'all') return leads
  return leads.filter(l => l.service === filter)
}

export const sortLeads = (leads, sort, dir) => {
  return [...leads].sort((a, b) => {
    let va, vb
    switch (sort) {
      case 'businessName': va = a.businessName?.toLowerCase(); vb = b.businessName?.toLowerCase(); break
      case 'stage':        va = STAGES.findIndex(s=>s.id===a.stage); vb = STAGES.findIndex(s=>s.id===b.stage); break
      case 'priority':     va = ['Hot','Warm','Cold'].indexOf(a.priority); vb = ['Hot','Warm','Cold'].indexOf(b.priority); break
      case 'ltv':          va = calculateLTV(a.monthlyFee,a.setupFee); vb = calculateLTV(b.monthlyFee,b.setupFee); break
      case 'followUpDate': va = a.followUpDate||'zzz'; vb = b.followUpDate||'zzz'; break
      case 'dateAdded':    va = a.dateAdded; vb = b.dateAdded; break
      case 'lastContacted':va = a.lastContacted||''; vb = b.lastContacted||''; break
      case 'callAttempts': va = a.callAttemptCount||0; vb = b.callAttemptCount||0; break
      default:             va = a.businessName?.toLowerCase(); vb = b.businessName?.toLowerCase()
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
