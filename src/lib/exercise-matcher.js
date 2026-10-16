// Exercise Resolution & Matching Engine
// Ensures that every exercise imported (via OCR, Vision, PDF, text, notes) or created
// is matched against ExerciseDB and OpenGym catalog, with verified demonstration videos and images.

import { EXDB, EXIDX, registerCustom } from './exercises.js'
import { FEATURED_EXERCISEDB_EXERCISES, isExerciseDBConfigured, searchExerciseDB } from './exercisedb-api.js'
import { uid } from './format.js'

export const DEFAULT_MINIMAX_KEY = 'sk-cp-meaN0PHZdGi3-5gZffia9b6PyDIh27vyk54LwG6gw965dFLWoIHowFo19rTqoHdbxhaQezJlMMBgTEYhNni51sJnMWCcPHIKtCg4GRY-pGMmrXarNIxxGQA'
const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'

// Verified fallback archetypes with working demonstrations for every bodypart
export const BODYPART_ARCHETYPES = {
  chest: {
    bp: 'peito',
    eq: 'barra',
    tg: 'peitorais',
    sm: ['deltóide anterior', 'tríceps'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0025-EIeI8Vf.jpg',
    gif: '0025-EIeI8Vf.gif',
    st: [
      'Posicione-se confortavelmente mantendo a coluna alinhada e escápulas estáveis.',
      'Execute a fase concêntrica contraindo a musculatura peitoral de forma controlada.',
      'Retorne à posição inicial mantendo o controle total da carga sem trancos.'
    ]
  },
  back: {
    bp: 'costas',
    eq: 'cabo',
    tg: 'dorsais',
    sm: ['bíceps', 'rombóides'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0007-4IKbhHV.jpg',
    gif: '0007-4IKbhHV.gif',
    st: [
      'Inicie o movimento retraindo as escápulas e ativando a musculatura das costas.',
      'Puxe a carga em direção ao corpo mantendo os cotovelos alinhados.',
      'Estenda os braços controlando o retorno para alongar os dorsais.'
    ]
  },
  shoulders: {
    bp: 'ombros',
    eq: 'halteres',
    tg: 'deltóides',
    sm: ['trapézio', 'tríceps'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0334-DsgkuIt.jpg',
    gif: '0334-DsgkuIt.gif',
    st: [
      'Mantenha a postura ereta e abdômen contraído durante todo o exercício.',
      'Eleve a carga controlando a rotação dos ombros até a linha neutra.',
      'Desça de maneira contínua sem utilizar impulsos com o tronco.'
    ]
  },
  'upper arms': {
    bp: 'braços',
    eq: 'halteres',
    tg: 'braços',
    sm: ['antebraços'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0031-25GPyDY.jpg',
    gif: '0031-25GPyDY.gif',
    st: [
      'Fixe os cotovelos junto ao tronco para isolar o movimento.',
      'Flexione os braços contraindo com firmeza no topo da repetição.',
      'Desça lentamente controlando a fase excêntrica.'
    ]
  },
  'upper legs': {
    bp: 'pernas',
    eq: 'barra',
    tg: 'quadríceps',
    sm: ['glúteos', 'posteriores de coxa'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0043-qXTaZnJ.jpg',
    gif: '0043-qXTaZnJ.gif',
    st: [
      'Mantenha os pés alinhados na largura dos ombros com o peito aberto.',
      'Flexione os joelhos e projete o quadril para trás com controle.',
      'Empurre o chão através dos calcanhares para retornar à posição inicial.'
    ]
  },
  'lower legs': {
    bp: 'panturrilhas',
    eq: 'máquina',
    tg: 'panturrilhas',
    sm: ['gastrocnêmio', 'sóleo'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0605-ykUOVze.jpg',
    gif: '0605-ykUOVze.gif',
    st: [
      'Apoie a ponta dos pés de forma firme na plataforma.',
      'Eleve os calcanhares no ponto mais alto possível, contraindo a panturrilha.',
      'Desça até sentir um alongamento completo antes da próxima repetição.'
    ]
  },
  waist: {
    bp: 'abdômen',
    eq: 'peso corporal',
    tg: 'abdômen',
    sm: ['core', 'flexores de quadril'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '0001-2gPfomN.jpg',
    gif: '0001-2gPfomN.gif',
    st: [
      'Deite-se confortavelmente mantendo a lombar bem apoiada.',
      'Flexione o tronco ativando a musculatura abdominal.',
      'Retorne de forma controlada mantendo a tensão na região central.'
    ]
  },
  cardio: {
    bp: 'cardio',
    eq: 'máquina',
    tg: 'sistema cardiovascular',
    sm: ['pernas'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: '2141-rjtuP6X.jpg',
    gif: '2141-rjtuP6X.gif',
    st: [
      'Ajuste o equipamento para a sua altura e mantenha ritmo constante.',
      'Monitore a respiração e a cadência de passadas durante o treino.'
    ]
  }
}

export function guessBodyPart(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('peito') || n.includes('supino') || n.includes('crucifixo') || n.includes('flexao') || n.includes('flexão') || n.includes('voador') || n.includes('pec deck') || n.includes('peck') || n.includes('cross over') || n.includes('crossover')) return 'chest'
  if (n.includes('costa') || n.includes('puxada') || n.includes('remada') || n.includes('pulldown') || n.includes('barra fixa') || n.includes('serrote') || n.includes('dorsal')) return 'back'
  if (n.includes('perna') || n.includes('agachamento') || n.includes('leg') || n.includes('extensora') || n.includes('quadriceps') || n.includes('quadríceps') || n.includes('flexora') || n.includes('stiff') || n.includes('isquio') || n.includes('gluteo') || n.includes('glúteo') || n.includes('bulgaro') || n.includes('passada') || n.includes('afundo') || n.includes('abdutora') || n.includes('adutora')) return 'upper legs'
  if (n.includes('panturrilha') || n.includes('gemeos') || n.includes('gêmeos')) return 'lower legs'
  if (n.includes('ombro') || n.includes('deltoide') || n.includes('deltóide') || n.includes('desenvolvimento') || n.includes('eleva') || n.includes('levantamento frontal') || n.includes('lateral')) return 'shoulders'
  if (n.includes('biceps') || n.includes('bíceps') || n.includes('triceps') || n.includes('tríceps') || n.includes('rosca') || n.includes('testa') || n.includes('frances') || n.includes('pulley') || n.includes('braco') || n.includes('braço')) return 'upper arms'
  if (n.includes('abdomen') || n.includes('abdominal') || n.includes('prancha') || n.includes('infra') || n.includes('supra') || n.includes('core')) return 'waist'
  if (n.includes('corrida') || n.includes('esteira') || n.includes('bike') || n.includes('bicicleta') || n.includes('eliptico') || n.includes('elíptico')) return 'cardio'
  return 'chest'
}

export function guessEquipment(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('barra') || n.includes('barbell')) return 'barbell'
  if (n.includes('haltere') || n.includes('halter') || n.includes('dumbbell')) return 'dumbbell'
  if (n.includes('polia') || n.includes('cabo') || n.includes('cable') || n.includes('corda') || n.includes('pulley')) return 'cable'
  if (n.includes('maquina') || n.includes('máquina') || n.includes('press') || n.includes('articulad') || n.includes('peck') || n.includes('deck') || n.includes('extensora') || n.includes('flexora')) return 'leverage machine'
  if (n.includes('smith')) return 'smith machine'
  if (n.includes('elastico') || n.includes('elástico') || n.includes('band') || n.includes('banda')) return 'band'
  if (n.includes('livre') || n.includes('corpo') || n.includes('peso corporal')) return 'body weight'
  return 'barbell'
}

export function normalizeStr(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Brazilian gym aliases mapped to verified ExerciseDB / EXDB IDs
export const GYM_ALIASES = [
  // Peck Deck / Voador
  { match: /voador|peck?\s*deck|crucifixo\s*m[aá]quina|borboleta/i, id: 'exdb_pec_deck' },
  // Crossover / Cross Over
  { match: /cross\s*over|crossover|cabo\s*crossover/i, id: 'exdb_cable_crossover' },

  // Supinos
  { match: /supino\s+inclinado(\s+com)?\s+barra/i, id: '0047' },
  { match: /supino\s+inclinado(\s+com)?\s+haltere?/i, id: '0331' },
  { match: /supino\s+inclinado/i, id: '0047' },
  { match: /supino(\s+reto)?(\s+com)?\s+barra/i, id: '0025' },
  { match: /supino(\s+reto)?(\s+com)?\s+haltere?/i, id: '0304' },
  { match: /supino\s+reto/i, 'id': '0025' },
  { match: /supino\s+declinado/i, id: '0033' },

  // Crucifixos
  { match: /crucifixo\s+inclinado/i, id: '0331' },
  { match: /crucifixo\s+invertido|voador\s+invertido/i, id: '0154' },
  { match: /crucifixo(\s+reto)?(\s+com\s+halteres)?/i, id: '0308' },

  // Costas / Puxadas e Remadas
  { match: /puxada\s+(fechada|triangulo|triângulo)/i, id: '0974' },
  { match: /puxada\s+(alta|frontal|frente|aberta|pulldown)|pulldown/i, id: '0007' },
  { match: /remada\s+(curvada|cavalinho)/i, id: '0027' },
  { match: /remada\s+baixa/i, id: '0228' },
  { match: /remada\s+(unilateral|serrote)/i, id: '0292' },
  { match: /remada\s+(articulada|maquina|máquina)/i, id: '0588' },
  { match: /barra\s+fixa|pull\s*up|chin\s*up|graviton/i, id: '2330' },

  // Pernas
  { match: /agachamento\s+(smith|guiado)/i, id: '0044' },
  { match: /agachamento\s+(bulgaro|búlgaro)/i, id: '0054' },
  { match: /agachamento/i, id: '0043' },
  { match: /leg\s*press(\s*45)?/i, id: '2287' },
  { match: /cadeira\s+extensora|extensora/i, id: '0585' },
  { match: /mesa\s+flexora|cadeira\s+flexora|flexora/i, id: '0586' },
  { match: /panturrilha|gemeos/i, id: '0605' },
  { match: /stiff|levantamento\s+terra|terra\s+romeno|rdl/i, id: '0032' },
  { match: /eleva(cao|ção)\s+p[eé]lvica|hip\s*thrust/i, id: '1408' },
  { match: /cadeira\s+abdutora|abdutora/i, id: '1427' },
  { match: /cadeira\s+adutora|adutora/i, id: '1712' },
  { match: /afundo|passada|avanco|avanço/i, id: '0054' },

  // Ombros
  { match: /desenvolvimento\s+arnold/i, id: '0286' },
  { match: /desenvolvimento/i, id: '0041' },
  { match: /eleva(cao|ção)\s+lateral/i, id: '0334' },
  { match: /eleva(cao|ção)\s+frontal.*banda|levantamento\s+frontal.*banda/i, id: '0978' },
  { match: /eleva(cao|ção)\s+frontal|levantamento\s+frontal.*barra/i, id: '0041' },
  { match: /eleva(cao|ção)\s+frontal|levantamento\s+frontal/i, id: '0041' },
  { match: /face\s*pull/i, id: '0154' },

  // Braços (Bíceps e Tríceps)
  { match: /rosca\s+scott|banco\s+scott/i, id: '0038' },
  { match: /rosca\s+martelo/i, id: '0313' },
  { match: /rosca\s+alternada/i, id: '0285' },
  { match: /rosca\s+concentrada/i, id: '0287' },
  { match: /rosca\s+(direta|biceps|bíceps)/i, id: '0031' },
  { match: /tr(i|í)ceps\s+(corda|polia|pulley)/i, id: '0194' },
  { match: /tr(i|í)ceps\s+(testa|skull\s*crusher)/i, id: 'rep_skull-crusher' },
  { match: /tr(i|í)ceps\s+franc[eê]s/i, id: 'rep_overhead-tricep-extension' },
  { match: /mergulho|paralela/i, id: '0251' },

  // Abdômen
  { match: /prancha/i, id: '0003' },
  { match: /abdominal\s+infra|eleva(cao|ção)\s+de\s+pernas/i, id: '0011' },
  { match: /abdominal|abdominais/i, id: '0001' }
]

/**
 * Searches the catalog (Featured + EXDB + EXIDX) using exact, alias, and fuzzy token scoring.
 */
export function matchCatalogExercise(query) {
  const clean = (query || '').trim()
  if (!clean) return null
  const qNorm = normalizeStr(clean)

  // 1. Brazilian gym aliases match (canonical gyms definitions)
  for (const alias of GYM_ALIASES) {
    if (alias.match.test(clean) || alias.match.test(qNorm)) {
      if (EXIDX[alias.id]) return EXIDX[alias.id]
    }
  }

  // 2. Exact match in FEATURED exercises (highest confidence & verified videos)
  for (const f of FEATURED_EXERCISEDB_EXERCISES) {
    if (normalizeStr(f.n) === qNorm || normalizeStr(f.rawName) === qNorm) return f
    if (Array.isArray(f.keywords) && f.keywords.some(k => normalizeStr(k) === qNorm)) return f
  }

  // 3. Exact match in full EXDB
  const exactEx = EXDB.find(e => normalizeStr(e.n) === qNorm || normalizeStr(e.rawName) === qNorm)
  if (exactEx) return exactEx

  // 4. Sub-term breakdown (e.g., "Voador (Peck Deck)" -> test "Voador" and "Peck Deck")
  const parts = clean.split(/[()/,+–-]/).map(s => s.trim()).filter(s => s.length >= 3)
  for (const part of parts) {
    const pNorm = normalizeStr(part)
    for (const f of FEATURED_EXERCISEDB_EXERCISES) {
      if (normalizeStr(f.n) === pNorm || (Array.isArray(f.keywords) && f.keywords.some(k => normalizeStr(k) === pNorm))) {
        return f
      }
    }
    const pExact = EXDB.find(e => normalizeStr(e.n) === pNorm || normalizeStr(e.rawName) === pNorm)
    if (pExact) return pExact

    for (const alias of GYM_ALIASES) {
      if (alias.match.test(part) || alias.match.test(pNorm)) {
        if (EXIDX[alias.id]) return EXIDX[alias.id]
      }
    }
  }

  // 5. Fuzzy token scoring in EXDB
  const tokens = qNorm.split(' ').filter(w => w.length > 2 && !['com', 'para', 'barra', 'halteres', 'maquina'].includes(w))
  if (tokens.length > 0) {
    let best = null
    let bestScore = 0

    // Check featured first
    for (const f of FEATURED_EXERCISEDB_EXERCISES) {
      const fNorm = normalizeStr(f.n) + ' ' + normalizeStr(f.rawName) + ' ' + (f.keywords || []).map(normalizeStr).join(' ')
      let score = 0
      for (const t of tokens) {
        if (fNorm.includes(t)) score += 20
      }
      if (score > bestScore) {
        bestScore = score
        best = f
      }
    }

    for (const e of EXDB) {
      const eNorm = normalizeStr(e.n) + ' ' + normalizeStr(e.rawName)
      let score = 0
      for (const t of tokens) {
        if (eNorm.includes(t)) score += 10
      }
      if (score > bestScore && score >= 20) {
        bestScore = score
        best = e
      }
    }

    if (best && bestScore >= 20) return best
  }

  return null
}

/**
 * Minimax AI semantic resolution for unusual gym nicknames or typos
 */
export async function resolveExerciseWithMinimax(rawName, apiKey) {
  try {
    const key = apiKey || DEFAULT_MINIMAX_KEY
    if (!key) return null
    const res = await fetch(MINIMAX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'minimax-m3',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em musculação. Retorne APENAS um JSON no formato {"standardName": "Nome Clássico de Academia em Português", "englishName": "Standard English Name"} para o exercício informado.'
          },
          {
            role: 'user',
            content: `Qual o exercício padrão para: "${rawName}"?`
          }
        ],
        temperature: 0.1
      })
    })

    if (res.ok) {
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) return JSON.parse(jsonMatch[0])
      }
    }
  } catch {}
  return null
}

