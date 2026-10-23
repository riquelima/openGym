// Algoritmo Analítico do AI Coach — Processamento profundo de treino, biometria e nutrição.
// Gera recomendações personalizadas que se renovam diariamente e reagem em tempo real ao histórico do usuário.

import { todayISO, fmtNum } from './format.js'
import { loadOfWorkouts, MUSCLE_NAME } from './muscles.js'
import { streakWeeks, lastBW, effectiveRoutine } from './history.js'
import { EXIDX } from './exercises.js'

/**
 * FNV-1a hash simplificado para gerar seed estável por dia e estado.
 */
function hashString(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0
  }
  return h
}

/**
 * Gerador de números pseudo-aleatórios (XorShift32) a partir de uma seed.
 */
function createPrng(seed) {
  let s = seed || 123456789
  return function next() {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    return ((s >>> 0) / 4294967296)
  }
}

/**
 * Análise biométrica e nutricional profunda do usuário.
 */
export function analyzeBiometrics(S) {
  const bwList = S.bodyweight || []
  const latestBW = bwList.length ? bwList[bwList.length - 1] : null
  const curW = latestBW ? Number(latestBW.w) : null
  const defaultW = curW || (S.unit === 'lb' ? 165 : 75)
  const isLb = S.unit === 'lb'
  const weightKg = isLb ? defaultW * 0.453592 : defaultW

  // Dias desde a última pesagem
  let daysSinceWeighIn = 999
  if (latestBW?.d) {
    const diffMs = new Date(todayISO()).getTime() - new Date(latestBW.d).getTime()
    daysSinceWeighIn = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
  }

  // Variação de peso nos últimos 7 e 30 dias
  let delta7d = null
  let delta30d = null
  if (bwList.length >= 2) {
    const nowMs = new Date(todayISO()).getTime()
    const point7d = bwList.slice().reverse().find(b => {
      const d = (nowMs - new Date(b.d).getTime()) / (1000 * 60 * 60 * 24)
      return d >= 5 && d <= 12
    })
    if (point7d && curW) delta7d = curW - Number(point7d.w)

    const point30d = bwList.slice().reverse().find(b => {
      const d = (nowMs - new Date(b.d).getTime()) / (1000 * 60 * 60 * 24)
      return d >= 20 && d <= 40
    })
    if (point30d && curW) delta30d = curW - Number(point30d.w)
  }

  // Metas de Proteína (1.6g a 2.2g por kg de peso corporal)
  const proteinMin = Math.round(weightKg * 1.6)
  const proteinMax = Math.round(weightKg * 2.2)

  // Meta de Hidratação (35ml a 45ml por kg de peso corporal)
  const waterMinL = Number((weightKg * 0.035).toFixed(1))
  const waterMaxL = Number((weightKg * 0.045).toFixed(1))

  // Alinhamento com objetivo (Target Weight)
  const targetW = S.targetW ? Number(S.targetW) : null
  let goalType = 'maintain'
  let weightGap = 0
  if (targetW && curW) {
    weightGap = Number((targetW - curW).toFixed(1))
    if (weightGap <= -0.5) goalType = 'cut'
    else if (weightGap >= 0.5) goalType = 'bulk'
  }

  return {
    curW,
    weightKg,
    defaultW,
    hasBW: !!curW,
    daysSinceWeighIn,
    delta7d,
    delta30d,
    targetW,
    goalType,
    weightGap,
    proteinMin,
    proteinMax,
    waterMinL,
    waterMaxL,
    unit: S.unit || 'kg'
  }
}

/**
 * Análise de histórico de treinos, volume, manias e horários.
 */
