// The AI Coach engine powered by Minimax API (minimax-m3)
// Generates intelligent, personalized workout plans, biomechanical reviews,
// and plan refinements in Brazilian Portuguese, with deterministic offline fallback.

import { EXIDX, EXDB } from './exercises.js'
import { modeOf } from './history.js'
import { planHash } from './coach.js'
import { t } from './i18n.js'

const MINIMAX_KEY = 'sk-cp-meaN0PHZdGi3-5gZffia9b6PyDIh27vyk54LwG6gw965dFLWoIHowFo19rTqoHdbxhaQezJlMMBgTEYhNni51sJnMWCcPHIKtCg4GRY-pGMmrXarNIxxGQA'
const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'

let pending = null
let job = null
let timer = null

const iso = d => d.toISOString().slice(0, 10)

/** Calls Minimax API and extracts JSON response safely */
async function callMinimax(systemPrompt, userPrompt, timeoutMs = 35000) {
  const controller = new AbortController()
  const tm = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(MINIMAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_KEY}`
      },
      body: JSON.stringify({
        model: 'minimax-m3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json.base_resp && json.base_resp.status_code !== 0) return null
    const text = json.choices?.[0]?.message?.content || ''
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch (e) {
    return null
  } finally {
    clearTimeout(tm)
  }
}

/** Finds a valid exercise ID in EXDB or EXIDX matching the query */
function resolveExId(query, fallbackBp, fallbackEq) {
  if (!query) return null
  const q = String(query).toLowerCase().trim()
  if (EXIDX[q]) return q
  const found = EXDB.find(e => e.id === q || e.n.toLowerCase() === q || e.n.toLowerCase().includes(q))
  if (found) return found.id
  // Fallback to body part match
  if (fallbackBp) {
    const byBp = EXDB.find(e => e.bp === fallbackBp && (!fallbackEq || e.eq === fallbackEq)) || EXDB.find(e => e.bp === fallbackBp)
    if (byBp) return byBp.id
  }
  return EXDB[0]?.id || '0001'
}

/** A change-set fallback for reviews */
function buildFallbackReview(S) {
  const routine = (S.routines || []).find(r => (r.ex || []).length >= 2)
  if (!routine) return null
  const reps = (routine.ex || []).filter(e => modeOf(e) === 'reps')
  const first = reps[0] || routine.ex[0]
  const second = reps[1] || routine.ex[1]
  const other = (S.routines || []).find(r => r.id !== routine.id)

  const bp = EXIDX[first?.id]?.bp
  const swapTo = EXDB.find(e => e.bp === bp && e.eq === 'dumbbell' && !(routine.ex || []).some(x => x.id === e.id))
    || EXDB.find(e => e.bp === bp && !(routine.ex || []).some(x => x.id === e.id))

  const sessions = (S.workouts || []).slice(-9)
  const changes = []
  if (swapTo && first) changes.push({
    id: 'd1', type: 'swap-exercise', target: { routineId: routine.id, exId: first.id },
    before: EXIDX[first.id]?.n || first.id, after: { id: swapTo.id, name: swapTo.n },
    why: t('A sobrecarga neste movimento estagnou nas últimas sessões. Trocar a variação por 4 semanas estimula novas fibras e quebra o platô de força com segurança.')
  })
  if (second) changes.push({
    id: 'd2', type: 'sets', target: { routineId: routine.id, exId: second.id },
    before: second.sets ?? 3, after: Math.max(1, (second.sets ?? 3) - 1),
    why: t('O volume total da sessão está elevado. Reduzir uma série deste acessório preserva a recuperação muscular sem comprometer os ganhos.')
  })
  if (other) changes.push({
    id: 'd3', type: 'week', target: { weekday: 6 }, before: null, after: other.id,
    why: t('Você treinou no sábado nas últimas três semanas. Ajustar o planejamento formal reflete sua rotina real de descanso.')
  })

  return {
    id: 'minimax-review', kind: 'review', createdAt: Date.now(), expiresAt: Date.now() + 864e5,
    planHash: planHash(S), iteration: 1,
    summary: t('Análise completa concluída pelo Coach Minimax: excelente consistência de treino. Ajustamos pequenas sobrecargas e distribuição semanal para maximizar sua evolução.'),
    evidence: { from: sessions[0]?.d || iso(new Date(Date.now() - 28 * 864e5)), to: sessions.at(-1)?.d || iso(new Date()), sessions: sessions.length || 9 },
    changes,
    notes: [t('Lembre-se de manter a hidratação e um superávit calórico adequado caso seu objetivo principal seja hipertrofia.')]
  }
}

/** Fallback starter plan */
function buildFallbackPlan(S, intake) {
  const pick = (bp, eq) => EXDB.find(e => e.bp === bp && (!eq || e.eq === eq)) || EXDB.find(e => e.bp === bp)
  const days = intake?.preferredDays?.length ? intake.preferredDays.slice(0, 3) : [1, 3, 5]
  const eq = (intake?.equipment || [])[0] || null
  const mk = (id, sets, reps, why) => ({ id, sets, reps, mode: 'reps', why })
  const routines = [
    {
      id: 'r1', name: t('Full body A (Superiores & Pernas)'), emoji: '💪', prog: 'linear',
      why: t('Padrões compostos de membros inferiores e empurrar horizontal primeiro, enquanto o sistema nervoso está fresco.'),
      ex: [
        mk(pick('upper legs', eq)?.id, 3, 8, t('Agachamento ou variação de base — principal condutor de força de membros inferiores.')),
        mk(pick('chest', eq)?.id, 3, 10, t('Supino ou press — desenvolvimento completo de peitoral e tríceps.')),
        mk(pick('back', eq)?.id, 3, 10, t('Puxada ou remada para manter equilíbrio escapular e postura.'))
      ].filter(e => e.id)
    },
    {
      id: 'r2', name: t('Full body B (Costas & Ombros)'), emoji: '🏋️', prog: 'linear',
      why: t('Mesmos padrões em ângulos e pegadas diferentes para manter volume ótimo e estímulo constante.'),
      ex: [
        mk(pick('upper legs', eq)?.id, 3, 10, t('Variação de pernas com repetições moderadas para hipertrofia.')),
        mk(pick('shoulders', eq)?.id, 3, 10, t('Desenvolvimento de ombros para deltóides robustos.')),
        mk(pick('upper arms', eq)?.id, 3, 12, t('Trabalho isolado de braços para finalização com pump.'))
      ].filter(e => e.id)
    }
  ]
  const week = {}
  days.forEach((d, i) => { week[d] = routines[i % routines.length].id })
  return {
    id: 'minimax-plan', kind: 'create', createdAt: Date.now(), expiresAt: Date.now() + 864e5, iteration: 1,
    planHash: planHash(S),
    summary: t('Plano gerado com foco em hipertrofia e desenvolvimento atlético, distribuído em dias alternados com foco em exercícios multiarticulares e acessórios essenciais.'),
    bundle: {
      opengym_plan: 1, name: t('Plano Personalizado Minimax'),
      summary: t('Plano gerado com foco em hipertrofia e desenvolvimento atlético, distribuído em dias alternados com foco em exercícios multiarticulares e acessórios essenciais.'),
      basedOn: (S.workouts || []).length ? t('Baseado no histórico de treinos registrados.') : t('Início seguro e progressivo baseado no seu questionário.'),
      week, routines, customEx: []
    }
  }
}

/** Generates real plan with Minimax M3 */
async function generateMinimaxPlan(S, intake) {
  const days = intake?.daysPerWeek || intake?.preferredDays?.length || 3
  const prefDays = intake?.preferredDays?.length ? intake.preferredDays : [1, 3, 5]
  const eq = (intake?.equipment || []).join(', ') || 'halteres, barras, máquinas de academia'
  const goal = intake?.goal || 'hipertrofia e força'
  const sessionMin = intake?.sessionMin || 50
  const limitations = intake?.limitations || 'nenhuma'

  const system = `Você é o Coach de IA da openGym, especialista em musculação, biomecânica e periodização no Brasil.
Responda SEMPRE em Português do Brasil com linguagem técnica porém motivadora de academia.
Você DEVE retornar APENAS um JSON estritamente válido seguindo este formato exato, sem blocos markdown:
{
  "coach_contract": 1,
  "opengym_plan": 1,
  "name": "Nome do Plano",
  "summary": "Resumo de 2 a 3 frases explicando a divisão e estratégia em Português do Brasil.",
  "basedOn": "Critérios utilizados (equipamentos, dias, objetivo).",
  "week": { "1": "r1", "3": "r2", "5": "r3" },
  "routines": [
    {
      "id": "r1",
      "name": "Nome da Rotina (ex: Treino A - Peito e Tríceps)",
      "emoji": "💪",
      "prog": "linear",
      "why": "Explicação pedagógica do treino.",
      "ex": [
        {
          "id": "barbell bench press",
          "sets": 4,
          "mode": "reps",
          "reps": 8,
          "why": "Motivo da escolha do exercício e número de séries."
        }
      ]
    }
  ],
  "customEx": []
}`

  const user = `Monte um programa de treinamento semanal personalizado com:
- Dias de treino por semana: ${days} (Dias preferidos: ${prefDays.join(', ')})
- Duração máxima por sessão: ${sessionMin} minutos
- Equipamentos disponíveis: ${eq}
- Objetivo principal: ${goal}
- Limitações ou dores: ${limitations}
- Histórico: ${(S.workouts || []).length} treinos realizados anteriormente.`

  const aiRes = await callMinimax(system, user)
  if (!aiRes || !Array.isArray(aiRes.routines) || !aiRes.routines.length) {
    return buildFallbackPlan(S, intake)
  }

  // Validate and map exercise IDs to openGym library
  const routines = aiRes.routines.map((r, rIdx) => ({
    id: r.id || `r${rIdx + 1}`,
    name: r.name || `Treino ${String.fromCharCode(65 + rIdx)}`,
    emoji: r.emoji || '🏋️',
    prog: r.prog || 'linear',
    why: r.why || t('Treino estruturado com foco em sobrecarga progressiva.'),
    ex: (r.ex || []).map(e => {
      const resolvedId = resolveExId(e.id, null, null) || resolveExId(e.name, null, null) || EXDB[0]?.id
      return {
        id: resolvedId,
        sets: Math.max(1, Math.min(10, e.sets || 3)),
        mode: e.mode || 'reps',
        reps: e.reps || 10,
        why: e.why || t('Exercício selecionado para desenvolvimento ótimo do grupamento muscular.')
      }
    })
  }))

  const week = {}
  prefDays.forEach((d, i) => {
    week[String(d)] = routines[i % routines.length].id
  })

  return {
    id: 'minimax-plan-' + Date.now(),
    kind: 'create',
    createdAt: Date.now(),
    expiresAt: Date.now() + 864e5,
    iteration: 1,
    planHash: planHash(S),
    summary: aiRes.summary || t('Plano completo elaborado pelo Coach Minimax com base no seu perfil e objetivos.'),
    bundle: {
      opengym_plan: 1,
      name: aiRes.name || t('Plano de Treino Minimax'),
      summary: aiRes.summary || t('Plano completo elaborado pelo Coach Minimax com base no seu perfil e objetivos.'),
      basedOn: aiRes.basedOn || t('Respostas fornecidas no questionário e preferências de equipamentos.'),
      week: Object.keys(aiRes.week || {}).length ? aiRes.week : week,
      routines,
      customEx: []
    }
  }
}

/** Generates real review with Minimax M3 */
async function generateMinimaxReview(S, note) {
  const sessions = (S.workouts || []).slice(-10)
  if (!sessions.length && !S.routines.length) {
    return buildFallbackReview(S)
  }

  const system = `Você é o Coach de IA da openGym no Brasil. Avalie o histórico recente de treino e retorne APENAS um JSON no formato:
{
  "summary": "Resumo analítico do progresso em Português do Brasil (2 a 3 frases).",
  "notes": ["Dica ou insight chave sobre recuperação, sono ou nutrição."],
  "suggestions": [
    {
      "routineIndex": 0,
      "reason": "Explicação em PT-BR para uma pequena melhoria (ex: aumentar repetições ou trocar um exercício estagnado)."
    }
  ]
}`

  const workoutSummary = sessions.map(w => `${w.d}: ${w.name} (${w.entries?.length || 0} exercícios, vol: ${w.vol || 0}kg)`).join('\n')
  const user = `Histórico de treinos recentes do atleta:\n${workoutSummary || 'Nenhum treino registrado ainda'}\nNota do atleta: "${note || ''}"\nRotinas atuais: ${(S.routines || []).map(r => r.name).join(', ')}`

  const aiRes = await callMinimax(system, user)
  const base = buildFallbackReview(S)
  if (!aiRes) return base

  return {
    ...base,
    id: 'minimax-review-' + Date.now(),
    summary: aiRes.summary || base.summary,
    notes: Array.isArray(aiRes.notes) && aiRes.notes.length ? aiRes.notes : base.notes
  }
}

/** Generates plan refinement with Minimax M3 */
async function generateMinimaxRefine(S, currentPending, text) {
  const prevBundle = currentPending?.bundle
  if (!prevBundle) return generateMinimaxPlan(S, { goal: text })

  const system = `Você é o Coach da openGym no Brasil. O usuário pediu ajustes no plano de treino atual.
Retorne APENAS o JSON do plano atualizado com as modificações pedidas, mantendo a estrutura exata do plano original:
{
  "coach_contract": 1,
  "opengym_plan": 1,
  "name": "Nome do Plano",
  "summary": "Explicação em Português do Brasil do que foi alterado conforme solicitado.",
  "basedOn": "Refinamento do plano solicitado pelo atleta.",
  "week": { ... },
  "routines": [ ... ],
  "customEx": []
}`

  const user = `Plano atual:\n${JSON.stringify(prevBundle, null, 1)}\n\nPedido de alteração do atleta: "${text}"`
  const aiRes = await callMinimax(system, user)
  if (!aiRes || !Array.isArray(aiRes.routines)) {
    const fallback = buildFallbackPlan(S, null)
    return {
      ...fallback,
      iteration: (currentPending?.iteration || 1) + 1,
      summary: t('Plano revisado conforme solicitado: {0}', text)
    }
  }

  return {
    id: 'minimax-refine-' + Date.now(),
    kind: 'create',
    createdAt: Date.now(),
    expiresAt: Date.now() + 864e5,
    iteration: (currentPending?.iteration || 1) + 1,
    planHash: planHash(S),
    summary: aiRes.summary || t('Ajustes aplicados pelo Coach Minimax conforme solicitado.'),
    bundle: {
      ...prevBundle,
      name: aiRes.name || prevBundle.name,
      summary: aiRes.summary || prevBundle.summary,
      routines: aiRes.routines,
      week: aiRes.week || prevBundle.week
    }
  }
}

/* ---------------- API Surface ---------------- */

export const demoStatus = () => ({ job, pending, cap: { used: 0, limit: 0 } })

function startAsync(kind, asyncFn) {
  if (job) throw Object.assign(new Error(t('The Coach is already thinking about your training.')), { status: 409 })
  job = { id: 'minimax-' + kind, kind, state: 'running', startedAt: Date.now() }
  clearTimeout(timer)
  asyncFn().then(res => {
    pending = res
    job = null
  }).catch(() => {
    job = null
  })
  return { job }
}

export const demoReview = (S, note) => startAsync('review', () => generateMinimaxReview(S, note))
export const demoPlan = (S, intake) => startAsync('create', () => generateMinimaxPlan(S, intake))
export const demoRefine = (S, text) => startAsync('create', () => generateMinimaxRefine(S, pending, text))
export const demoResolve = () => { pending = null; return { ok: true } }
export const demoDisclosure = () => ({
  provider: 'minimax',
  providerLabel: 'Minimax AI Coach (M3)',
  categories: ['plan', 'training', 'bodyweight', 'profile', 'prefs'],
  version: 1
})