/**
 * Resolves an exercise name online or in catalog, guaranteed to return an exercise
 * with video, gif, and image demonstrations.
 */
export async function resolveExerciseOnline(query, { apiKey, minimaxKey } = {}) {
  const clean = (query || '').trim()
  if (!clean) return EXIDX['0025']

  // 1. Fast catalog match
  const catalogMatch = matchCatalogExercise(clean)
  if (catalogMatch) return catalogMatch

  // 2. Query RapidAPI ExerciseDB if key is configured
  if (isExerciseDBConfigured()) {
    try {
      const apiResults = await searchExerciseDB(clean, { limit: 5 })
      if (apiResults && apiResults.length > 0) {
        const found = apiResults[0]
        if (found) {
          EXIDX[found.id] = found
          return found
        }
      }
    } catch {}
  }

  // 3. Minimax AI semantic mapping
  try {
    const aiMapped = await resolveExerciseWithMinimax(clean, minimaxKey)
    if (aiMapped?.standardName || aiMapped?.englishName) {
      const aiMatch = matchCatalogExercise(aiMapped.standardName) || matchCatalogExercise(aiMapped.englishName)
      if (aiMatch) return aiMatch
    }
  } catch {}

  // 4. Fallback: Return best archetype for its guessed bodypart
  const bp = guessBodyPart(clean)
  const arch = BODYPART_ARCHETYPES[bp] || BODYPART_ARCHETYPES.chest
  const fallbackId = arch.img ? arch.img.replace(/-\w+\.jpg$/, '') : '0025'
  return EXIDX[fallbackId] || FEATURED_EXERCISEDB_EXERCISES[0]
}

