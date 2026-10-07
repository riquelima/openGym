// ExerciseDB API Integration Engine (ExerciseDB V2 / AscendAPI & EDB V1)
// Provides access to 11,000+ structured exercises, HD MP4 demonstration videos,
// anatomical targeting, coaching cues, and exercise variations in Portuguese do Brasil.

import { useStore } from '../store/useStore.js'
import { EXDB, EXIDX, isGymMachine } from './exercises.js'
import { t } from './i18n.js'
import {
  translateExerciseName,
  translateMuscle,
  translateEquipment,
  translateWithMinimax
} from './translator.js'

const V2_RAPIDAPI_HOST = 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'
const V1_RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com'
const CACHE_KEY = 'opengym_exercisedb_cache_v2'

// In-memory cache for search queries and exercise records
const memoryCache = new Map()

// Featured ExerciseDB exercises in Brazilian Portuguese with verified video/image demonstrations
export const FEATURED_EXERCISEDB_EXERCISES = [
  {
    id: 'exdb_bench_press',
    n: 'Supino Reto com Barra',
    bp: 'peito',
    eq: 'barra',
    tg: 'peitorais',
    mg: 'peito',
    sm: ['deltóide anterior', 'tríceps'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: 'https://cdn.exercisedb.dev/media/images/VM46gFp1mS.webp',
    gif: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0025-EIeI8Vf.gif',
    overview: 'O Supino Reto com Barra é o clássico exercício composto de força e hipertrofia que desenvolve o peitoral médio e superior, ombros e tríceps.',
    tips: [
      'Mantenha as escápulas retraídas e presas ao banco durante todo o movimento.',
      'Desça a barra de forma controlada até tocar suavemente a linha média do peitoral.',
      'Mantenha os pés firmes no chão gerando estabilidade e força.'
    ],
    variations: ['Supino Inclinado com Halteres', 'Supino Fechado com Barra', 'Crucifixo Reto'],
    st: [
      'Deite-se no banco com os olhos alinhados à barra e pés apoiados no chão.',
      'Segure a barra com pegada ligeiramente mais larga que a largura dos ombros.',
      'Tire a barra do suporte e posicione-a sobre o peito com braços estendidos.',
      'Desça controladamente até o peito e empurre com força de volta ao topo.'
    ],
    keywords: ['bench press', 'supino', 'supino reto', 'barbell bench press'],
    source: 'exercisedb'
  },
  {
    id: 'exdb_pec_deck',
    n: 'Voador / Pec Deck na Máquina',
    rawName: 'Lever Pec Deck Fly',
    bp: 'peito',
    eq: 'máquina de alavanca',
    tg: 'peitorais',
    mg: 'peito',
    sm: ['deltóide anterior', 'tríceps'],
    video: 'https://cdn.exercisedb.dev/videos/Trn4QDW/41n2hxnFMotsXTj3__Barbell-Bench-Press_Chest2_.mp4',
    img: 'https://ucarecdn.com/62571454-fff7-4344-8d23-820350d749c8/chest_fly_image.png',
    gif: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0009-PAgTVaK.gif',
    overview: 'O Voador na máquina Peck Deck é um exercício de isolamento de alta eficiência para hipertrofia, promovendo tensão contínua em todo o arco de movimento do peitoral.',
    tips: [
      'Movimento controlado: evite impulsos ou bater os braços no centro.',
      'Amplitude total: abra até sentir um bom alongamento no peitoral e contraia no pico.',
      'Respiração: expire ao fechar os braços e inspire ao retornar controladamente.'
    ],
    variations: ['Crossover no Cabo', 'Crucifixo com Halteres', 'Crucifixo Inclinado'],
    st: [
      'Sente-se na máquina com as costas firmemente apoiadas no encosto.',
      'Posicione os antebraços nos suportes almofadados com cotovelos e ombros alinhados.',
      'Empurre os braços para a frente lentamente, focando em espremer o peito.',
      'Segure por 1 segundo no pico de contração antes de retornar à posição inicial.'
    ],
    keywords: ['pec deck', 'peck deck', 'voador', 'lever pec deck fly', 'crucifixo maquina'],
    source: 'exercisedb'
  },
  {
    id: 'exdb_cable_crossover',
    n: 'Crossover no Cabo (Polia Alta)',
    bp: 'peito',
    eq: 'cabo',
    tg: 'peitoral inferior',
    mg: 'peito',
    sm: ['deltóide anterior', 'bíceps'],
    img: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/0227-Pr9Rhf4.jpg',
    gif: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0227-Pr9Rhf4.gif',
    overview: 'Exercício de pico de tensão para peitoral, excelente para enfatizar a porção inferior e esternal com contração contínua fornecida pelos cabos.',
    tips: [
      'Mantenha uma ligeira flexão nos cotovelos durante todo o movimento.',
      'Incline o tronco levemente para a frente mantendo a coluna alinhada.',
      'Cruze levemente as mãos no final para máxima contração.'
    ],
    variations: ['Crossover Polia Baixa', 'Crucifixo Reto', 'Voador na Máquina'],
    st: [
      'Ajuste as polias na posição alta e dê um passo à frente com uma base firme.',
      'Puxe os cabos para baixo e para o centro em um arco controlado.',
      'Aperte o peitoral por 1 segundo no ponto de encontro das mãos.',
      'Retorne controlando a carga até a linha dos ombros.'
    ],
    source: 'exercisedb'
  },
  {
    id: 'exdb_incline_db_press',
    n: 'Supino Inclinado com Halteres',
    bp: 'peito',
    eq: 'halteres',
    tg: 'peitoral superior',
    mg: 'peito',
    sm: ['deltóide anterior', 'tríceps'],
    img: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/0331-1PLE8e9.jpg',
    gif: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0331-1PLE8e9.gif',
    overview: 'Foca na porção clavicular (superior) do peitoral maior. Os halteres oferecem liberdade articular e excelente correção de assimetrias.',
    tips: [
      'Ajuste o banco entre 30° e 45° de inclinação.',
      'Mantenha as escápulas retraídas durante todo o movimento.',
      'Não bata os halteres no topo; mantenha a tensão contínua nos músculos.'
    ],
    variations: ['Supino Inclinado com Barra', 'Crucifixo Inclinado', 'Supino no Smith'],
    st: [
      'Deite-se no banco inclinado segurando um haltere em cada mão à altura dos ombros.',
      'Empurre os halteres para cima até estender quase completamente os braços.',
      'Desça de forma controlada até que os halteres fiquem alinhados com o peito.',
      'Repita mantendo o core firme e os pés no chão.'
    ],
    source: 'exercisedb'
  },
  {
    id: 'exdb_lat_pulldown',
    n: 'Puxada Alta com Pegada Aberta',
    bp: 'costas',
    eq: 'cabo',
    tg: 'dorsais',
    mg: 'costas',
    sm: ['bíceps', 'rombóides', 'deltóide posterior'],
    img: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/0007-4IKbhHV.jpg',
    gif: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0007-4IKbhHV.gif',
    overview: 'Exercício fundamental de puxada vertical para alargamento das costas, desenvolvendo os dorsais, redondo maior e bíceps.',
    tips: [
      'Puxe a barra até a altura da clavícula, nunca atrás do pescoço.',
      'Inicie a puxada descendo as escápulas, não apenas dobrando os braços.',
      'Evite inclinar o corpo em excesso para trás para usar impulso.'
    ],
    variations: ['Puxada com Pegada Supinada', 'Puxada com Triângulo', 'Barra Fixa'],
    st: [
      'Sente-se e trave as coxas confortavelmente sob o apoio almofadado.',
      'Segure a barra com pegada pronada mais larga que os ombros.',
      'Puxe a barra em direção ao topo do peito, mantendo o peito erguido.',
      'Retorne estendendo totalmente os braços para alongar os dorsais.'
    ],
    source: 'exercisedb'
  },
  {
    id: 'exdb_romanian_deadlift',
    n: 'Levantamento Terra Romeno com Halteres (RDL)',
    bp: 'pernas',
    eq: 'halteres',
    tg: 'posteriores de coxa',
    mg: 'pernas',
    sm: ['glúteos', 'lombar', 'trapézio'],
    img: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/0334-DsgkuIt.jpg',
    gif: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0334-DsgkuIt.gif',
    overview: 'Movimento premier de articulação do quadril para a cadeia posterior, construindo posteriores de coxa e glúteos fortes e postura alinhada.',
    tips: [
      'Empurre o quadril para trás como se fosse encostar em uma parede atrás de você.',
      'Mantenha os halteres colados às pernas durante todo o trajeto.',
      'Mantenha a coluna neutra e os joelhos levemente destravados.'
    ],
    variations: ['Terra Romeno com Barra', 'Stiff com Halteres', 'Terra Tradicional'],
    st: [
      'Em pé, segure os halteres à frente das coxas com os pés na largura do quadril.',
      'Inicie flexionando o quadril para trás com joelhos levemente flexionados.',
      'Desça os halteres rente às pernas até sentir alongamento nos posteriores.',
      'Empurre o chão com os calcanhares e estenda o quadril para retornar.'
    ],
    source: 'exercisedb'
  }
]

// Register featured exercises into OpenGym's index
FEATURED_EXERCISEDB_EXERCISES.forEach(e => {
  EXIDX[e.id] = e
})

// Retrieve configured API key
export function getExerciseDBKey() {
  const storeKey = useStore.getState().S.exercisedbApiKey
  if (storeKey && storeKey.trim()) return storeKey.trim()
  try {
    return localStorage.getItem('exercisedb_api_key') || import.meta.env.VITE_RAPIDAPI_KEY || ''
  } catch {
    return ''
  }
}

// Check if ExerciseDB is configured with an active user key
export function isExerciseDBConfigured() {
  return !!getExerciseDBKey()
}

// Convert ExerciseDB API response object into OpenGym exercise model with PT-BR translation
export function normalizeExerciseDB(raw) {
  if (!raw) return null
  const id = raw.exerciseId || raw.id || `exdb_${Math.random().toString(36).slice(2, 9)}`
  const rawName = raw.name || raw.n || t('Unnamed exercise')
  // Automatically translate exercise name to Brazilian Portuguese
  const name = translateExerciseName(rawName)
  
  // Normalize body part and equipment with PT-BR terminology
  const rawBp = Array.isArray(raw.bodyParts) ? raw.bodyParts[0] : (raw.bodyPart || raw.bp || '')
  const bp = translateMuscle(String(rawBp).toLowerCase().trim()) || 'peito'
  
  const rawEq = Array.isArray(raw.equipments) ? raw.equipments[0] : (raw.equipment || raw.eq || '')
  const eq = translateEquipment(String(rawEq).toLowerCase().trim()) || 'equipamento'
  
  const rawTg = Array.isArray(raw.targetMuscles) ? raw.targetMuscles[0] : (raw.target || raw.tg || '')
  const tg = translateMuscle(String(rawTg).toLowerCase().trim()) || bp
  
  const rawSm = Array.isArray(raw.secondaryMuscles) ? raw.secondaryMuscles : (raw.sm || [])
  const sm = rawSm.map(s => translateMuscle(String(s).toLowerCase().trim()))
  
  // Media resolution (ExerciseDB CDN or direct URLs)
  let video = raw.videoUrl || raw.video || null
  if (video && !video.startsWith('http://') && !video.startsWith('https://') && !video.startsWith('blob:')) {
    video = `https://cdn.exercisedb.dev/videos/${video}`
  }
  
  let img = raw.imageUrl || raw.img || raw.imageUrls?.['720p'] || raw.imageUrls?.['480p'] || raw.imageUrls?.['360p'] || null
  if (img && !img.startsWith('http://') && !img.startsWith('https://') && !img.startsWith('blob:') && !img.startsWith('data:')) {
    img = `https://cdn.exercisedb.dev/media/images/${img}`
  }

  let gif = raw.gifUrl || raw.gif || null
  if (!gif && raw.id && /^\d{4}$/.test(raw.id)) {
    const padded = String(raw.id).padStart(4, '0')
    const match = EXIDX[padded]
    if (match) {
      if (!img) img = match.img
      if (!gif) gif = match.gif
    }
  }

  const instructions = Array.isArray(raw.instructions) ? raw.instructions : (Array.isArray(raw.st) ? raw.st : [])
  const tips = Array.isArray(raw.exerciseTips) ? raw.exerciseTips : (Array.isArray(raw.tips) ? raw.tips : [])
  const variations = Array.isArray(raw.variations) ? raw.variations : []
  let overview = raw.overview || raw.desc || ''

  const normalized = {
    id,
    n: name,
    bp,
    eq,
    tg,
    mg: tg,
    sm,
    st: instructions,
    tips,
    variations,
    overview,
    video,
    img,
    gif,
    source: 'exercisedb'
  }

  // Trigger background Minimax AI translation if overview is English
  if (overview && /[a-zA-Z]{5,}/.test(overview) && !/é|ã|õ|ç|á|í|ó|ú/i.test(overview)) {
    translateWithMinimax(rawName, overview).then(aiRes => {
      if (aiRes) {
        if (aiRes.name) normalized.n = aiRes.name
        if (aiRes.overview) normalized.overview = aiRes.overview
      }
    }).catch(() => {})
  }

  // Register in index
  EXIDX[id] = normalized
  return normalized
}

// Local cache helpers
function readLocalCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeLocalCache(key, data) {
  try {
    const c = readLocalCache()
    c[key] = { data, ts: Date.now() }
    const keys = Object.keys(c)
    if (keys.length > 200) {
      delete c[keys[0]]
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch { /* storage full */ }
}

function getFromCache(key) {
  if (memoryCache.has(key)) return memoryCache.get(key)
  const c = readLocalCache()
  if (c[key] && Date.now() - c[key].ts < 1000 * 60 * 60 * 24 * 7) { // 7 days
    memoryCache.set(key, c[key].data)
    return c[key].data
  }
  return null
}

// Test connection to RapidAPI ExerciseDB (supports both V2 AscendAPI and V1)
export async function testExerciseDBConnection(key) {
  const apiKey = (key || getExerciseDBKey()).trim()
  if (!apiKey) throw new Error('Informe uma chave RapidAPI válida.')

  // Try ExerciseDB V2 by AscendAPI first
  try {
    const resV2 = await fetch(`https://${V2_RAPIDAPI_HOST}/api/v1/exercises?limit=1`, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': V2_RAPIDAPI_HOST
      }
    })
    if (resV2.ok) {
      const data = await resV2.json()
      return { ok: true, version: 'ExerciseDB V2 (11.000+ com Vídeos HD)', count: data?.data?.length || 1 }
    }
  } catch {}

  // Fallback to ExerciseDB V1
  const resV1 = await fetch(`https://${V1_RAPIDAPI_HOST}/exercises?limit=1`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': V1_RAPIDAPI_HOST
    }
  })

  if (resV1.ok) {
    const data = await resV1.json()
    return { ok: true, version: 'ExerciseDB V1 (RapidAPI)', count: Array.isArray(data) ? data.length : 1 }
  }

  if (resV1.status === 401 || resV1.status === 403) {
    throw new Error('Chave de API inválida ou sem assinatura ativa no RapidAPI para o ExerciseDB.')
  }
  if (resV1.status === 429) {
    throw new Error('Limite de requisições excedido no RapidAPI (Rate limit atingido).')
  }
  throw new Error(`Erro na conexão com ExerciseDB: HTTP ${resV1.status}`)
}

