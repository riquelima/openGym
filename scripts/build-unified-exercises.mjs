import fs from 'node:fs'
import path from 'node:path'

const YUHONAS_PATH = '/tmp/repo-yuhonas/dist/exercises.json'
const REPDB_PATH = '/tmp/repo-repdb/exercises.json'
const HASAN_PATH = '/tmp/repo-hasaneyldrm/data/exercises.json'

const OUTPUT_DIR = path.resolve('src/lib/datasets')
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

// -------------------------------------------------------------
// Translation Dictionaries & Rules for Brazilian Portuguese
// -------------------------------------------------------------
const DIRECT_EXERCISE_MAP = {
  'bench press': 'Supino Reto',
  'barbell bench press': 'Supino Reto com Barra',
  'flat barbell bench press': 'Supino Reto com Barra',
  'dumbbell bench press': 'Supino Reto com Halteres',
  'incline bench press': 'Supino Inclinado',
  'incline barbell bench press': 'Supino Inclinado com Barra',
  'incline dumbbell bench press': 'Supino Inclinado com Halteres',
  'incline dumbbell press': 'Supino Inclinado com Halteres',
  'decline bench press': 'Supino Declinado',
  'decline barbell bench press': 'Supino Declinado com Barra',
  'decline dumbbell bench press': 'Supino Declinado com Halteres',
  'close-grip bench press': 'Supino com Pegada Fechada',
  'wide-grip bench press': 'Supino com Pegada Aberta',
  'smith machine bench press': 'Supino no Smith',
  'smith machine incline bench press': 'Supino Inclinado no Smith',
  'smith machine decline bench press': 'Supino Declinado no Smith',
  
  'squat': 'Agachamento Livre',
  'barbell squat': 'Agachamento Livre com Barra',
  'barbell back squat': 'Agachamento Livre com Barra (Costas)',
  'front squat': 'Agachamento Frontal',
  'barbell front squat': 'Agachamento Frontal com Barra',
  'goblet squat': 'Agachamento Goblet',
  'hack squat': 'Agachamento Hack',
  'zercher squat': 'Agachamento Zercher',
  'box squat': 'Agachamento na Caixa',
  'bulgarian split squat': 'Agachamento Búlgaro',
  'split squat': 'Agachamento Split',
  'pistol squat': 'Agachamento Pistola (Unilateral)',
  'overhead squat': 'Agachamento com Barra Acima da Cabeça',
  'smith machine squat': 'Agachamento na Máquina Smith',
  'leg press': 'Leg Press',
  'leg press 45': 'Leg Press 45°',

  'deadlift': 'Levantamento Terra',
  'barbell deadlift': 'Levantamento Terra com Barra',
  'conventional deadlift': 'Levantamento Terra Convencional',
  'romanian deadlift': 'Levantamento Terra Romeno (RDL)',
  'barbell romanian deadlift': 'Levantamento Terra Romeno com Barra (RDL)',
  'dumbbell romanian deadlift': 'Levantamento Terra Romeno com Halteres (RDL)',
  'stiff-leg deadlift': 'Stiff com Barra',
  'sumo deadlift': 'Levantamento Terra Sumô',
  'trap bar deadlift': 'Levantamento Terra na Barra Hexagonal',

  'overhead press': 'Desenvolvimento de Ombros',
  'barbell overhead press': 'Desenvolvimento com Barra',
  'military press': 'Desenvolvimento Militar',
  'dumbbell shoulder press': 'Desenvolvimento com Halteres',
  'seated dumbbell press': 'Desenvolvimento Sentado com Halteres',
  'standing dumbbell press': 'Desenvolvimento em Pé com Halteres',
  'arnold press': 'Desenvolvimento Arnold',
  'push press': 'Push Press',

  'lateral raise': 'Elevação Lateral',
  'dumbbell lateral raise': 'Elevação Lateral com Halteres',
  'cable lateral raise': 'Elevação Lateral no Cabo',
  'seated lateral raise': 'Elevação Lateral Sentado',
  'front raise': 'Elevação Frontal',
  'dumbbell front raise': 'Elevação Frontal com Halteres',
  'barbell front raise': 'Elevação Frontal com Barra',
  'cable front raise': 'Elevação Frontal no Cabo',
  'rear delt fly': 'Crucifixo Invertido',
  'reverse fly': 'Crucifixo Invertido',
  'cable rear delt fly': 'Crucifixo Invertido no Cabo',
  'dumbbell rear delt fly': 'Crucifixo Invertido com Halteres',
  'face pull': 'Face Pull no Cabo',

  'pull-up': 'Barra Fixa (Pronada)',
  'chin-up': 'Barra Fixa (Supinada)',
  'lat pulldown': 'Puxada Alta',
  'wide-grip lat pulldown': 'Puxada Alta Aberta',
  'close-grip lat pulldown': 'Puxada Alta Fechada',
  'reverse-grip lat pulldown': 'Puxada Alta Supinada',
  'bent over row': 'Remada Curvada',
  'bent-over barbell row': 'Remada Curvada com Barra',
  'pendlay row': 'Remada Pendlay',
  'seated cable row': 'Remada Baixa no Cabo',
  'cable seated row': 'Remada Baixa no Cabo',
  'one-arm dumbbell row': 'Remada Unilateral com Haltere (Serrote)',
  'dumbbell row': 'Remada com Halteres',
  't-bar row': 'Remada Cavalinho (Barra T)',
  'chest-supported dumbbell row': 'Remada Apoiada no Banco com Halteres',

  'bicep curl': 'Rosca Bíceps',
  'barbell curl': 'Rosca Direta com Barra',
  'dumbbell bicep curl': 'Rosca Direta com Halteres',
  'dumbbell curl': 'Rosca com Halteres',
  'hammer curl': 'Rosca Martelo',
  'dumbbell hammer curl': 'Rosca Martelo com Halteres',
  'preacher curl': 'Rosca Scott',
  'barbell preacher curl': 'Rosca Scott com Barra',
  'dumbbell preacher curl': 'Rosca Scott com Haltere',
  'concentration curl': 'Rosca Concentrada',
  'incline dumbbell curl': 'Rosca Inclinada com Halteres',
  'cable curl': 'Rosca no Cabo',
  'ez-bar curl': 'Rosca com Barra W',
  'reverse curl': 'Rosca Inversa',

  'tricep pushdown': 'Tríceps Pulley',
  'triceps pushdown': 'Tríceps Pulley',
  'cable tricep pushdown': 'Tríceps Pulley no Cabo',
  'rope tricep pushdown': 'Tríceps Pulley com Corda',
  'skull crusher': 'Tríceps Testa',
  'lying triceps extension': 'Tríceps Testa com Barra',
  'dumbbell skull crusher': 'Tríceps Testa com Halteres',
  'overhead tricep extension': 'Tríceps Francês',
  'dumbbell overhead tricep extension': 'Tríceps Francês com Haltere',
  'cable overhead tricep extension': 'Tríceps Francês no Cabo',
  'tricep dip': 'Mergulho para Tríceps',
  'dips': 'Mergulho em Paralelas',
  'bench dips': 'Mergulho no Banco',
  'push-up': 'Flexão de Braço',

  'leg extension': 'Cadeira Extensora',
  'leg curl': 'Mesa Flexora',
  'seated leg curl': 'Cadeira Flexora',
  'lying leg curl': 'Mesa Flexora',
  'standing calf raise': 'Panturrilha em Pé',
  'seated calf raise': 'Panturrilha Sentado',
  'hip thrust': 'Elevação Pélvica',
  'barbell hip thrust': 'Elevação Pélvica com Barra',
  'glute bridge': 'Ponte para Glúteos',
  'walking lunge': 'Passada com Halteres',
  'lunges': 'Avanço / Passada',
  'step-up': 'Subida no Banco',

  'crunch': 'Abdominal Tradicional',
  'cable crunch': 'Abdominal no Cabo (Pulley)',
  'plank': 'Prancha Abdominal',
  'side plank': 'Prancha Lateral',
  'hanging leg raise': 'Elevação de Pernas na Barra Fixa',
  'hanging knee raise': 'Elevação de Joelhos na Barra Fixa',
  'ab wheel rollout': 'Rolo Abdominal no Solo',
  'russian twist': 'Giro Russo (Russian Twist)',
  'shrug': 'Encolhimento de Ombros',
  'barbell shrug': 'Encolhimento com Barra',
  'dumbbell shrug': 'Encolhimento com Halteres'
}