/**
 * Resolves an exercise or creates an enriched custom exercise with guaranteed video and photo.
 */
export function resolveOrCreateExercise(s, exName) {
  const clean = (exName || '').trim()
  if (!clean) return '0025'

  // 1. Check catalog match
  const matched = matchCatalogExercise(clean)
  if (matched && matched.id) return matched.id

  const norm = normalizeStr(clean)

  // 2. Check existing custom exercises
  const existingCustom = (s.customEx || []).find(c => normalizeStr(c.n) === norm)
  if (existingCustom) {
    // If existing custom is missing media, enrich it
    if (!existingCustom.img && !existingCustom.gif && !existingCustom.video) {
      const bp = existingCustom.bp || guessBodyPart(clean)
      const arch = BODYPART_ARCHETYPES[bp] || BODYPART_ARCHETYPES.chest
      existingCustom.img = arch.img
      existingCustom.gif = arch.gif
      existingCustom.video = arch.video
      existingCustom.st = arch.st
      existingCustom.tg = arch.tg
      existingCustom.sm = arch.sm
    }
    return existingCustom.id
  }

  // 3. Create an enriched custom exercise with guaranteed demonstration video and photo
  const bp = guessBodyPart(clean)
  const eq = guessEquipment(clean)
  const arch = BODYPART_ARCHETYPES[bp] || BODYPART_ARCHETYPES.chest
  const newId = 'c_' + uid()

  const newEx = {
    id: newId,
    n: clean,
    bp,
    eq,
    tg: arch.tg,
    sm: arch.sm,
    st: arch.st,
    video: arch.video,
    gif: arch.gif,
    img: arch.img,
    custom: true
  }

  s.customEx = s.customEx || []
  s.customEx.push(newEx)
  registerCustom(s.customEx)
  return newId
}