export { isGymMachine }

// Search ExerciseDB database: queries online API when key is configured,
// and always provides complete ExerciseDB dataset with working demonstrations.
export async function searchExerciseDB(query = '', { bodyPart = '', equipment = '', limit = 50, offset = 0 } = {}) {
  const qClean = (query || '').trim().toLowerCase()
  const isGym = equipment === 'gym' || equipment === 'academia'
  const cacheKey = `search_${qClean}_${bodyPart}_${equipment}_${limit}_${offset}`
  
  const cached = getFromCache(cacheKey)
  if (cached) {
    cached.forEach(e => { EXIDX[e.id] = e })
    return cached
  }

  // Base list from ExerciseDB dataset
  let localList = [...FEATURED_EXERCISEDB_EXERCISES, ...EXDB]
  if (bodyPart && bodyPart !== 'all') {
    localList = localList.filter(e => e.bp && e.bp.toLowerCase().includes(bodyPart.toLowerCase()))
  }
  if (isGym) {
    localList = localList.filter(e => isGymMachine(e.eq))
  } else if (equipment && equipment !== 'all') {
    localList = localList.filter(e => e.eq && e.eq.toLowerCase().includes(equipment.toLowerCase()))
  }
  if (qClean) {
    localList = localList.filter(e =>
      (e.n && e.n.toLowerCase().includes(qClean)) ||
      (e.rawName && e.rawName.toLowerCase().includes(qClean)) ||
      (Array.isArray(e.keywords) && e.keywords.some(k => k.toLowerCase().includes(qClean))) ||
      (e.bp && e.bp.toLowerCase().includes(qClean)) ||
      (e.tg && e.tg.toLowerCase().includes(qClean)) ||
      (e.eq && e.eq.toLowerCase().includes(qClean)) ||
      ((e.overview || e.desc || '').toLowerCase().includes(qClean))
    )
  }

  const apiKey = getExerciseDBKey()

  // If no API key is set, return filtered ExerciseDB dataset
  if (!apiKey) {
    const res = localList.slice(offset, offset + limit)
    res.forEach(e => { EXIDX[e.id] = e })
    return res
  }

  // If API key is present, query ExerciseDB online API
  try {
    // 1. Try ExerciseDB V2 (AscendAPI)
    // Note: ExerciseDB API does not provide a single bundled 'gym' endpoint,
    // so gym exercises query machine equipment types or filter results.
    let v2Url = `https://${V2_RAPIDAPI_HOST}/api/v1/exercises?limit=${isGym ? Math.min(limit * 2, 200) : limit}`
    if (qClean) {
      v2Url = `https://${V2_RAPIDAPI_HOST}/api/v1/exercises/search?search=${encodeURIComponent(qClean)}`
    } else if (bodyPart && bodyPart !== 'all') {
      v2Url = `https://${V2_RAPIDAPI_HOST}/api/v1/exercises?bodyParts=${encodeURIComponent(bodyPart)}&limit=${limit}`
    } else if (!isGym && equipment && equipment !== 'all') {
      v2Url = `https://${V2_RAPIDAPI_HOST}/api/v1/exercises?equipments=${encodeURIComponent(equipment)}&limit=${limit}`
    }

    const v2Res = await fetch(v2Url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': V2_RAPIDAPI_HOST
      }
    })

    if (v2Res.ok) {
      const json = await v2Res.json()
      const rawList = Array.isArray(json) ? json : (json.data || json.exercises || [])
      if (rawList.length > 0) {
        let normalized = rawList.map(normalizeExerciseDB).filter(Boolean)
        if (isGym) {
          normalized = normalized.filter(e => isGymMachine(e.eq))
        }
        const seen = new Set(normalized.map(e => e.id))
        const merged = [...normalized, ...localList.filter(e => !seen.has(e.id))]
        const filteredMerged = isGym ? merged.filter(e => isGymMachine(e.eq)) : merged
        memoryCache.set(cacheKey, filteredMerged)
        writeLocalCache(cacheKey, filteredMerged)
        return filteredMerged
      }
    }
  } catch {}

  // 2. Try classic ExerciseDB V1 endpoint
  try {
    let v1Url = `https://${V1_RAPIDAPI_HOST}/exercises?limit=${isGym ? Math.min(limit * 2, 200) : limit}&offset=${offset}`
    if (qClean) {
      v1Url = `https://${V1_RAPIDAPI_HOST}/exercises/name/${encodeURIComponent(qClean)}?limit=${limit}&offset=${offset}`
    } else if (bodyPart && bodyPart !== 'all') {
      v1Url = `https://${V1_RAPIDAPI_HOST}/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=${limit}&offset=${offset}`
    } else if (!isGym && equipment && equipment !== 'all') {
      v1Url = `https://${V1_RAPIDAPI_HOST}/exercises/equipment/${encodeURIComponent(equipment)}?limit=${limit}&offset=${offset}`
    }

    const v1Res = await fetch(v1Url, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': V1_RAPIDAPI_HOST
      }
    })

    if (v1Res.ok) {
      const json = await v1Res.json()
      const rawList = Array.isArray(json) ? json : (json.data || json.exercises || [])
      if (rawList.length > 0) {
        let normalized = rawList.map(normalizeExerciseDB).filter(Boolean)
        if (isGym) {
          normalized = normalized.filter(e => isGymMachine(e.eq))
        }
        const seen = new Set(normalized.map(e => e.id))
        const merged = [...normalized, ...localList.filter(e => !seen.has(e.id))]
        const filteredMerged = isGym ? merged.filter(e => isGymMachine(e.eq)) : merged
        memoryCache.set(cacheKey, filteredMerged)
        writeLocalCache(cacheKey, filteredMerged)
        return filteredMerged
      }
    }
  } catch {}

  // Fallback to local ExerciseDB dataset
  const res = localList.slice(offset, offset + limit)
  res.forEach(e => { EXIDX[e.id] = e })
  return res
}

