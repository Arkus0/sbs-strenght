import { normalizeImportedSetup } from './sbsRtf.js'

const KEY = 'sbs_strength_state_v1'

export function initialState() {
  return {
    setup: null,
    logs: {},
    selectedSessionId: null
  }
}

export function loadState(template) {
  if (typeof localStorage === 'undefined') return initialState()
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw || typeof raw !== 'object') return initialState()
    return {
      ...initialState(),
      ...raw,
      setup: raw.setup ? normalizeImportedSetup(template, raw.setup) : null,
      logs: raw.logs && typeof raw.logs === 'object' ? raw.logs : {}
    }
  } catch {
    return initialState()
  }
}

export function saveState(state) {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function exportState(state) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'sbs-strength',
      version: 1,
      state
    },
    null,
    2
  )
}

export function parseImport(template, text) {
  const parsed = JSON.parse(text)
  const state = parsed.state || parsed
  if (!state || typeof state !== 'object') throw new Error('Archivo no valido')
  return {
    ...initialState(),
    ...state,
    setup: state.setup ? normalizeImportedSetup(template, state.setup) : null,
    logs: state.logs && typeof state.logs === 'object' ? state.logs : {}
  }
}

export function clearStoredState() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
}
