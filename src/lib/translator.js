// Brazilian Portuguese Exercise & Fitness Translator
// Provides instant offline translation for exercises, muscle groups, equipment,
// and background Minimax AI translation for unmapped names and overviews.

const MINIMAX_KEY = 'sk-cp-meaN0PHZdGi3-5gZffia9b6PyDIh27vyk54LwG6gw965dFLWoIHowFo19rTqoHdbxhaQezJlMMBgTEYhNni51sJnMWCcPHIKtCg4GRY-pGMmrXarNIxxGQA'
const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'
const CACHE_KEY = 'opengym_ptbr_translations_v1'

// In-memory translation cache
const cache = new Map()

// Load cached translations from localStorage
try {
  const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  for (const [k, v] of Object.entries(stored)) {
    cache.set(k.toLowerCase(), v)
  }
} catch {}

function saveCache(key, val) {
  cache.set(key.toLowerCase(), val)
  try {
    const obj = {}
    cache.forEach((v, k) => { obj[k] = v })
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
  } catch {}
}

// Muscle groups to PT-BR
export const MUSCLE_MAP_PT = {
  'chest': 'Peito',
  'pectorals': 'Peitorais',
  'pectoralis major': 'Peitoral Maior',
  'pectoralis major clavicular head': 'Peitoral Superior',
  'pectoralis major sternal head': 'Peitoral Médio/Inferior',
  'upper pectorals': 'Peitoral Superior',
  'lower pectorals': 'Peitoral Inferior',
  'back': 'Costas',
  'lats': 'Dorsais',
  'latissimus dorsi': 'Grande Dorsal',
  'upper back': 'Costas Superior',
  'lower back': 'Lombar',
  'spine': 'Coluna Lombar',
  'shoulders': 'Ombros',
  'delts': 'Deltóides',
  'deltoid': 'Deltóide',
  'anterior deltoid': 'Deltóide Anterior',
  'deltoid anterior': 'Deltóide Anterior',
  'lateral deltoid': 'Deltóide Lateral',
  'posterior deltoid': 'Deltóide Posterior',
  'rear deltoids': 'Deltóide Posterior',
  'rear delts': 'Deltóide Posterior',
  'upper arms': 'Braços',
  'lower arms': 'Antebraços',
  'forearms': 'Antebraços',
  'biceps': 'Bíceps',
  'biceps brachii': 'Bíceps Braquial',
  'biceps short head': 'Bíceps Cabeça Curta',
  'biceps long head': 'Bíceps Cabeça Longa',
  'triceps': 'Tríceps',
  'triceps brachii': 'Tríceps Braquial',
  'upper legs': 'Pernas (Coxas)',
  'lower legs': 'Panturrilhas',
  'quads': 'Quadríceps',
  'quadriceps': 'Quadríceps',
  'hamstrings': 'Posteriores de Coxa',
  'glutes': 'Glúteos',
  'calves': 'Panturrilhas',
  'gastrocnemius': 'Gastrocnêmio',
  'soleus': 'Sóleo',
  'traps': 'Trapézio',
  'trapezius': 'Trapézio',
  'rhomboids': 'Rombóides',
  'waist': 'Abdômen / Cintura',
  'abs': 'Abdômen',
  'abdominals': 'Abdominais',
  'obliques': 'Oblíquos',
  'core': 'Core',
  'hip flexors': 'Flexores de Quadril',
  'adductors': 'Adutores',
  'abductors': 'Abdutores',
  'cardiovascular system': 'Sistema Cardiovascular',
  'cardio': 'Cardio'
}

// Equipments to PT-BR
export const EQUIPMENT_MAP_PT = {
  'barbell': 'Barra',
  'dumbbell': 'Halteres',
  'cable': 'Cabo',
  'leverage machine': 'Máquina de Alavanca',
  'body weight': 'Peso Corporal',
  'bodyweight': 'Peso Corporal',
  'assisted': 'Assistido',
  'smith machine': 'Máquina Smith',
  'band': 'Elástico',
  'resistance band': 'Elástico',
  'kettlebell': 'Kettlebell',
  'stability ball': 'Bola Suíça',
  'medicine ball': 'Medicine Ball',
  'roller': 'Rolo de Liberação',
  'rope': 'Corda',
  'wheel': 'Roda Abdominal',
  'trap bar': 'Barra Hexagonal',
  'hex bar': 'Barra Hexagonal',
  'weighted': 'Com Peso Adicional',
  'exercise': 'Equipamento'
}