// Fetch single exercise by ID
export async function getExerciseDBById(id) {
  if (EXIDX[id]) return EXIDX[id]
  const cacheKey = `ex_${id}`
  const cached = getFromCache(cacheKey)
  if (cached) return cached

  const apiKey = getExerciseDBKey()
  if (!apiKey) {
    return FEATURED_EXERCISEDB_EXERCISES.find(e => e.id === id) || EXDB.find(e => e.id === id) || null
  }

  // Try V2 then V1
  try {
    const res = await fetch(`https://${V2_RAPIDAPI_HOST}/api/v1/exercises/${id}`, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': V2_RAPIDAPI_HOST
      }
    })
    if (res.ok) {
      const json = await res.json()
      const normalized = normalizeExerciseDB(json.data || json)
      if (normalized) {
        memoryCache.set(cacheKey, normalized)
        writeLocalCache(cacheKey, normalized)
        return normalized
      }
    }
  } catch {}

  try {
    const res = await fetch(`https://${V1_RAPIDAPI_HOST}/exercises/exercise/${id}`, {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': V1_RAPIDAPI_HOST
      }
    })
    if (res.ok) {
      const json = await res.json()
      const normalized = normalizeExerciseDB(json)
      if (normalized) {
        memoryCache.set(cacheKey, normalized)
        writeLocalCache(cacheKey, normalized)
        return normalized
      }
    }
  } catch {}

  return EXDB.find(e => e.id === id) || null
}
