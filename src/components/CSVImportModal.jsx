import React, { useState, useRef } from 'react'
import { useCRM } from '../context/CRMContext'
import { parseCSVFile, CRM_FIELDS, mapRowToLead, detectDuplicates } from '../utils/csvUtils'
import { SERVICES } from '../utils/helpers'

const STEPS = ['Upload', 'Map Columns', 'Review', 'Done']

export default function CSVImportModal({ onClose }) {
  const { leads, importLeads } = useCRM()
  const fileRef = useRef(null)
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [defaultService, setDefaultService] = useState('ai-website')
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([]) // { lead, isDuplicate, duplicateMatch, skip }
  const [importCount, setImportCount] = useState(0)
  const [error, setError] = useState('')

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    setError('')
    try {
      const result = await parseCSVFile(f)
      setHeaders(result.meta.fields || [])
      setRows(result.data)
      // Auto-map: try to match header names to CRM fields
      const auto = {}
      const fieldMap = {
        businessname: 'businessName', 'business name': 'businessName', business: 'businessName',
        ownername: 'ownerName', 'owner name': 'ownerName', owner: 'ownerName', contact: 'ownerName',
        email: 'email', 'email address': 'email',
        phone: 'phone', 'phone number': 'phone', cell: 'phone', mobile: 'phone',
        address: 'address',
        notes: 'notes', note: 'notes',
        setupfee: 'setupFee', 'setup fee': 'setupFee',
        monthlyfee: 'monthlyFee', 'monthly fee': 'monthlyFee', mrr: 'monthlyFee',
        industry: 'industry', category: 'industry',
        leadsource: 'leadSource', 'lead source': 'leadSource', source: 'leadSource',
      }
      result.meta.fields.forEach(h => {
        const key = fieldMap[h.toLowerCase().trim()]
        if (key) auto[key] = h
      })
      setMapping(auto)
    } catch (e) {
      setError('Failed to parse CSV. Make sure it has a header row.')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) handleFile(f)
  }

  const buildPreview = () => {
    const mapped = rows.map(r => mapRowToLead(r, mapping, defaultService))
    const checked = detectDuplicates(mapped, leads)
    setPreview(checked.map(c => ({ ...c, skip: c.isDuplicate })))
  }

  const handleImport = () => {
    const toImport = preview.filter(p => !p.skip).map(p => p.lead)
    importLeads(toImport)
    setImportCount(toImport.length)
    setStep(3)
  }

  const canNext = () => {
    if (step === 0) return !!file && rows.length > 0
    if (step === 1) return Object.values(mapping).some(Boolean)
    if (step === 2) return preview.some(p => !p.skip)
    return false
  }

  const next = () => {
    if (step === 1) buildPreview()
    setStep(s => s + 1)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-scale"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div>
            <h2 className="font-syne font-bold text-white text-lg">Import CSV</h2>
            <p className="text-xs text-white/40 mt-0.5">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-6 pt-4 pb-2 gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-1 rounded-full ${i <= step ? 'bg-white' : 'bg-white/15'}`} />
              <span className={`text-[10px] ${i === step ? 'text-white/70' : 'text-white/20'}`}>{s}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 0: Upload */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-2 block">Default service for imported leads</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(SERVICES).map(([key, svc]) => (
                    <button
                      key={key}
                      onClick={() => setDefaultService(key)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        defaultService === key
                          ? 'text-black border-transparent'
                          : 'border-white/10 text-white/40 hover:border-white/20'
                      }`}
                      style={defaultService === key ? { background: svc.color } : {}}
                    >
                      {svc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer
                  ${file ? 'border-white/30 bg-white/[0.04]' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.02]'}`}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
                {file ? (
                  <div>
                    <div className="text-3xl mb-2">📊</div>
                    <p className="text-white font-semibold">{file.name}</p>
                    <p className="text-white/40 text-sm mt-1">{rows.length} rows detected</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-3xl mb-3">📂</div>
                    <p className="text-white/70 font-medium">Drop CSV here or click to browse</p>
                    <p className="text-white/30 text-xs mt-1">Must have a header row</p>
                  </div>
                )}
              </div>
              {error && <p className="text-[#FF3B3B] text-sm">{error}</p>}
            </div>
          )}

          {/* Step 1: Map Columns */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-white/40 text-xs mb-3">Map your CSV columns to CRM fields. Fields without a match will be skipped.</p>
              {CRM_FIELDS.filter((f, i, arr) => arr.findIndex(x => x.key === f.key) === i).map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <div className="w-40 text-sm text-white/60 flex-shrink-0">{field.label}</div>
                  <select
                    className="input flex-1"
                    value={mapping[field.key] || '__skip__'}
                    onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value === '__skip__' ? '' : e.target.value }))}
                  >
                    <option value="__skip__">— Skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/50 text-xs">{preview.filter(p=>!p.skip).length} of {preview.length} will be imported</p>
                <button
                  onClick={() => setPreview(p => p.map(x => ({ ...x, skip: false })))}
                  className="text-xs text-white/40 hover:text-white/70"
                >
                  Include all
                </button>
              </div>
              {preview.slice(0, 100).map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    item.skip
                      ? 'border-white/[0.04] opacity-40'
                      : item.isDuplicate
                      ? 'border-[#FF9500]/30 bg-[#FF9500]/[0.04]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!item.skip}
                    onChange={e => setPreview(p => p.map((x, j) => j === i ? { ...x, skip: !e.target.checked } : x))}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.lead.businessName || '(unnamed)'}</p>
                    <p className="text-xs text-white/40 truncate">{item.lead.phone} {item.lead.ownerName ? `· ${item.lead.ownerName}` : ''}</p>
                  </div>
                  {item.isDuplicate && (
                    <span className="badge text-[10px] font-semibold" style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500' }}>
                      Duplicate
                    </span>
                  )}
                </div>
              ))}
              {preview.length > 100 && (
                <p className="text-white/30 text-xs text-center">+ {preview.length - 100} more…</p>
              )}
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="font-syne font-bold text-white text-xl mb-2">Import Complete</h3>
              <p className="text-white/50">{importCount} leads added to your CRM</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
          {step < 3 && (
            <>
              <button
                onClick={step === 0 ? onClose : () => setStep(s => s - 1)}
                className="btn btn-ghost flex-1"
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < 2 ? (
                <button onClick={next} disabled={!canNext()} className="btn btn-primary flex-1">
                  Next
                </button>
              ) : (
                <button onClick={handleImport} disabled={!canNext()} className="btn btn-primary flex-1">
                  Import {preview.filter(p=>!p.skip).length} Leads
                </button>
              )}
            </>
          )}
          {step === 3 && (
            <button onClick={onClose} className="btn btn-primary w-full">Done</button>
          )}
        </div>
      </div>
    </div>
  )
}