function cleanStr(s) {
  return (s || '').toLowerCase().trim().replace(/[-_]+/g, ' ')
}

function translateName(rawName, esName = '', equipment = '') {
  const clean = cleanStr(rawName)
  if (DIRECT_EXERCISE_MAP[clean]) {
    return DIRECT_EXERCISE_MAP[clean]
  }

  // Check prefix / partial matches
  for (const [k, v] of Object.entries(DIRECT_EXERCISE_MAP)) {
    if (clean === k || clean.startsWith(k + ' ') || clean.endsWith(' ' + k)) {
      return v
    }
  }

  // If Spanish name exists in RepDB, adapt Spanish to Portuguese
  if (esName) {
    let pt = esName
      .replace(/\bPress de Banca\b/gi, 'Supino Reto')
      .replace(/\bPress de Hombros\b/gi, 'Desenvolvimento de Ombros')
      .replace(/\bPress Inclinado\b/gi, 'Supino Inclinado')
      .replace(/\bPress Declinado\b/gi, 'Supino Declinado')
      .replace(/\bPress Militar\b/gi, 'Desenvolvimento Militar')
      .replace(/\bPress\b/gi, 'Supino')
      .replace(/\bSentadilla\b/gi, 'Agachamento')
      .replace(/\bPeso Muerto\b/gi, 'Levantamento Terra')
      .replace(/\bDominadas\b/gi, 'Barra Fixa')
      .replace(/\bFondos\b/gi, 'Mergulho em Paralelas')
      .replace(/\bFlexiones\b/gi, 'Flexão de Braço')
      .replace(/\bElevaciones Laterales\b/gi, 'Elevação Lateral')
      .replace(/\bElevaciones Frontales\b/gi, 'Elevação Frontal')
      .replace(/\bElevación de Talones\b/gi, 'Elevação de Panturrilha')
      .replace(/\bGemelos\b/gi, 'Panturrilha')
      .replace(/\bZancadas\b/gi, 'Passada / Avanço')
      .replace(/\bExtensión de Cuádriceps\b/gi, 'Cadeira Extensora')
      .replace(/\bCurl Femoral\b/gi, 'Mesa Flexora')
      .replace(/\bRemo\b/gi, 'Remada')
      .replace(/\bPolea\b/gi, 'Polia')
      .replace(/\bMancuerna\b/gi, 'Haltere')
      .replace(/\bMancuernas\b/gi, 'Halteres')
      .replace(/\bBarra Z\b/gi, 'Barra W')
      .replace(/\bBarra\b/gi, 'Barra')
      .replace(/\bcon\b/gi, 'com')
      .replace(/\ben\b/gi, 'em')
      .replace(/\bde\b/gi, 'de')
    if (pt !== esName) return pt
  }

  // Synthesize Portuguese translation from parts
  let translated = rawName
  const replacements = [
    [/Barbell/gi, 'com Barra'],
    [/Dumbbell/gi, 'com Halteres'],
    [/Cable/gi, 'no Cabo'],
    [/Smith Machine/gi, 'no Smith'],
    [/Machine/gi, 'na Máquina'],
    [/Kettlebell/gi, 'com Kettlebell'],
    [/Bench Press/gi, 'Supino'],
    [/Incline/gi, 'Inclinado'],
    [/Decline/gi, 'Declinado'],
    [/Seated/gi, 'Sentado'],
    [/Standing/gi, 'em Pé'],
    [/Lying/gi, 'Deitado'],
    [/Single-Arm|One-Arm/gi, 'Unilateral'],
    [/Close-Grip/gi, 'Pegada Fechada'],
    [/Wide-Grip/gi, 'Pegada Aberta'],
    [/Reverse-Grip/gi, 'Pegada Invertida'],
    [/Squat/gi, 'Agachamento'],
    [/Deadlift/gi, 'Levantamento Terra'],
    [/Overhead Press/gi, 'Desenvolvimento'],
    [/Shoulder Press/gi, 'Desenvolvimento'],
    [/Bicep Curl|Biceps Curl/gi, 'Rosca Bíceps'],
    [/Hammer Curl/gi, 'Rosca Martelo'],
    [/Preacher Curl/gi, 'Rosca Scott'],
    [/Concentration Curl/gi, 'Rosca Concentrada'],
    [/Curl/gi, 'Rosca'],
    [/Tricep Extension|Triceps Extension/gi, 'Extensão de Tríceps'],
    [/Pushdown/gi, 'Pulley'],
    [/Pull-Up|Pullup/gi, 'Barra Fixa'],
    [/Chin-Up|Chinup/gi, 'Barra Fixa Supinada'],
    [/Push-Up|Pushup/gi, 'Flexão de Braço'],
    [/Dips|Dip/gi, 'Mergulho em Paralelas'],
    [/Lat Pulldown/gi, 'Puxada Alta'],
    [/Row/gi, 'Remada'],
    [/Lateral Raise/gi, 'Elevação Lateral'],
    [/Front Raise/gi, 'Elevação Frontal'],
    [/Rear Delt/gi, 'Deltóide Posterior'],
    [/Calf Raise/gi, 'Elevação de Panturrilha'],
    [/Leg Extension/gi, 'Cadeira Extensora'],
    [/Leg Curl/gi, 'Mesa Flexora'],
    [/Leg Press/gi, 'Leg Press'],
    [/Hack Squat/gi, 'Agachamento Hack'],
    [/Hip Thrust/gi, 'Elevação Pélvica'],
    [/Glute Bridge/gi, 'Ponte para Glúteos'],
    [/Lunges|Lunge/gi, 'Avanço / Passada'],
    [/Bulgarian Split Squat/gi, 'Agachamento Búlgaro'],
    [/Crunch/gi, 'Abdominal'],
    [/Plank/gi, 'Prancha'],
    [/Shrug/gi, 'Encolhimento'],
    [/Pec Deck/gi, 'Peck Deck'],
    [/Face Pull/gi, 'Face Pull'],
    [/Flyes|Fly/gi, 'Crucifixo']
  ]

  for (const [pattern, repl] of replacements) {
    translated = translated.replace(pattern, repl)
  }

  // Clean double spaces or grammar artifacts
  translated = translated.replace(/\s+/g, ' ').trim()
  return translated || rawName
}