// Common full exercise names in Portuguese do Brasil
export const EXERCISE_NAMES_PT = {
  'barbell bench press': 'Supino Reto com Barra',
  'bench press': 'Supino Reto com Barra',
  'lever pec deck fly': 'Voador / Peck Deck na Máquina',
  'pec deck fly': 'Voador na Máquina (Peck Deck)',
  'cable crossover high-to-low': 'Crossover no Cabo (Polia Alta)',
  'cable crossover': 'Crossover no Cabo',
  'incline dumbbell bench press': 'Supino Inclinado com Halteres',
  'incline dumbbell press': 'Supino Inclinado com Halteres',
  'incline barbell bench press': 'Supino Inclinado com Barra',
  'decline dumbbell bench press': 'Supino Declinado com Halteres',
  'decline barbell bench press': 'Supino Declinado com Barra',
  'dumbbell bench press': 'Supino Reto com Halteres',
  'dumbbell fly': 'Crucifixo Reto com Halteres',
  'incline dumbbell fly': 'Crucifixo Inclinado com Halteres',
  'decline dumbbell fly': 'Crucifixo Declinado com Halteres',
  'cable fly': 'Crucifixo no Cabo',
  'standing cable fly': 'Crucifixo em Pé no Cabo',
  'wide-grip lat pulldown': 'Puxada Alta com Pegada Aberta',
  'lat pulldown': 'Puxada Alta',
  'close-grip lat pulldown': 'Puxada Alta com Pegada Fechada',
  'cable seated row': 'Remada Baixa no Cabo',
  'seated cable row': 'Remada Baixa no Cabo',
  'bent over barbell row': 'Remada Curvada com Barra',
  'bent-over barbell row': 'Remada Curvada com Barra',
  'bent over dumbbell row': 'Remada Curvada com Halteres',
  'one-arm dumbbell row': 'Remada Unilateral com Haltere (Serrote)',
  'dumbbell row': 'Remada com Halteres',
  't-bar row': 'Remada Cavalinho (Barra T)',
  'pull-up': 'Barra Fixa (Pronada)',
  'chin-up': 'Barra Fixa (Supinada)',
  'push-up': 'Flexão de Braço',
  'dips': 'Mergulho em Paralelas',
  'chest dip': 'Mergulho para Peitoral',
  'tricep dip': 'Mergulho para Tríceps',
  'barbell squat': 'Agachamento Livre com Barra',
  'squat': 'Agachamento Livre',
  'front squat': 'Agachamento Frontal',
  'goblet squat': 'Agachamento Goblet',
  'leg press': 'Leg Press 45°',
  'hack squat': 'Agachamento Hack',
  'leg extension': 'Cadeira Extensora',
  'lying leg curl': 'Mesa Flexora',
  'seated leg curl': 'Cadeira Flexora',
  'standing calf raise': 'Elevação de Panturrilha em Pé',
  'seated calf raise': 'Elevação de Panturrilha Sentado',
  'deadlift': 'Levantamento Terra',
  'barbell deadlift': 'Levantamento Terra com Barra',
  'romanian deadlift': 'Levantamento Terra Romeno (RDL)',
  'dumbbell romanian deadlift': 'Levantamento Terra Romeno com Halteres (RDL)',
  'dumbbell romanian deadlift (rdl)': 'Levantamento Terra Romeno com Halteres (RDL)',
  'stiff-leg deadlift': 'Stiff com Barra',
  'dumbbell stiff': 'Stiff com Halteres',
  'hip thrust': 'Elevação Pélvica com Barra',
  'barbell hip thrust': 'Elevação Pélvica com Barra',
  'glute bridge': 'Ponte para Glúteos',
  'lunges': 'Avanço / Passada',
  'walking lunge': 'Passada com Halteres',
  'bulgarian split squat': 'Agachamento Búlgaro',
  'overhead press': 'Desenvolvimento de Ombros',
  'barbell overhead press': 'Desenvolvimento Militar com Barra',
  'dumbbell shoulder press': 'Desenvolvimento com Halteres',
  'military press': 'Desenvolvimento Militar',
  'arnold press': 'Desenvolvimento Arnold',
  'dumbbell lateral raise': 'Elevação Lateral com Halteres',
  'lateral raise': 'Elevação Lateral',
  'cable lateral raise': 'Elevação Lateral no Cabo',
  'front raise': 'Elevação Frontal com Halteres',
  'face pull': 'Face Pull no Cabo',
  'reverse fly': 'Crucifixo Invertido',
  'reverse pec deck': 'Crucifixo Invertido na Máquina',
  'barbell curl': 'Rosca Direta com Barra',
  'dumbbell bicep curl': 'Rosca Direta com Halteres',
  'hammer curl': 'Rosca Martelo',
  'preacher curl': 'Rosca Scott',
  'concentration curl': 'Rosca Concentrada',
  'incline dumbbell curl': 'Rosca Inclinada com Halteres',
  'cable curl': 'Rosca Bíceps no Cabo',
  'tricep pushdown': 'Tríceps Pulley (Corda ou Barra)',
  'triceps pushdown': 'Tríceps Pulley (Corda ou Barra)',
  'cable tricep extension': 'Extensão de Tríceps no Cabo',
  'skull crusher': 'Tríceps Testa com Barra',
  'lying triceps extension': 'Tríceps Testa',
  'overhead tricep extension': 'Tríceps Francês',
  'dumbbell kickback': 'Tríceps Coice com Haltere',
  'plank': 'Prancha Abdominal',
  'crunch': 'Abdominal Tradicional',
  'hanging leg raise': 'Elevação de Pernas na Barra',
  'cable woodchopper': 'Woodchopper no Cabo'
}

