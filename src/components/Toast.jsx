import React, { createPortal } from 'react'
import { useCRM } from '../context/CRMContext'

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 4" stroke="#00FF88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="#FF3B3B" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#0088FF" strokeWidth="2"/>
      <path d="M8 7v4M8 5.5v.5" stroke="#0088FF" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3L14 13H2L8 3z" stroke="#FF9500" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M8 8v2M8 11.5v.5" stroke="#FF9500" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
}

const BORDER_COLORS = {
  success: 'border-l-[#00FF88]',
  error:   'border-l-[#FF3B3B]',
  info:    'border-l-[#0088FF]',
  warning: 'border-l-[#FF9500]',
}

function ToastItem({ toast }) {
  const { removeToast } = useCRM()

  return (
    <div
      className={`
        animate-slide-in-right flex items-center gap-3
        glass rounded-xl px-4 py-3 shadow-2xl
        border-l-2 ${BORDER_COLORS[toast.type] || 'border-l-white/20'}
        min-w-[240px] max-w-[360px]
      `}
    >
      <span className="flex-shrink-0">{ICONS[toast.type]}</span>
      <span className="text-sm flex-1 font-dm text-white/90">{toast.message}</span>

      {toast.undo && (
        <button
          onClick={() => { toast.undo.action(); removeToast(toast.id) }}
          className="text-xs font-semibold text-white/60 hover:text-white border border-white/15 rounded-md px-2 py-1 transition-colors flex-shrink-0"
        >
          {toast.undo.label || 'Undo'}
        </button>
      )}

      <button
        onClick={() => removeToast(toast.id)}
        className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 ml-1"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export default function Toast() {
  const { toasts } = useCRM()
  if (!toasts.length) return null

  return createPortal(
    <div id="toast-root">
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>,
    document.body
  )
}
