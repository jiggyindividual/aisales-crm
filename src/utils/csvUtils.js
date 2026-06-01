import Papa from 'papaparse'
import { createDefaultLead, generateId, STAGES } from './helpers'

// ── Fields the CRM can import ─────────────────────────────────────────────────
export const CRM_FIELDS = [
  { key: 'businessName',   label: 'Business Name',    required: true  },
  { key: 'ownerName',      label: 'Contact Name',     required: false },
  { key: 'phone',          label: 'Phone',            required: false },
  { key: 'email',          label: 'Email',            required: false },
  { key: 'address',        label: 'Address',          required: false },
  { key: 'currentWebsite', label: 'Website',          required: false },
  { key: 'mapsLink',       label: 'Google Maps Link', required: false },
  { key: 'industry',       label: 'Industry',         required: false },
  { key: 'ratings',        label: 'Ratings',          required: false },
  { key: 'reviews',        label: 'Reviews',          required: false },
  { key: 'notes',          label: 'Notes',            required: false },
]

// ── Auto-mapping: common CSV header → CRM field key ──────────────────────────
export const AUTO_MAP = {
  // Business name
  'business name': 'businessName', businessname: 'businessName',
  business: 'businessName', 'company name': 'businessName',
  company: 'businessName', name: 'businessName',

  // Contact name
  'contact name': 'ownerName', 'owner name': 'ownerName',
  ownername: 'ownerName', owner: 'ownerName',
  contact: 'ownerName', 'contact person': 'ownerName',

  // Phone
  phone: 'phone', 'phone number': 'phone', phonenumber: 'phone',
  cell: 'phone', mobile: 'phone', tel: 'phone', telephone: 'phone',

  // Email
  email: 'email', 'email address': 'email', emailaddress: 'email',

  // Address
  address: 'address', location: 'address', 'street address': 'address',

  // Their website
  website: 'currentWebsite', 'website url': 'currentWebsite',
  websiteurl: 'currentWebsite', url: 'currentWebsite',
  'current website': 'currentWebsite', site: 'currentWebsite',
  'their website': 'currentWebsite', 'existing website': 'currentWebsite',

  // Google Maps
  'google maps': 'mapsLink', 'maps link': 'mapsLink',
  mapslink: 'mapsLink', maps: 'mapsLink',
  'map link': 'mapsLink', 'google maps link': 'mapsLink',
  'place url': 'mapsLink',

  // Industry
  industry: 'industry', category: 'industry', type: 'industry',
  'business type': 'industry', sector: 'industry', niche: 'industry',

  // Ratings
  rating: 'ratings', ratings: 'ratings', stars: 'ratings',
  'star rating': 'ratings', 'google rating': 'ratings',
  'avg rating': 'ratings', 'average rating': 'ratings',

  // Reviews
  reviews: 'reviews', review: 'reviews', 'review count': 'reviews',
  'num reviews': 'reviews', 'number of reviews': 'reviews',
  'total reviews': 'reviews', reviewcount: 'reviews',
  'google reviews': 'reviews',

  // Notes
  notes: 'notes', note: 'notes', comments: 'notes', comment: 'notes',
  description: 'notes',
}

// ── Auto-detect mapping from CSV headers ──────────────────────────────────────
export const autoDetectMapping = (headers) => {
  const mapping = {}
  headers.forEach(h => {
    const key = AUTO_MAP[h.toLowerCase().trim()]
    if (key) mapping[key] = h
  })
  return mapping
}

export const parseCSVFile = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    })
  })

export const mapRowToLead = (row, mapping) => {
  const lead = createDefaultLead({ id: generateId() })

  Object.entries(mapping).forEach(([crmKey, csvHeader]) => {
    if (!csvHeader || csvHeader === '__skip__') return
    const val = row[csvHeader]
    if (val === undefined || val === null || String(val).trim() === '') return
    const str = String(val).trim()

    switch (crmKey) {
      case 'ratings':
        lead.ratings = parseFloat(str.replace(/[^0-9.]/g, '')) || ''
        break
      case 'reviews':
        lead.reviews = parseInt(str.replace(/[^0-9]/g, ''), 10) || ''
        break
      case 'industry':
        // Accept any industry value — workspace tabs are dynamic
        lead.industry = str
        break
      default:
        lead[crmKey] = str
    }
  })

  return lead
}

export const detectDuplicates = (newLeads, existingLeads) =>
  newLeads.map(lead => {
    const match = existingLeads.find(e =>
      (lead.phone && e.phone &&
        lead.phone.replace(/\D/g,'') === e.phone.replace(/\D/g,'')) ||
      (lead.businessName && e.businessName &&
        lead.businessName.trim().toLowerCase() === e.businessName.trim().toLowerCase())
    )
    return { lead, isDuplicate: !!match, duplicateMatch: match }
  })

export const exportLeadsToCSV = (leads, filename = 'park-crm-export') => {
  const rows = leads.map(l => ({
    'Business Name':    l.businessName,
    'Contact Name':     l.ownerName,
    'Phone':            l.phone,
    'Email':            l.email,
    'Address':          l.address,
    'Website':          l.currentWebsite || l.website || '',
    'Google Maps Link': l.mapsLink,
    'Industry':         l.industry,
    'Ratings':          l.ratings || '',
    'Reviews':          l.reviews || '',
    'Stage':            STAGES.find(s=>s.id===l.stage)?.label || l.stage,
    'Our Website':      l.ourWebsite || 'none',
    'Not Int. Reason':  l.notInterestedReason || '',
    'Win/Loss Reason':  l.winLossReason || '',
    'Last Contacted':   l.lastContacted || '',
    'Call Attempts':    l.callAttemptCount || 0,
    'Notes':            l.notes,
    'Next Step':        l.nextStep || '',
    'Date Added':       l.dateAdded,
  }))
  const csv  = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