// -------------------------------------------------------------
// Body Part & Equipment Normalizers
// -------------------------------------------------------------
function mapYuhonasBodyPart(e) {
  if (e.category === 'cardio') return 'cardio'
  const p = (e.primaryMuscles?.[0] || '').toLowerCase()
  switch (p) {
    case 'abdominals': return 'waist'
    case 'abductors':
    case 'adductors':
    case 'glutes':
    case 'hamstrings':
    case 'quadriceps': return 'upper legs'
    case 'calves': return 'lower legs'
    case 'chest': return 'chest'
    case 'forearms': return 'lower arms'
    case 'biceps':
    case 'triceps': return 'upper arms'
    case 'lats':
    case 'lower back':
    case 'middle back': return 'back'
    case 'neck': return 'neck'
    case 'shoulders':
    case 'traps': return 'shoulders'
    default: return 'upper legs'
  }
}

function mapYuhonasEquipment(eq) {
  const l = (eq || '').toLowerCase().trim()
  switch (l) {
    case 'barbell': return 'barbell'
    case 'dumbbell': return 'dumbbell'
    case 'cable': return 'cable'
    case 'machine': return 'leverage machine'
    case 'body only':
    case 'none':
    case '': return 'body weight'
    case 'kettlebells': return 'kettlebell'
    case 'bands': return 'band'
    case 'medicine ball': return 'medicine ball'
    case 'exercise ball': return 'stability ball'
    case 'foam roll': return 'roller'
    case 'e-z curl bar': return 'ez barbell'
    default: return l || 'other'
  }
}

