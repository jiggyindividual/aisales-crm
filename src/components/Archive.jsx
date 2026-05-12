import React, { useState } from 'react'
import { useCRM } from '../context/CRMContext'
import { SERVICES, formatDate, computeFlags } from '../utils/helpers'

export default function Archive() {
  const { leads, restoreLead, deleteLead, addToast } = useCRM()
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const archived = leads.filter(l => l.archived &&
    (!search || l.businessName?.toLowerCase().includes(search.toLowerCase()) ||
                l.phone?.includes(search))
  )

  const handleDelete = (id) => {
    deleteLead(id)
    setConfirmDelete(null)
  }

  return (
    <div className="p-5 lg:p-6 space-y-5 pb-24 lg:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-syne font-bold text-white text-2xl">Archive</h1>
        <span className="text-white/30 text-sm">{archived.length} archived leads</span>
      </div>

      <input
        className="input max-w-xs"
        placeholder="Search archived leads…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">🗃️</div>
          <h3 className="font-syne font-semibold text-white text-xl mb-2">Archive is empty</h3>
          <p className="text-white/30 text-sm">Archived leads will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {archived.map((lead, i) => {
            const svc = SERVICES[lead.service]
            return (
              <div
                key={lead.id}
                className="glass rounded-2xl p-4 flex items-center gap-4 card-enter"
                style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
              >
                <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: svc?.color || '#555' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{lead.businessName}</p>
                  <p className="text-white/40 text-xs">
                    {lead.ownerName} · {svc?.label} · Archived {formatDate(lead.dateAdded)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => restoreLead(lead.id)}
                    className="btn btn-ghost btn-sm text-[#00FF88]"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmDelete(lead.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full animate-fade-scale" onClick={e => e.stopPropagation()}>
            <h3 className="font-syne font-bold text-white text-lg mb-2">Permanently Delete?</h3>
            <p className="text-white/50 text-sm mb-5">This cannot be undone. The lead will be gone forever.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn btn-danger flex-1">Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
