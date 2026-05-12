import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react'
import { createDefaultLead, generateId, calculateLTV } from '../utils/helpers'

const CRMContext = createContext(null)

const STORAGE_KEY = 'park-crm-v1'

const defaultSettings = { monthlyGoal: 0, staleThreshold: 7, coldThreshold: 5 }
const defaultOnboarding = { addedFirstLead: false, importedCSV: false, setRevenueGoal: false, dismissed: false }

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        leads: parsed.leads || [],
        settings: { ...defaultSettings, ...(parsed.settings || {}) },
        serviceFilter: parsed.serviceFilter || 'all',
        onboarding: { ...defaultOnboarding, ...(parsed.onboarding || {}) },
        toasts: [],
        activeModal: null,
      }
    }
  } catch {}
  return {
    leads: [],
    settings: defaultSettings,
    serviceFilter: 'all',
    onboarding: defaultOnboarding,
    toasts: [],
    activeModal: null,
  }
}

const save = (state) => {
  try {
    const { toasts, activeModal, ...persist } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist))
  } catch {}
}

function reducer(state, action) {
  let next = state

  switch (action.type) {
    case 'ADD_LEAD': {
      const lead = { ...createDefaultLead(), ...action.lead, id: generateId() }
      lead.ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
      next = { ...state, leads: [...state.leads, lead] }
      break
    }
    case 'UPDATE_LEAD': {
      next = {
        ...state,
        leads: state.leads.map(l => {
          if (l.id !== action.id) return l
          const u = { ...l, ...action.updates }
          u.ltv = calculateLTV(u.monthlyFee, u.setupFee)
          return u
        }),
      }
      break
    }
    case 'CHANGE_STAGE': {
      next = {
        ...state,
        leads: state.leads.map(l => {
          if (l.id !== action.id) return l
          return {
            ...l,
            stage: action.stage,
            stageHistory: [...(l.stageHistory || []), { stage: action.stage, timestamp: new Date().toISOString(), note: action.note || '' }],
          }
        }),
      }
      break
    }
    case 'LOG_ACTIVITY': {
      const entry = { id: generateId(), ...action.activity, date: action.activity.date || new Date().toISOString() }
      next = {
        ...state,
        leads: state.leads.map(l => {
          if (l.id !== action.leadId) return l
          const isCall = action.activity.type === 'call'
          return {
            ...l,
            activities: [...(l.activities || []), entry],
            lastContacted: entry.date,
            callAttemptCount: isCall ? (l.callAttemptCount || 0) + 1 : (l.callAttemptCount || 0),
          }
        }),
      }
      break
    }
    case 'ARCHIVE_LEAD':
      next = { ...state, leads: state.leads.map(l => l.id === action.id ? { ...l, archived: true } : l) }
      break
    case 'UNARCHIVE_LEAD':
      next = { ...state, leads: state.leads.map(l => l.id === action.id ? { ...l, archived: false } : l) }
      break
    case 'DELETE_LEAD':
      next = { ...state, leads: state.leads.filter(l => l.id !== action.id) }
      break
    case 'BULK_UPDATE': {
      const { ids, updates } = action
      next = {
        ...state,
        leads: state.leads.map(l => {
          if (!ids.includes(l.id)) return l
          const u = { ...l, ...updates }
          if (updates.stage) {
            u.stageHistory = [...(l.stageHistory||[]), { stage: updates.stage, timestamp: new Date().toISOString() }]
          }
          u.ltv = calculateLTV(u.monthlyFee, u.setupFee)
          return u
        }),
      }
      break
    }
    case 'IMPORT_LEADS': {
      const imported = action.leads.map(l => {
        const lead = { ...createDefaultLead(), ...l, id: generateId() }
        lead.ltv = calculateLTV(lead.monthlyFee, lead.setupFee)
        return lead
      })
      next = { ...state, leads: [...state.leads, ...imported] }
      break
    }
    case 'UPDATE_SETTINGS':
      next = { ...state, settings: { ...state.settings, ...action.settings } }
      break
    case 'SET_SERVICE_FILTER':
      next = { ...state, serviceFilter: action.filter }
      break
    case 'COMPLETE_ONBOARDING':
      next = { ...state, onboarding: { ...state.onboarding, [action.step]: true } }
      break
    case 'DISMISS_ONBOARDING':
      next = { ...state, onboarding: { ...state.onboarding, dismissed: true } }
      break
    case 'ADD_TOAST': {
      const toast = { id: generateId(), ...action.toast }
      next = { ...state, toasts: [...state.toasts, toast] }
      return next // don't save toasts
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) }
    case 'SET_MODAL':
      return { ...state, activeModal: action.modal }
    case 'CLEAR_ALL':
      next = { ...state, leads: [], onboarding: defaultOnboarding }
      break
    default:
      return state
  }

  save(next)
  return next
}