export function analyzeWorkoutsHistory(S) {
  const workouts = (S.workouts || []).slice().sort((a, b) => new Date(a.d).getTime() - new Date(b.d).getTime())
  const total = workouts.length
  const last = total ? workouts[total - 1] : null

  // Dias desde o último treino
  let daysSinceWorkout = 999
  if (last?.d) {
    const diffMs = new Date(todayISO()).getTime() - new Date(last.d).getTime()
    daysSinceWorkout = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
  }

  // Volume (Tonnage: sum(w * r)) nos últimos 7 dias vs 7 dias anteriores
  const nowMs = new Date(todayISO()).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  let vol7d = 0
  let volPrev7d = 0
  let sets7d = 0
  let workouts7d = 0

  workouts.forEach(w => {
    const ageDays = (nowMs - new Date(w.d).getTime()) / dayMs
    let wVol = 0
    let wSets = 0
    ;(w.entries || []).forEach(e => {
      ;(e.sets || []).forEach(s => {
        if (s.done) {
          wVol += (Number(s.w) || 0) * (Number(s.r) || 0)
          wSets++
        }
      })
    })

    if (ageDays >= 0 && ageDays <= 7) {
      vol7d += wVol
      sets7d += wSets
      workouts7d++
    } else if (ageDays > 7 && ageDays <= 14) {
      volPrev7d += wVol
    }
  })

  let volTrendPct = null
  if (volPrev7d > 0) {
    volTrendPct = Math.round(((vol7d - volPrev7d) / volPrev7d) * 100)
  }

  // Duração média dos treinos e horários habituais ("manias")
  let totalDurMin = 0
  let timedCount = 0
  const hourBuckets = { morning: 0, midday: 0, evening: 0, night: 0 }

  workouts.slice(-10).forEach(w => {
    if (w.start && w.end && w.end > w.start) {
      const dur = (w.end - w.start) / 60000
      if (dur >= 10 && dur <= 180) {
        totalDurMin += dur
        timedCount++
      }
    }
    const t = w.start || (w.d ? new Date(w.d + 'T12:00:00').getTime() : null)
    if (t) {
      const h = new Date(t).getHours()
      if (h >= 5 && h < 11) hourBuckets.morning++
      else if (h >= 11 && h < 16) hourBuckets.midday++
      else if (h >= 16 && h < 21) hourBuckets.evening++
      else hourBuckets.night++
    }
  })

  const avgDurationMin = timedCount ? Math.round(totalDurMin / timedCount) : 55
  let dominantTime = 'evening'
  let maxBucket = -1
  for (const [timeKey, count] of Object.entries(hourBuckets)) {
    if (count > maxBucket) {
      maxBucket = count
      dominantTime = timeKey
    }
  }

  // Média de RIR / RPE reportado
  let totalRir = 0
  let rirCount = 0
  workouts.slice(-5).forEach(w => {
    ;(w.entries || []).forEach(e => {
      ;(e.sets || []).forEach(s => {
        if (s.done && s.rir != null) {
          totalRir += Number(s.rir)
          rirCount++
        }
      })
    })
  })
  const avgRir = rirCount ? Number((totalRir / rirCount).toFixed(1)) : null

  return {
    total,
    last,
    daysSinceWorkout,
    vol7d,
    volPrev7d,
    volTrendPct,
    sets7d,
    workouts7d,
    avgDurationMin,
    dominantTime,
    avgRir,
    streak: streakWeeks(S)
  }
}

/**
 * Análise de Sobrecarga Progressiva, Estagnações (Platôs) e Recordes.
 */
export function analyzeProgressionAndStalls(S) {
  const workouts = S.workouts || []
  if (workouts.length < 2) return { stalledExercise: null, recentPr: null }

  // Rastrear histórico por exercício nas últimas 6 sessões
  const exHistory = {}
  workouts.slice(-8).forEach(w => {
    ;(w.entries || []).forEach(e => {
      if (!e.id) return
      const doneSets = (e.sets || []).filter(s => s.done && (Number(s.w) > 0 || Number(s.r) > 0))
      if (!doneSets.length) return

      let maxW = 0
      let maxRAtTopW = 0
      doneSets.forEach(s => {
        const wVal = Number(s.w) || 0
        const rVal = Number(s.r) || 0
        if (wVal > maxW) {
          maxW = wVal
          maxRAtTopW = rVal
        } else if (wVal === maxW && rVal > maxRAtTopW) {
          maxRAtTopW = rVal
        }
      })

      if (!exHistory[e.id]) exHistory[e.id] = []
      exHistory[e.id].push({ d: w.d, w: maxW, r: maxRAtTopW })
    })
  })

  // Detectar estagnação (mesmo peso e mesmas/menores repetições em 2+ sessões seguidas)
  let stalledExercise = null
  for (const [exId, sessions] of Object.entries(exHistory)) {
    if (sessions.length >= 2) {
      const sLast = sessions[sessions.length - 1]
      const sPrev = sessions[sessions.length - 2]
      if (sLast.w > 0 && sLast.w === sPrev.w && sLast.r <= sPrev.r) {
        const exObj = EXIDX[exId]
        stalledExercise = {
          id: exId,
          name: exObj?.n || exId,
          weight: sLast.w,
          reps: sLast.r
        }
        break
      }
    }
  }

  // Detectar PR recente
  let recentPr = null
  for (const [exId, sessions] of Object.entries(exHistory)) {
    if (sessions.length >= 2) {
      const sLast = sessions[sessions.length - 1]
      const sPrev = sessions[sessions.length - 2]
      if (sLast.w > sPrev.w) {
        const exObj = EXIDX[exId]
        recentPr = {
          id: exId,
          name: exObj?.n || exId,
          weight: sLast.w,
          prevWeight: sPrev.w
        }
        break
      }
    }
  }

  return { stalledExercise, recentPr }
}