// Rules for algorithmic PT-BR translation of exercise phrases
const REPLACEMENTS = [
  [/\bbarbell\b/gi, 'com Barra'],
  [/\bdumbbell\b/gi, 'com Halteres'],
  [/\bcable\b/gi, 'no Cabo'],
  [/\bsmith machine\b/gi, 'no Smith'],
  [/\bleverage machine\b/gi, 'na Máquina'],
  [/\bmachine\b/gi, 'na Máquina'],
  [/\bband\b/gi, 'com Elástico'],
  [/\bkettlebell\b/gi, 'com Kettlebell'],
  [/\bincline\b/gi, 'Inclinado(a)'],
  [/\bdecline\b/gi, 'Declinado(a)'],
  [/\bseated\b/gi, 'Sentado(a)'],
  [/\bstanding\b/gi, 'em Pé'],
  [/\blying\b/gi, 'Deitado(a)'],
  [/\bkneeling\b/gi, 'de Joelhos'],
  [/\bone-arm\b/gi, 'Unilateral'],
  [/\bsingle arm\b/gi, 'Unilateral'],
  [/\bone-leg\b/gi, 'Unilateral'],
  [/\bsingle leg\b/gi, 'Unilateral'],
  [/\balternating\b/gi, 'Alternado'],
  [/\balternate\b/gi, 'Alternado'],
  [/\bwide grip\b/gi, 'Pegada Aberta'],
  [/\bwide-grip\b/gi, 'Pegada Aberta'],
  [/\bclose grip\b/gi, 'Pegada Fechada'],
  [/\bclose-grip\b/gi, 'Pegada Fechada'],
  [/\breverse grip\b/gi, 'Pegada Invertida'],
  [/\bbench press\b/gi, 'Supino'],
  [/\bpress\b/gi, 'Desenvolvimento / Press'],
  [/\bflyes\b/gi, 'Crucifixo'],
  [/\bfly\b/gi, 'Crucifixo'],
  [/\brow\b/gi, 'Remada'],
  [/\browing\b/gi, 'Remada'],
  [/\bpulldown\b/gi, 'Puxada'],
  [/\bpull-up\b/gi, 'Barra Fixa'],
  [/\bpush-up\b/gi, 'Flexão de Braço'],
  [/\bcurl\b/gi, 'Rosca'],
  [/\bextension\b/gi, 'Extensão'],
  [/\braise\b/gi, 'Elevação'],
  [/\bsquat\b/gi, 'Agachamento'],
  [/\blunge\b/gi, 'Avanço'],
  [/\bdeadlift\b/gi, 'Levantamento Terra'],
  [/\bshrug\b/gi, 'Encolhimento'],
  [/\bcrunch\b/gi, 'Abdominal'],
  [/\bdip\b/gi, 'Mergulho']
]

// Translates a muscle or body part string
export function translateMuscle(str) {
  if (!str) return ''
  const clean = String(str).toLowerCase().trim()
  return MUSCLE_MAP_PT[clean] || str
}

// Translates equipment
export function translateEquipment(str) {
  if (!str) return ''
  const clean = String(str).toLowerCase().trim()
  return EQUIPMENT_MAP_PT[clean] || str
}

// Translate exercise name instantly using dictionary & rules
export function translateExerciseName(name) {
  if (!name) return ''
  const clean = String(name).toLowerCase().trim()

  // 1. Check local cache
  if (cache.has(clean)) return cache.get(clean)

  // 2. Direct dictionary match
  if (EXERCISE_NAMES_PT[clean]) {
    const res = EXERCISE_NAMES_PT[clean]
    saveCache(clean, res)
    return res
  }

  // 3. Pattern / term replacement
  let transformed = clean
  for (const [pattern, repl] of REPLACEMENTS) {
    transformed = transformed.replace(pattern, repl)
  }

  // Clean up punctuation and spacing
  transformed = transformed.replace(/\s+/g, ' ').trim()
  // Capitalize first letters of words
  const capitalized = transformed.charAt(0).toUpperCase() + transformed.slice(1)

  saveCache(clean, capitalized)
  return capitalized
}

// Asynchronously enhance translation with Minimax AI for precision
export async function translateWithMinimax(name, overview = '') {
  const clean = String(name).toLowerCase().trim()
  const cacheKey = `ai_${clean}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

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
          {
            role: 'system',
            content: 'Você é um especialista em musculação e biomecânica no Brasil. Traduza o nome do exercício e breve descrição para Português do Brasil com o vocabulário real de academias brasileiras. Retorne SOMENTE um JSON no formato: {"name": "...", "overview": "..."}.'
          },
          {
            role: 'user',
            content: `Exercício: "${name}". Descrição: "${overview}"`
          }
        ]
      })
    })

    if (!res.ok) return null
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ''
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed.name) {
        saveCache(clean, parsed.name)
        saveCache(cacheKey, parsed)
        return parsed
      }
    }
  } catch {}
  return null
}