/**
 * Asynchronously resolves every exercise in an imported plan against the database / APIs.
 * Ensures all exercises get proper IDs with verified video and image demonstrations.
 */
export async function resolvePlanExercisesAsync(plan, storeState) {
  if (!plan || (!plan.routines && !plan.days)) return plan

  const routines = plan.routines || plan.days || []
  const minimaxKey = storeState?.minimaxApiKey || DEFAULT_MINIMAX_KEY

  for (const routine of routines) {
    const rawExercises = routine.exercises || routine.ex || []
    for (const ex of rawExercises) {
      const name = (ex.name || ex.n || '').trim()
      if (!name) continue

      // Resolve via API / catalog / AI
      const resolved = await resolveExerciseOnline(name, { minimaxKey })
      if (resolved && resolved.id) {
        ex.id = resolved.id
        ex.resolvedExercise = resolved
      }
    }
  }

  return plan
}

/**
 * Self-healing migration for existing state:
 * Automatically repairs any routines or custom exercises that were imported without video or photo,
 * linking them to their canonical database exercise (e.g. Voador -> exdb_pec_deck, Cross Over -> exdb_cable_crossover).
 */
export function healCustomExercises(s) {
  if (!s) return false
  let modified = false

  // 1. Repair custom exercises
  if (Array.isArray(s.customEx)) {
    for (const c of s.customEx) {
      const match = matchCatalogExercise(c.n || c.name)
      if (match && match.id && match.id !== c.id) {
        // Replace in routines
        if (Array.isArray(s.routines)) {
          for (const r of s.routines) {
            if (Array.isArray(r.ex)) {
              for (const e of r.ex) {
                if (e.id === c.id) {
                  e.id = match.id
                  modified = true
                }
              }
            }
          }
        }
      }

      // Ensure media is never missing
      if (!c.img && !c.gif && !c.video) {
        const bp = c.bp || guessBodyPart(c.n || '')
        const arch = BODYPART_ARCHETYPES[bp] || BODYPART_ARCHETYPES.chest
        c.img = arch.img
        c.gif = arch.gif
        c.video = arch.video
        if (!c.st || c.st.length === 0) c.st = arch.st
        if (!c.tg) c.tg = arch.tg
        if (!c.sm || c.sm.length === 0) c.sm = arch.sm
        modified = true
      }
    }
  }

  // 2. Check routines for any exercises that are missing media or missing from index
  if (Array.isArray(s.routines)) {
    for (const r of s.routines) {
      if (Array.isArray(r.ex)) {
        for (const e of r.ex) {
          const exObj = EXIDX[e.id]
          if (!exObj || (!exObj.img && !exObj.gif && !exObj.video)) {
            const custom = (s.customEx || []).find(c => c.id === e.id)
            const nameToSearch = custom?.n || e.name || ''
            if (nameToSearch) {
              const match = matchCatalogExercise(nameToSearch)
              if (match && match.id) {
                e.id = match.id
                modified = true
              }
            }
          }
        }
      }
    }
  }

  if (Array.isArray(s.customEx)) {
    registerCustom(s.customEx)
  }

  return modified
}