/**
 * Análise de Equilíbrio Muscular e Assimetrias Biomecânicas.
 */
export function analyzeMuscleSymmetry(S) {
  const recentWorkouts = (S.workouts || []).slice(-10)
  const muscleLoad = loadOfWorkouts(recentWorkouts)
  const entries = Object.entries(muscleLoad).sort((a, b) => b[1] - a[1])

  if (!entries.length) {
    return {
      topMuscle: null,
      neglectedMuscles: [],
      hasQuadHamstringImbalance: false,
      hasChestBackImbalance: false,
      quadsLoad: 0,
      hamstringsLoad: 0,
      chestLoad: 0,
      backLoad: 0
    }
  }

  const topMuscle = entries[0][0]
  const topLoad = entries[0][1]

  // Músculos com carga menor que 15% do mais treinado
  const neglectedMuscles = entries
    .filter(([slug, load]) => load < topLoad * 0.15 && slug !== 'tibialis' && slug !== 'serratus')
    .map(([slug]) => slug)

  // Desequilíbrio Quadríceps vs Isquiotibiais (Cadeia Posterior)
  const quads = muscleLoad['quadriceps'] || 0
  const hamstrings = muscleLoad['hamstring'] || 0
  const hasQuadHamstringImbalance = quads >= 6 && hamstrings < quads * 0.55

  // Desequilíbrio Peitoral vs Costas
  const chest = muscleLoad['chest'] || 0
  const back = (muscleLoad['upper-back'] || 0) + (muscleLoad['trapezius'] || 0)
  const hasChestBackImbalance = chest >= 8 && back < chest * 0.5

  return {
    topMuscle,
    neglectedMuscles,
    hasQuadHamstringImbalance,
    hasChestBackImbalance,
    quadsLoad: quads,
    hamstringsLoad: hamstrings,
    chestLoad: chest,
    backLoad: back
  }
}

/**
 * Gera o pool completo de cards do AI Coach e seleciona ao menos 10 cards diários,
 * ordenados por relevância e aleatoriedade controlada pelo dia atual (seed).
 */