export function CRMProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, load)
  const toastTimers = useRef({})

  /* ── Leads ── */
  const addLead = useCallback((lead) => {
    dispatch({ type: 'ADD_LEAD', lead })
    dispatch({ type: 'COMPLETE_ONBOARDING', step: 'addedFirstLead' })
    toast('Lead added', 'success')
  }, [])

  const updateLead = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_LEAD', id, updates })
  }, [])

  const changeStage = useCallback((id, stage, note) => {
    dispatch({ type: 'CHANGE_STAGE', id, stage, note })
    toast(`Stage → ${stage.replace(/-/g,' ')}`, 'success')
  }, [])

  const logActivity = useCallback((leadId, activity) => {
    dispatch({ type: 'LOG_ACTIVITY', leadId, activity })
  }, [])

  const archiveLead = useCallback((id) => {
    dispatch({ type: 'ARCHIVE_LEAD', id })
    toast('Lead archived', 'info', {
      label: 'Undo',
      action: () => dispatch({ type: 'UNARCHIVE_LEAD', id }),
    })
  }, [])

  const restoreLead = useCallback((id) => {
    dispatch({ type: 'UNARCHIVE_LEAD', id })
    toast('Lead restored', 'success')
  }, [])

  const deleteLead = useCallback((id) => {
    dispatch({ type: 'DELETE_LEAD', id })
    toast('Lead deleted', 'error')
  }, [])

  const bulkUpdate = useCallback((ids, updates) => {
    dispatch({ type: 'BULK_UPDATE', ids, updates })
    toast(`${ids.length} leads updated`, 'success')
  }, [])

  const importLeads = useCallback((leads) => {
    dispatch({ type: 'IMPORT_LEADS', leads })
    dispatch({ type: 'COMPLETE_ONBOARDING', step: 'importedCSV' })
    toast(`${leads.length} leads imported`, 'success')
  }, [])

  /* ── Settings ── */
  const updateSettings = useCallback((settings) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings })
    if (settings.monthlyGoal !== undefined) {
      dispatch({ type: 'COMPLETE_ONBOARDING', step: 'setRevenueGoal' })
    }
  }, [])

  /* ── Filter ── */
  const setServiceFilter = useCallback((filter) => {
    dispatch({ type: 'SET_SERVICE_FILTER', filter })
  }, [])

  /* ── Onboarding ── */
  const dismissOnboarding = useCallback(() => {
    dispatch({ type: 'DISMISS_ONBOARDING' })
  }, [])

  /* ── Modal ── */
  const openModal = useCallback((modal) => dispatch({ type: 'SET_MODAL', modal }), [])
  const closeModal = useCallback(() => dispatch({ type: 'SET_MODAL', modal: null }), [])

  /* ── Clear all ── */
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
    toast('All data cleared', 'error')
  }, [])

  /* ── Toast ── */
  const removeToast = useCallback((id) => {
    clearTimeout(toastTimers.current[id])
    dispatch({ type: 'REMOVE_TOAST', id })
  }, [])

  function toast(message, type = 'info', undo = null) {
    const id = generateId()
    dispatch({ type: 'ADD_TOAST', toast: { id, message, type, undo } })
    toastTimers.current[id] = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id })
    }, 5000)
    return id
  }

  const addToast = useCallback((message, type, undo) => toast(message, type, undo), [])

  const value = {
    ...state,
    addLead, updateLead, changeStage, logActivity,
    archiveLead, restoreLead, deleteLead,
    bulkUpdate, importLeads,
    updateSettings, setServiceFilter,
    dismissOnboarding, openModal, closeModal,
    clearAll, addToast, removeToast,
  }

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>
}

export const useCRM = () => {
  const ctx = useContext(CRMContext)
  if (!ctx) throw new Error('useCRM must be used within CRMProvider')
  return ctx
}
