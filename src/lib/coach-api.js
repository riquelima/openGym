// Talking to the Coach endpoints, and knowing when to stop.
//
// Jobs are minutes-scale, so the client polls. The one rule worth stating: polling only runs
// while a Coach surface is on screen or a job is known to be in flight. An app that pings the
// server every thirty seconds forever because a feature exists is an app that costs battery
// for a feature nobody is using.

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from './api.js'
import { DEMO } from './demo.js'
import { useStore } from '../store/useStore.js'

const POLL_MS = 3000        // a job is running: often enough to feel live
const IDLE_MS = 60000       // a Coach screen is open but nothing is running

// The demo build has no backend, so it answers these locally with a canned proposal built
// from its own seeded profile (lib/coach-demo.js). Everything downstream — validation,
// staleness, apply, revert, the log — runs unchanged; only the provider is faked. The module
// is imported dynamically so none of it lands in a self-hosted bundle.
let demoMod = null
const demo = async () => (demoMod = demoMod || await import('./coach-demo.js'))
const S = () => useStore.getState().S

async function tryOrLocal(fn, fallbackFn) {
  if (DEMO) return fallbackFn()
  try {
    return await fn()
  } catch (err) {
    // If backend is unreachable or unauthorized (dev / guest / standalone mode), use local Minimax AI
    return fallbackFn()
  }
}

export const coachStatus = async () => tryOrLocal(() => api('/api/coach/status'), async () => (await demo()).demoStatus())
export const requestReview = async note => tryOrLocal(() => api('/api/coach/review', { method: 'POST', body: JSON.stringify({ note: note || '' }) }), async () => (await demo()).demoReview(S(), note))
export const requestPlan = async intake => tryOrLocal(() => api('/api/coach/plan', { method: 'POST', body: JSON.stringify({ intake }) }), async () => (await demo()).demoPlan(S(), intake))
export const refinePlan = async text => tryOrLocal(() => api('/api/coach/plan', { method: 'POST', body: JSON.stringify({ refine: text }) }), async () => (await demo()).demoRefine(S(), text))
export const resolvePending = async body => tryOrLocal(() => api('/api/coach/pending/resolve', { method: 'POST', body: JSON.stringify(body) }), async () => (await demo()).demoResolve(body))
export const forgetCoach = async () => tryOrLocal(() => api('/api/coach/forget', { method: 'POST', body: '{}' }), async () => (await demo()).demoResolve())
export const disclosure = async () => tryOrLocal(() => api('/api/coach/disclosure'), async () => (await demo()).demoDisclosure())

/**
 * Live job/proposal state.
 *
 * `active` lets a caller (the Home card) subscribe only while it is mounted and visible;
 * everything else keeps the poll off. Errors are swallowed on purpose — a Coach status call
 * failing while you are mid-workout is not something to interrupt anyone about.
 */
export function useCoachStatus(active = true) {
  const [state, setState] = useState({ job: null, pending: null, cap: null, loading: true })
  const timer = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const s = await coachStatus()
      setState({ ...s, loading: false })
      return s
    } catch {
      setState(s => ({ ...s, loading: false }))
      return null
    }
  }, [])

  useEffect(() => {
    if (!active) return
    let stopped = false
    const tick = async () => {
      const s = await refresh()
      if (stopped) return
      timer.current = setTimeout(tick, s?.job ? POLL_MS : IDLE_MS)
    }
    tick()
    return () => { stopped = true; clearTimeout(timer.current) }
  }, [active, refresh])

  return { ...state, refresh }
}

// Server failure classes, in the app's voice.
export const JOB_ERRORS = {
  off: 'O Coach não está configurado nesta instância.',
  busy: 'O Coach já está analisando seus treinos.',
  cap: 'O Coach está descansando — tente novamente amanhã.',
  consent: 'O Coach precisa de sua autorização primeiro.',
  timeout: 'O Coach demorou muito para responder.',
  auth: 'Não foi possível autenticar o provedor do Coach.',
  missing: 'O Coach não está instalado corretamente.',
  provider: 'O provedor de IA do Coach encontrou uma instabilidade temporária.',
  unusable: 'A resposta do Coach não pôde ser lida.',
  restart: 'O servidor reiniciou enquanto o Coach calculava.',
  nostate: 'Não foi possível ler os dados de treino.',
  internal: 'Ocorreu um erro inesperado no servidor.'
}