export function generateAICoachCards(S, options = {}) {
  const safeS = {
    dayPlan: {},
    week: {},
    workouts: [],
    bodyweight: [],
    routines: [],
    active: null,
    targetW: null,
    unit: 'kg',
    restSec: 90,
    ...S
  }
  const today = options.today || todayISO()
  const bio = analyzeBiometrics(safeS)
  const train = analyzeWorkoutsHistory(safeS)
  const prog = analyzeProgressionAndStalls(safeS)
  const sym = analyzeMuscleSymmetry(safeS)

  // Seed composta por data + resumo do estado
  const stateSignature = `${today}_${train.total}_${train.vol7d}_${bio.curW || 0}_${bio.targetW || 0}_${safeS.active ? 1 : 0}`
  const seed = hashString(stateSignature)
  const prng = createPrng(seed)

  const candidates = []

  // 1. Treino Ativo em Andamento (Prioridade Máxima)
  if (safeS.active) {
    candidates.push({
      id: 'active_workout',
      priority: 100,
      category: 'Treino',
      badge: 'Em Andamento',
      badgeColor: 'var(--orange)',
      icon: 'timer',
      title: 'Sessão em Andamento',
      summary: `Você está realizando "${safeS.active.name || 'Treino'}".`,
      detail: 'Mantenha o foco em cada repetição e descanse o tempo necessário entre as séries para preservar a capacidade contrátil das fibras musculares.',
      metric: 'Treino Ativo',
      action: { type: 'nav', path: '/workout', label: 'Continuar Treino' }
    })
  }

  // 2. Alerta de Pesagem Pendente
  if (!bio.hasBW || bio.daysSinceWeighIn >= 5) {
    candidates.push({
      id: 'weigh_in_nudge',
      priority: 95,
      category: 'Metas',
      badge: 'Atualização',
      badgeColor: 'var(--yellow)',
      icon: 'scale',
      title: 'Atualize seu Peso Corporal',
      summary: bio.hasBW ? `Último registro há ${bio.daysSinceWeighIn} dias.` : 'Nenhum peso registrado ainda.',
      detail: 'Pesar-se em jejum pela manhã permite calibrar com precisão cirúrgica suas metas de proteínas, calorias e taxas de ganho de massa ou queima de gordura.',
      metric: 'Balança Matinal',
      action: { type: 'bwSheet', label: 'Registrar Peso' }
    })
  }

  // 3. Meta Proteica Individualizada
  candidates.push({
    id: 'protein_target',
    priority: 88,
    category: 'Nutrição',
    badge: 'Meta Proteica',
    badgeColor: 'var(--acc)',
    icon: 'flame',
    title: 'Janela Diária de Proteína',
    summary: `Meta: ${bio.proteinMin}g a ${bio.proteinMax}g de proteína/dia.`,
    detail: `Calculado para seus ${fmtNum(bio.curW || bio.defaultW)} ${bio.unit} (1.6g a 2.2g/kg). Distribua em 3 a 4 refeições com ~30-45g cada para ativar o sinal anabólico mTOR e otimizar a síntese proteica miofibrilar.`,
    metric: `${bio.proteinMin}g - ${bio.proteinMax}g / dia`,
    action: null
  })

  // 4. Meta de Hidratação Personalizada
  candidates.push({
    id: 'hydration_target',
    priority: 86,
    category: 'Hidratação',
    badge: 'Eletrólitos',
    badgeColor: '#06b6d4',
    icon: 'bolt',
    title: 'Volume Hídrico Otimizado',
    summary: `Consuma de ${bio.waterMinL}L a ${bio.waterMaxL}L de água hoje.`,
    detail: `A hidratação adequada mantém a pressão intracelular dos miócitos elevada. Uma perda de apenas 2% de água reduz a força muscular em até 15%. Em treinos intensos, adicione uma pitada de sal na garrafa.`,
    metric: `${bio.waterMinL}L a ${bio.waterMaxL}L`,
    action: null
  })

  // 5. Estagnação Detectada (Platô)
  if (prog.stalledExercise) {
    candidates.push({
      id: 'stalled_breakthrough',
      priority: 92,
      category: 'Sobrecarga',
      badge: 'Quebra de Platô',
      badgeColor: '#ec4899',
      icon: 'dumbbell',
      title: `Platô em ${prog.stalledExercise.name}`,
      summary: `Carga travada em ${fmtNum(prog.stalledExercise.weight)} ${bio.unit} por repetições iguais.`,
      detail: `Aplique a 'Progressão Dupla': fixe essa carga e foque em subir apenas as repetições (ex: de 8 para 10-12) antes de elevar o peso. Como alternativa, faça uma pausa isométrica de 1s no ponto de maior tensão.`,
      metric: `Platô ${prog.stalledExercise.weight} ${bio.unit}`,
      action: { type: 'nav', path: '/library', label: 'Ver Exercício' }
    })
  }

  // 6. PR Recente / Potenciação Pós-Ativação
  if (prog.recentPr) {
    candidates.push({
      id: 'recent_pr_boost',
      priority: 90,
      category: 'Hipertrofia',
      badge: 'Recorde Pessoal',
      badgeColor: 'var(--yellow)',
      icon: 'trophy',
      title: `Novo Recorde em ${prog.recentPr.name}!`,
      summary: `Você subiu de ${fmtNum(prog.recentPr.prevWeight)} para ${fmtNum(prog.recentPr.weight)} ${bio.unit}.`,
      detail: 'Seu sistema neuromuscular está em momento de supercompensação. Consolide essa nova carga nas próximas 2 sessões mantendo a técnica impecável antes de tentar novos saltos de peso.',
      metric: `+${fmtNum(prog.recentPr.weight - prog.recentPr.prevWeight)} ${bio.unit}`,
      action: null
    })
  }

  // 7. Desequilíbrio Quadríceps vs Isquiotibiais
  if (sym.hasQuadHamstringImbalance) {
    candidates.push({
      id: 'imbalance_quads_hams',
      priority: 91,
      category: 'Músculos',
      badge: 'Equilíbrio Articular',
      badgeColor: '#f59e0b',
      icon: 'legs',
      title: 'Atenção à Cadeia Posterior',
      summary: 'Volume de quadríceps muito superior ao de posteriores.',
      detail: 'O predomínio de quadríceps aumenta as forças de cisalhamento no ligamento cruzado anterior dos joelhos. Adicione Stiff com halteres, Mesa Flexora ou Elevação Pélvica na sua próxima rotina de pernas.',
      metric: 'Foco Posteriores',
      action: { type: 'nav', path: '/library', label: 'Exercícios Posteriores' }
    })
  }

  // 8. Desequilíbrio Peitoral vs Dorsais
  if (sym.hasChestBackImbalance) {
    candidates.push({
      id: 'imbalance_chest_back',
      priority: 89,
      category: 'Músculos',
      badge: 'Postura & Ombros',
      badgeColor: '#3b82f6',
      icon: 'arm',
      title: 'Balanço Peito vs Costas',
      summary: 'Mais séries de empurrar do que puxar recentemente.',
      detail: 'O encurtamento do peitoral associado a dorsais sub-treinados provoca rotação medial dos ombros e dor acromial. Priorize remadas horizontais e crucifixo inverso para retrair as escápulas.',
      metric: 'Foco Costas',
      action: { type: 'nav', path: '/library', label: 'Explorar Remadas' }
    })
  }

  // 9. Músculo Negligenciado
  if (sym.neglectedMuscles.length > 0) {
    const negSlug = sym.neglectedMuscles[0]
    const negName = MUSCLE_NAME[negSlug] || negSlug
    candidates.push({
      id: `neglected_${negSlug}`,
      priority: 84,
      category: 'Músculos',
      badge: 'Ponto Fraco',
      badgeColor: '#8b5cf6',
      icon: 'figureStrength',
      title: `Volume Baixo: ${negName}`,
      summary: `${negName} recebeu volume mínimo nas últimas sessões.`,
      detail: `Para evitar assimetrias e estagnação estética, inclua 3 a 4 séries diretas para ${negName} no aquecimento ou como finalizador do seu próximo treino.`,
      metric: `${negName}`,
      action: { type: 'nav', path: '/library', label: 'Ver Exercícios' }
    })
  }

  // 10. Gestão de Peso & Meta Calórica
  if (bio.goalType === 'cut') {
    candidates.push({
      id: 'nutrition_cutting_rate',
      priority: 85,
      category: 'Metas',
      badge: 'Definição',
      badgeColor: 'var(--yellow)',
      icon: 'scale',
      title: 'Estratégia de Déficit Calórico',
      summary: `Meta: atingir ${fmtNum(bio.targetW)} ${bio.unit} (faltam ${fmtNum(Math.abs(bio.weightGap))} ${bio.unit}).`,
      detail: 'Para preservar a massa muscular em cutting, mantenha o déficit moderado (300 a 500 kcal abaixo do gasto total diário) e taxa de perda de 0,5% a 0,8% do peso corporal por semana.',
      metric: `Alvo: ${fmtNum(bio.targetW)} ${bio.unit}`,
      action: { type: 'bwSheet', label: 'Ajustar Meta' }
    })
  } else if (bio.goalType === 'bulk') {
    candidates.push({
      id: 'nutrition_bulking_rate',
      priority: 85,
      category: 'Metas',
      badge: 'Hipertrofia',
      badgeColor: 'var(--acc)',
      icon: 'scale',
      title: 'Superávit Calórico Limpo',
      summary: `Meta: subir até ${fmtNum(bio.targetW)} ${bio.unit} (+${fmtNum(bio.weightGap)} ${bio.unit}).`,
      detail: 'O superávit controlado de 250 a 350 kcal/dia maximiza o ganho miofibrilar sem excesso de gordura subcutânea. Mire em um ganho gradual de 0,2kg a 0,4kg por semana.',
      metric: `Alvo: ${fmtNum(bio.targetW)} ${bio.unit}`,
      action: { type: 'bwSheet', label: 'Ajustar Meta' }
    })
  }

  // 11. Timing de Carboidratos Pré-Treino
  candidates.push({
    id: 'carb_timing_pre',
    priority: 81,
    category: 'Nutrição',
    badge: 'Timing Nutricional',
    badgeColor: '#10b981',
    icon: 'sparkles',
    title: 'Energia Pré-Treino',
    summary: 'Carboidratos complexos 60-90 minutos antes da sessão.',
    detail: 'Consumir aveia, arroz ou batata com antecedência garante a integridade dos estoques de glicogênio muscular para sustentar repetições pesadas sem fadiga prematura.',
    metric: '60-90 min pré-treino',
    action: null
  })

  // 12. Nutrição Pós-Treino & Síntese Proteica
  candidates.push({
    id: 'nutrition_post_refuel',
    priority: 80,
    category: 'Nutrição',
    badge: 'Recuperação',
    badgeColor: '#10b981',
    icon: 'flame',
    title: 'Janela Pós-Treino',
    summary: 'Combine 30g de proteína com carboidratos em até 2 horas.',
    detail: 'A ingestão de carboidratos com proteína no pós-treino eleva a insulina plasmática, reduzindo o cortisol catabólico e acelerando o transporte de aminoácidos para o sarcoplasma.',
    metric: '30-40g Proteína',
    action: null
  })

  // 13. Suplementação de Creatina Monohidratada
  candidates.push({
    id: 'supplement_creatine',
    priority: 82,
    category: 'Suplementação',
    badge: 'Ergogênico',
    badgeColor: '#6366f1',
    icon: 'bolt',
    title: 'Creatina Monohidratada',
    summary: 'Tome 3g a 5g diariamente, inclusive nos dias de descanso.',
    detail: 'A creatina atua por saturação crônica dos estoques de fosfocreatina celular, promovendo maior potência em esforços máximos e hidratação celular anabólica.',
    metric: '3g - 5g todo dia',
    action: null
  })

  // 14. Sono Profundo e Liberação de GH/Testosterona
  candidates.push({
    id: 'recovery_sleep_gh',
    priority: 83,
    category: 'Sono & SNC',
    badge: 'Hormônios',
    badgeColor: '#a855f7',
    icon: 'moon',
    title: 'Sono Profundo & GH',
    summary: 'Mire em 7 a 9 horas de sono em quarto totalmente escuro.',
    detail: 'Mais de 80% do hormônio do crescimento (GH) e do pico de testosterona são liberados no estágio N3 do sono de ondas lentas. Desconecte telas 45 min antes de deitar.',
    metric: '7 - 9 Horas',
    action: null
  })

  // 15. Intervalos de Descanso e ATP-CP
  const restConfig = safeS.restSec || 90
  candidates.push({
    id: 'rest_intervals_science',
    priority: 79,
    category: 'Treino',
    badge: 'Descanso',
    badgeColor: '#64748b',
    icon: 'timer',
    title: 'Intervalo Entre Séries',
    summary: `Configurado em ${restConfig}s no aplicativo.`,
    detail: 'Para exercícios compostos pesados (Agachamento, Supino, Levantamento Terra), pausas de 2 a 3 minutos recuperam até 95% do ATP-CP, garantindo mais volume de carga total.',
    metric: `${restConfig}s Padrão`,
    action: null
  })

  // 16. Proximidade da Falha e RIR (Reps in Reserve)
  candidates.push({
    id: 'rir_mechanics',
    priority: 78,
    category: 'Estratégia',
    badge: 'Intensidade',
    badgeColor: '#ef4444',
    icon: 'chartLine',
    title: 'Intensidade com RIR 1-2',
    summary: 'Pare a 1 ou 2 repetições antes da falha mecânica concêntrica.',
    detail: 'Ir até a falha absoluta em todas as séries causa fadiga desproporcional do sistema nervoso central sem ganhos superiores de hipertrofia. Mantenha 1 repetição na reserva.',
    metric: 'RIR 1 - 2',
    action: null
  })

  // 17. Ritmo Circadiano & Horário de Treino
  if (train.dominantTime === 'night') {
    candidates.push({
      id: 'circadian_night_caffeine',
      priority: 84,
      category: 'Hábitos',
      badge: 'Manias & Horários',
      badgeColor: '#a855f7',
      icon: 'clock',
      title: 'Treino Noturno & Cafeína',
      summary: 'Seu padrão de treino costuma ser à noite.',
      detail: 'A cafeína tem meia-vida de 5 a 7 horas no organismo. Evite pré-treinos estimulantes após as 17h para não suprimir a arquitetura do sono e prejudicar sua recuperação.',
      metric: 'Treino Noturno',
      action: null
    })
  } else if (train.dominantTime === 'morning') {
    candidates.push({
      id: 'circadian_morning_hydration',
      priority: 84,
      category: 'Hábitos',
      badge: 'Manias & Horários',
      badgeColor: '#f59e0b',
      icon: 'clock',
      title: 'Treino Matinal & Articulações',
      summary: 'Seu padrão de treino costuma ser pela manhã.',
      detail: 'Ao acordar, os discos intervertebrais estão mais hidratados e vulneráveis. Beba 500ml de água e faça 5 a 8 minutos de aquecimento articular antes de carregar peso na coluna.',
      metric: 'Treino Matinal',
      action: null
    })
  } else {
    candidates.push({
      id: 'circadian_consistency',
      priority: 77,
      category: 'Hábitos',
      badge: 'Consistência',
      badgeColor: 'var(--acc)',
      icon: 'clock',
      title: 'Regularidade de Horário',
      summary: 'Treinar no mesmo horário sincroniza os genes de relógio celular.',
      detail: 'Estudos apontam que o rendimento físico e a tolerância ao lactato aumentam quando o corpo se acostuma a ser exigido em um horário estável todos os dias.',
      metric: 'Horário Fixo',
      action: null
    })
  }

  // 18. Sequência de Consistência Semanal
  if (train.streak >= 1) {
    candidates.push({
      id: 'consistency_streak_badge',
      priority: 82,
      category: 'Consistência',
      badge: 'Constância',
      badgeColor: 'var(--acc)',
      icon: 'flame',
      title: `${train.streak} Semanas Consecutivas!`,
      summary: 'Sua disciplina semanal está consolidada.',
      detail: 'A adesão contínua ao plano ao longo dos meses é o preditor número um de remodelação muscular e hipertrofia duradoura. Mantenha o ritmo nesta semana.',
      metric: `${train.streak} semanas`,
      action: null
    })
  }

  // 19. Volume Semanal por Músculo (10-20 séries)
  candidates.push({
    id: 'volume_landmarks',
    priority: 76,
    category: 'Volume',
    badge: 'Hipertrofia',
    badgeColor: '#3b82f6',
    icon: 'dumbbell',
    title: 'Faixa Ótima de Séries',
    summary: '10 a 20 séries diretas por grupo muscular por semana.',
    detail: 'Menos de 10 séries semanais é volume de manutenção; acima de 20 a 22 séries costuma entrar em volume lixo, onde a fadiga supera a capacidade adaptativa do tecido.',
    metric: '10-20 séries/sem',
    action: null
  })

  // 20. Aquecimento Específico (Feeder Sets)
  candidates.push({
    id: 'warmup_feeder_sets',
    priority: 75,
    category: 'Treino',
    badge: 'Prevenção',
    badgeColor: '#10b981',
    icon: 'stretch',
    title: 'Séries de Reconhecimento',
    summary: 'Faça 2 a 3 séries leves antes da carga máxima.',
    detail: 'Execute 5 reps com 40%, 3 reps com 60% e 1 rep com 80% do peso de trabalho. Isso lubrifica a cartilagem articular e ' + 'ativa unidades motoras de alto limiar sem fadiga.',
    metric: 'Aquecimento Rápido',
    action: null
  })

  // 21. Sinais do Sistema Nervoso Central (Deload)
  candidates.push({
    id: 'cns_deload_radar',
    priority: 74,
    category: 'Recuperação',
    badge: 'SNC & Fadiga',
    badgeColor: '#ec4899',
    icon: 'heart',
    title: 'Radar de Fadiga Acumulada',
    summary: 'Dores articulares e falta de apetite indicam fadiga do SNC.',
    detail: 'Se suas cargas estagnaram em múltiplos exercícios por 3 semanas seguidas, programe uma semana de deload reduzindo 40% do volume total para regenerar tecidos conectivos.',
    metric: 'Fadiga Neural',
    action: null
  })

  // 22. Mobilidade e Flexibilidade
  candidates.push({
    id: 'mobility_hip_ankle',
    priority: 73,
    category: 'Mobilidade',
    badge: 'Amplitude',
    badgeColor: '#06b6d4',
    icon: 'stretch',
    title: 'Mobilidade de Tornozelo e Quadril',
    summary: 'Maior amplitude de movimento recruta mais fibras musculares.',
    detail: 'Alongar a fáscia e mobilizar os tornozelos antes de agachar permite que a tíbia avance naturalmente, transferindo a sobrecarga para os quadríceps e poupando a lombar.',
    metric: 'Amplitude Total',
    action: null
  })

  // 23. Conexão Mente-Músculo em Isoladores
  candidates.push({
    id: 'mind_muscle_connection',
    priority: 72,
    category: 'Biomecânica',
    badge: 'Recrutamento',
    badgeColor: '#8b5cf6',
    icon: 'dumbbell',
    title: 'Conexão Mente-Músculo',
    summary: 'Foco interno na contração em exercícios de isolamento.',
    detail: 'Em roscas, elevações laterais e extensora, concentrar a atenção na contração máxima no pico do movimento eleva a ativação eletromiográfica em até 22% em relação a mover a barra rápido.',
    metric: '+22% Ativação',
    action: null
  })

  // 24. Micronutrientes Essenciais: Zinco & Magnésio
  candidates.push({
    id: 'micronutrients_zma',
    priority: 71,
    category: 'Nutrição',
    badge: 'Minerais',
    badgeColor: '#10b981',
    icon: 'shield',
    title: 'Magnésio & Zinco Noturnos',
    summary: 'Relaxamento muscular e suporte aos hormônios anabólicos.',
    detail: 'O magnésio quelato reduz a excitabilidade neuromuscular e facilita o sono profundo, enquanto o zinco é cofator indispensável na síntese androgênica e imunológica.',
    metric: 'Micronutrientes',
    action: null
  })

  // 25. Fibras e Saúde Intestinal
  candidates.push({
    id: 'gut_health_fibers',
    priority: 70,
    category: 'Nutrição',
    badge: 'Microbiota',
    badgeColor: '#84cc16',
    icon: 'lightbulb',
    title: 'Fibras e Absorção Proteica',
    summary: '25g a 35g de fibras por dia para digerir dietas ricas em proteínas.',
    detail: 'Uma microbiota intestinal equilibrada sintetiza ácidos graxos de cadeia curta que reduzem inflamações sistêmicas e otimizam a absorção dos aminoácidos ingeridos.',
    metric: '25g - 35g fibras',
    action: null
  })

  // 26. Cardio Zona 2 para Apoio à Hipertrofia
  candidates.push({
    id: 'cardio_zone_2',
    priority: 69,
    category: 'Cardio',
    badge: 'Aeróbico',
    badgeColor: '#06b6d4',
    icon: 'figureRun',
    title: 'Cardio em Zona 2',
    summary: '20 a 30 minutos em intensidade moderada 2x por semana.',
    detail: 'Aumenta a densidade mitocondrial e os capilares sanguíneos nos músculos sem interferir na síntese de proteínas (mTOR), melhorando sua recuperação entre séries de agachamento.',
    metric: 'Zona 2 · 20-30 min',
    action: null
  })

  // 27. Treino Programado para Hoje
  const todayRoutine = effectiveRoutine(safeS, today)
  if (todayRoutine && !safeS.active) {
    candidates.push({
      id: 'today_routine_plan',
      priority: 87,
      category: 'Treino',
      badge: 'Treino de Hoje',
      badgeColor: 'var(--acc)',
      icon: 'calendar',
      title: todayRoutine.name,
      summary: 'Rotina programada para hoje na sua planilha.',
      detail: 'Revise os exercícios e metas de carga antes de começar. Aqueça adequadamente e execute cada série com cadência controlada.',
      metric: 'Hoje',
      action: { type: 'startFlow', routineId: todayRoutine.id, label: 'Iniciar Treino' }
    })
  }

  // 28. Duração Otimizada da Sessão
  candidates.push({
    id: 'session_duration_sweetspot',
    priority: 68,
    category: 'Treino',
    badge: 'Gestão de Tempo',
    badgeColor: '#64748b',
    icon: 'timer',
    title: 'Duração Ideal da Sessão',
    summary: 'Mantenha o treino efetivo entre 45 e 65 minutos.',
    detail: 'Após 60 minutos de esforço intenso, a curva de cortisol eleva-se e a qualidade mecânica das últimas séries cai drasticamente. Foco na qualidade acima da quantidade.',
    metric: '45-65 minutos',
    action: null
  })

  // 29. Cadência Excêntrica Controlada
  candidates.push({
    id: 'eccentric_tempo',
    priority: 67,
    category: 'Biomecânica',
    badge: 'Tensão Mecânica',
    badgeColor: '#6366f1',
    icon: 'dumbbell',
    title: 'Fase Excêntrica (2 a 3s)',
    summary: 'Controle a descida do peso para maximizar o dano mecânico.',
    detail: 'A fase excêntrica gera o maior estiramento miofibrilar e estímulo de mecanotransdução. Evite deixar a carga cair pela ação exclusiva da gravidade.',
    metric: 'Descida em 3s',
    action: null
  })

  // 30. Cafeína Estratégica
  candidates.push({
    id: 'caffeine_timing',
    priority: 66,
    category: 'Suplementação',
    badge: 'Foco & Força',
    badgeColor: '#f59e0b',
    icon: 'bolt',
    title: 'Cafeína Estratégica',
    summary: '3mg a 5mg por kg de peso corporal 45 min antes do treino.',
    detail: 'A cafeína bloqueia receptores de adenosina no cérebro, reduzindo a percepção de fadiga e aumentando a taxa de disparo de unidades motoras.',
    metric: '45 min antes',
    action: null
  })

  // Algoritmo de Pontuação Dinâmica:
  // Combina a prioridade analítica do card com um jitter pseudo-aleatório baseado no dia,
  // garantindo que alertas urgentes (prioridade >= 90) sempre liderem a fila,
  // enquanto as demais dicas científicas alternam diariamente de maneira fluida.
  const scored = candidates.map(c => {
    // Jitter determinístico entre 0 e 15 com base no PRNG diário
    const dailyJitter = prng() * 15
    const finalScore = c.priority + (c.priority >= 90 ? 100 : dailyJitter)
    return { ...c, _score: finalScore }
  })

  // Ordenar por score decrescente
  scored.sort((a, b) => b._score - a._score)

  // Assegurar diversidade de categorias no carrossel
  const selected = []
  const seenIds = new Set()
  const catCount = {}

  // Primeira passagem: pegar os mais prioritários respeitando limite por categoria
  for (const item of scored) {
    if (seenIds.has(item.id)) continue
    const cat = item.category
    const curCatCount = catCount[cat] || 0
    if (curCatCount < 3 || item.priority >= 90) {
      selected.push(item)
      seenIds.add(item.id)
      catCount[cat] = curCatCount + 1
    }
  }

  // Segunda passagem: garantir que tenhamos ao menos 10 cards (e até 14 cards)
  for (const item of scored) {
    if (selected.length >= 14) break
    if (!seenIds.has(item.id)) {
      selected.push(item)
      seenIds.add(item.id)
    }
  }

  // Garantia absoluta de no mínimo 10 cards
  return selected.slice(0, Math.max(10, Math.min(selected.length, 14)))
}