function mapRepdbBodyPart(bp, muscles = []) {
  const l = (bp || '').toLowerCase().trim()
  switch (l) {
    case 'core': return 'waist'
    case 'back': return 'back'
    case 'chest': return 'chest'
    case 'shoulders': return 'shoulders'
    case 'upper_arms': return 'upper arms'
    case 'upper_legs': return 'upper legs'
    case 'lower_legs': return 'lower legs'
    case 'lower_arms': return 'lower arms'
    case 'full_body': {
      const m = muscles[0] || ''
      if (m.includes('chest')) return 'chest'
      if (m.includes('back') || m.includes('lats')) return 'back'
      if (m.includes('deltoid')) return 'shoulders'
      return 'upper legs'
    }
    default: return 'upper legs'
  }
}

function mapRepdbEquipment(eq) {
  const l = (eq || '').toLowerCase().trim()
  switch (l) {
    case 'barbell': return 'barbell'
    case 'dumbbell': return 'dumbbell'
    case 'cable': return 'cable'
    case 'ez_bar': return 'ez barbell'
    case 'smith_machine': return 'smith machine'
    case 'kettlebell': return 'kettlebell'
    case 'flat_bench': return 'flat bench'
    case 'none': return 'body weight'
    case 'pull_up_bar': return 'pull-up bar'
    case 'ab_wheel': return 'wheel roller'
    case 'resistance_band':
    case 'loop_band': return 'band'
    case 'stability_ball': return 'stability ball'
    case 'slam_ball': return 'medicine ball'
    case 'battle_rope':
    case 'climbing_rope': return 'rope'
    case 'dip_station': return 'dip station'
    case 'rings': return 'rings'
    case 'suspension_trainer': return 'suspension trainer'
    case 'treadmill': return 'treadmill'
    case 'air_bike':
    case 'stationary_bike': return 'stationary bike'
    case 'elliptical': return 'elliptical machine'
    case 'rower': return 'rower'
    case 'ski_erg': return 'skierg machine'
    case 'stair_climber': return 'stepmill machine'
    case 'sled': return 'sled machine'
    case 'trap_bar': return 'trap bar'
    case 'plates': return 'weighted'
    // Machine types
    case 'lat_pulldown_machine': return 'lat pulldown machine'
    case 'leg_press': return 'leg press'
    case 'chest_press_machine': return 'chest press machine'
    case 'hack_squat': return 'hack squat'
    case 'leg_curl': return 'leg curl'
    case 'leg_extension': return 'leg extension'
    case 'pec_deck': return 'pec deck'
    case 'seated_row_machine': return 'seated row machine'
    case 'bicep_curl_machine': return 'bicep curl machine'
    case 'tricep_extension_machine': return 'tricep extension machine'
    case 'shoulder_press_machine': return 'shoulder press machine'
    case 'standing_calf_raise_machine':
    case 'seated_calf_raise_machine':
    case 'donkey_calf_raise_machine': return 'calf raise machine'
    case 'hip_abduction_machine': return 'hip abduction machine'
    case 'hip_adduction_machine': return 'hip adduction machine'
    case 'hip_thrust_machine': return 'hip thrust machine'
    case 'back_extension_machine': return 'back extension machine'
    case 'preacher_curl_machine': return 'preacher curl machine'
    case 'reverse_fly_machine': return 'reverse fly machine'
    case 'ab_crunch_machine': return 'ab crunch machine'
    case 'chest_fly_machine': return 'chest fly machine'
    case 'plate_loaded_dip_machine':
    case 'dip_machine': return 'dip machine'
    case 'plate_loaded_lateral_raise_machine': return 'lateral raise machine'
    case 'assisted_pullup_machine': return 'assisted pull-up machine'
    case 'shrug_machine': return 'shrug machine'
    case 'glute_ham_developer': return 'glute ham developer'
    default: return l.replace(/_/g, ' ') || 'other'
  }
}

