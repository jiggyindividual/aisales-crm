import Papa from 'papaparse'
import { createDefaultLead, generateId, STAGES, INDUSTRIES } from './helpers'

export const CRM_FIELDS = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'ownerName',    label: 'Owner Name' },
  { key: 'email',        label: 'Email' },
  { key: 'phone',        label: 'Phone' },
  { key: 'address',      label: 'Address' },
  { key: 'mapsLink',     label: 'Google Maps Link' },
  { key: 'industry',     label: 'Industry' },
  { key: 'notes',        label: 'Notes' },
  { key: 'setupFee',     label: 'Setup Fee ($)' },
  { key: 'monthlyFee',   label: 'Monthly Fee ($)' },
  { key: 'leadSource',   label: 'Lead Source' },
  { key: 'phone',        label: 'Phone Number' },
]

export const parseCSVFile = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject,
    })
  })

export const mapRowToLead = (row, mapping, defaultService) => {
  const lead = createDefaultLead({ service: defaultService, id: generateId() })
  Object.entries(mapping).forEach(([crmKey, csvHeader]) => {
    if (!csvHeader || csvHeader === '__skip__') return
    const val = row[csvHeader]
    if (val === undefined || val === null || val === '') return
    switch (crmKey) {
      case 'setupFee':
      case 'monthlyFee':
        lead[crmKey] = parseFloat(String(val).replace(/[$,]/g, '')) || 0
        break
      case 'industry':
        lead.industry = INDUSTRIES.includes(val) ? val : 'Other'
        break
      default:
        lead[crmKey] = val
    }
  })
  return lead
}

export const detectDuplicates = (newLeads, existingLeads) =>
  newLeads.map(lead => {
    const match = existingLeads.find(e =>
      (lead.phone && e.phone && lead.phone.replace(/\D/g,'') === e.phone.replace(/\D/g,'')) ||
      (lead.businessName && e.businessName &&
        lead.businessName.trim().toLowerCase() === e.businessName.trim().toLowerCase())
    )
    return { lead, isDuplicate: !!match, duplicateMatch: match }
  })

export const exportLeadsToCSV = (leads, filename = 'park-crm-export') => {
  const rows = leads.map(l => ({
    'Business Name':   l.businessName,
    'Owner Name':      l.ownerName,
    'Email':           l.email,
    'Phone':           l.phone,
    'Best Time':       l.bestTimeToCall,
    'Address':         l.address,
    'Maps Link':       l.mapsLink,
    'Industry':        l.industry,
    'Has Website':     l.hasWebsite ? 'Yes' : 'No',
    'Service':         l.service === 'ai-website' ? 'AI Website' : l.service === 'ai-receptionist' ? 'AI Receptionist' : 'Both',
    'Lead Source':     l.leadSource,
    'Setup Fee':       l.setupFee,
    'Monthly Fee':     l.monthlyFee,
    'LTV':             (parseFloat(l.monthlyFee)||0)*12 + (parseFloat(l.setupFee)||0),
    'Stage':           STAGES.find(s=>s.id===l.stage)?.label || l.stage,
    'Priority':        l.priority,
    'Follow Up Date':  l.followUpDate,
    'Called':          l.called ? 'Yes' : 'No',
    'Email Sent':      l.emailSent ? 'Yes' : 'No',
    'Notes':           l.notes,
    'Tags':            l.tags?.join(', '),
    'Date Added':      l.dateAdded,
    'Last Contacted':  l.lastContacted || '',
    'Call Attempts':   l.callAttemptCount,
    'Pinned':          l.pinned ? 'Yes' : 'No',
    'Archived':        l.archived ? 'Yes' : 'No',
  }))
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
