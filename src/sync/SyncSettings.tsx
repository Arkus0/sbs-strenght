import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../app/AppContext'
import { sendEmailOtp, signOut, synchronize, verifyEmailOtp } from './syncEngine'
import { supabase, supabaseConfigured } from './supabaseClient'

export function SyncSettings(): JSX.Element {
  const { state, replaceState, patchSync } = useAppState()
  const [email, setEmail] = useState(state.sync.email || '')
  const [token, setToken] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [message, setMessage] = useState('')
  const stateRef = useRef(state)
  const patchSyncRef = useRef(patchSync)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { patchSyncRef.current = patchSync }, [patchSync])

  async function runSync(userOverride?: any): Promise<void> {
    if (!supabase) return
    patchSyncRef.current({ status: navigator.onLine ? 'syncing' : 'offline', error: null })
    if (!navigator.onLine) return
    try {
      const user = userOverride || (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('Inicia sesión para sincronizar.')
      const result = await synchronize(stateRef.current, user)
      replaceState(result.state)
      setMessage(result.conflicts.length ? `${result.conflicts.length} conflicto(s) requieren revisión; se conservó la copia local.` : 'Sincronización completada.')
    } catch (error) {
      patchSyncRef.current({ status: 'error', error: error instanceof Error ? error.message : 'Error de sincronización' })
      setMessage(error instanceof Error ? error.message : 'Error de sincronización')
    }
  }

  useEffect(() => {
    if (!supabase) return undefined
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) patchSyncRef.current({ enabled: true, userId: session.user.id, email: session.user.email || null, status: 'idle' })
    })
    const online = (): void => { if (stateRef.current.sync.enabled) void runSync() }
    window.addEventListener('online', online)
    return () => { data.subscription.unsubscribe(); window.removeEventListener('online', online) }
  }, [])

  if (!supabaseConfigured) return <div className="sync-unavailable"><strong>Modo local activo</strong><p>Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para habilitar cuenta y sincronización. Entrenar offline no depende de ello.</p></div>

  if (state.sync.userId) return <div className="sync-connected"><div><strong>{state.sync.email}</strong><span>{state.sync.status === 'syncing' ? 'Sincronizando…' : state.sync.lastSyncedAt ? `Última sync: ${new Date(state.sync.lastSyncedAt).toLocaleString('es-ES')}` : 'Cuenta conectada'}</span></div><button onClick={() => void runSync()} disabled={state.sync.status === 'syncing'}>Sincronizar ahora</button><button onClick={() => void signOut().then(() => patchSync({ enabled: false, userId: null, email: null, status: 'local' }))}>Cerrar sesión</button>{message && <p>{message}</p>}</div>

  return <div className="sync-login"><p>La cuenta es opcional. Tu copia local sigue siendo la fuente principal.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>{otpSent && <label>Código de 6 dígitos<input inputMode="numeric" maxLength={6} value={token} onChange={(event) => setToken(event.target.value)} /></label>}<div>{!otpSent ? <button onClick={() => void sendEmailOtp(email).then(() => { setOtpSent(true); setMessage('Código enviado.') }).catch((error) => setMessage(error.message))} disabled={!email.includes('@')}>Enviar código</button> : <button onClick={() => void verifyEmailOtp(email, token).then((user) => runSync(user)).catch((error) => setMessage(error.message))} disabled={token.length !== 6}>Verificar y sincronizar</button>}</div>{message && <p>{message}</p>}</div>
}