// -------------------------------------------------------------
// Build Datasets
// -------------------------------------------------------------
console.log('Processing Yuhonas exercises...')
const yuhonasRaw = JSON.parse(fs.readFileSync(YUHONAS_PATH, 'utf8'))
const yuhonasProcessed = yuhonasRaw.map(e => {
  const id = 'yh_' + (e.id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  const namePt = translateName(e.name, '', e.equipment)
  const bp = mapYuhonasBodyPart(e)
  const eq = mapYuhonasEquipment(e.equipment)
  
  // CDN images
  const img = e.images?.[0]
    ? `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${encodeURIComponent(e.id)}/0.jpg`
    : ''
  const gif = e.images?.[1]
    ? `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${encodeURIComponent(e.id)}/1.jpg`
    : img

  return {
    id,
    n: namePt,
    rawName: e.name,
    bp,
    eq,
    tg: e.primaryMuscles?.[0] || '',
    mg: e.category || 'strength',
    sm: e.secondaryMuscles || [],
    st: e.instructions || [],
    img,
    gif,
    source: 'yuhonas'
  }
})

console.log('Processing RepDB exercises...')
const repdbRaw = JSON.parse(fs.readFileSync(REPDB_PATH, 'utf8')).exercises
const repdbProcessed = repdbRaw.map(e => {
  const id = 'rep_' + (e.id || '').replace(/[^a-z0-9_-]/gi, '_')
  const namePt = translateName(e.name_en, e.name_es, e.equipment)
  const bp = mapRepdbBodyPart(e.body_part, e.primary_muscles)
  const eq = mapRepdbEquipment(e.equipment)
  
  const startImg = e.images?.flat?.start
    ? `https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@main/${e.images.flat.start}`
    : ''
  const peakImg = e.images?.flat?.peak
    ? `https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@main/${e.images.flat.peak}`
    : startImg

  return {
    id,
    n: namePt,
    rawName: e.name_en,
    bp,
    eq,
    tg: (e.primary_muscles?.[0] || '').replace(/_/g, ' '),
    mg: e.category || 'strength',
    sm: (e.secondary_muscles || []).map(m => m.replace(/_/g, ' ')),
    st: e.instructions_en || [],
    img: startImg,
    gif: peakImg || startImg,
    source: 'repdb'
  }
})

// Output files
const yuhonasFileContent = `// Free Exercise DB (Yuhonas) Dataset - 876 exercises
// Auto-generated by scripts/build-unified-exercises.mjs
export const YUHONAS_EXDB = ${JSON.stringify(yuhonasProcessed, null, 2)}
`

const repdbFileContent = `// RepDB Exercise Dataset - 643 exercises
// Auto-generated by scripts/build-unified-exercises.mjs
export const REPDB_EXDB = ${JSON.stringify(repdbProcessed, null, 2)}
`

fs.writeFileSync(path.join(OUTPUT_DIR, 'yuhonas.js'), yuhonasFileContent, 'utf8')
fs.writeFileSync(path.join(OUTPUT_DIR, 'repdb.js'), repdbFileContent, 'utf8')

console.log(`Saved ${yuhonasProcessed.length} exercises to src/lib/datasets/yuhonas.js`)
console.log(`Saved ${repdbProcessed.length} exercises to src/lib/datasets/repdb.js`)
