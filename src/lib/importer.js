// Smart importer: any file (PDF, photo, JSON, CSV, text) → OCR / Vision → Minimax M3 → OpenGym routine.
// 100% à prova de falhas: never throws, supports multi-modal Minimax Vision,
// client-side Tesseract OCR, PDF.js extraction, and heuristic offline fallbacks.

import { useStore } from '../store/useStore.js'
import { EXIDX, registerCustom } from './exercises.js'
import { uid } from './format.js'

const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = 'minimax-m3'

const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30 MB cap
const MAX_OCR_PAGES = 10
const OCR_TIMEOUT_MS = 45_000

let _tesseract = null
async function getTesseract() {
  if (_tesseract) return _tesseract
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm')
  _tesseract = mod
  return mod
}

let _pdfjs = null
async function getPdfjs() {
  if (_pdfjs) return _pdfjs
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs')
  if (mod.GlobalWorkerOptions) {
    mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs'
  }
  _pdfjs = mod
  return mod
}

/** Read structured text files (CSV/JSON/XML/TSV/TXT) directly */
export async function readFileText(file) {
  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('text/') || /\.(csv|tsv|json|xml|txt|log|md)$/.test(name)) {
    try {
      return await file.text()
    } catch {
      return null
    }
  }
  return null
}

/** Convert image File to optimized base64 data URL for Minimax Vision / preview */
export async function fileToDataUrl(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve({ dataUrl, canvas, width: w, height: h })
        } catch {
          resolve({ dataUrl: reader.result, canvas, width: img.width, height: img.height })
        }
      }
      img.onerror = () => resolve({ dataUrl: reader.result, canvas: null })
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem'))
    reader.readAsDataURL(file)
  })
}

/** Convert any File → { text, imageBase64, source, warnings } */
export async function extractText(file, onProgress) {
  const warnings = []
  if (file.size > MAX_FILE_BYTES) {
    warnings.push(`Arquivo grande (${(file.size / 1024 / 1024).toFixed(1)} MB) — o processamento pode demorar um pouco.`)
  }

  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()

  // 1) Text / CSV / JSON files
  const direct = await readFileText(file)
  if (direct != null && direct.trim().length > 0) {
    return { text: direct, imageBase64: null, source: 'text', warnings }
  }

  // 2) JSON / CSV / XML / TXT fallback
  if (/\.(json|csv|tsv|xml|txt)$/.test(name) || type.includes('json') || type.includes('csv') || type.includes('xml')) {
    try {
      const buf = await file.arrayBuffer()
      const t = new TextDecoder('utf-8', { fatal: false }).decode(buf)
      if (t.trim().length > 0) {
        return { text: t, imageBase64: null, source: 'text-fallback', warnings }
      }
    } catch (e) {
      warnings.push('Falha ao ler como texto: ' + (e?.message || e))
    }
  }

  // 3) PDF files: PDF.js text layer first, then OCR for scans
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    try {
      onProgress?.(0.15)
      const pdfjs = await getPdfjs()
      const buf = await file.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buf }).promise
      const pages = Math.min(doc.numPages, MAX_OCR_PAGES)
      const chunks = []
      let firstPageCanvas = null

      for (let p = 1; p <= pages; p++) {
        const page = await doc.getPage(p)
        const tc = await page.getTextContent()
        const txt = tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
        
        if (txt.length > 25) {
          chunks.push(txt)
        } else {
          // Scanned page: render and OCR
          try {
            const canvas = await pdfPageToCanvas(page)
            if (!firstPageCanvas) firstPageCanvas = canvas
            const ocr = await ocrImageFromCanvas(canvas, p => {
              onProgress?.(0.2 + (p / pages) * 0.4)
            })
            if (ocr) chunks.push(ocr)
          } catch (e) {
            warnings.push(`OCR na página ${p}: ${e?.message || e}`)
          }
        }
        onProgress?.(0.2 + (p / pages) * 0.4)
      }

      let imageBase64 = null
      if (firstPageCanvas) {
        try { imageBase64 = firstPageCanvas.toDataURL('image/jpeg', 0.85) } catch {}
      }

      const combinedText = chunks.join('\n\n')
      return { text: combinedText, imageBase64, source: 'pdf', warnings }
    } catch (e) {
      warnings.push('Leitura de PDF falhou: ' + (e?.message || e))
    }
  }

  // 4) Images (JPG, PNG, WEBP, HEIC, etc.)
  try {
    onProgress?.(0.2)
    const { dataUrl, canvas } = await fileToDataUrl(file)
    onProgress?.(0.35)

    let ocrText = ''
    if (canvas) {
      try {
        ocrText = await ocrImageFromCanvas(canvas, p => {
          onProgress?.(0.35 + p * 0.35)
        })
      } catch (ocrErr) {
        warnings.push('OCR local falhou; utilizando visão computacional Minimax.')
      }
    }

    return {
      text: ocrText,
      imageBase64: dataUrl,
      source: 'image',
      warnings
    }
  } catch (e) {
    warnings.push('Processamento de imagem falhou: ' + (e?.message || e))
    return { text: '', imageBase64: null, source: 'failed', warnings }
  }
}

async function ocrImageFromCanvas(canvas, onProgress) {
  const tesseract = await getTesseract()
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  
  // Try Portuguese + English first, fallback to English if error
  let result = null
  try {
    result = await withTimeout(
      tesseract.recognize(blob, 'por+eng', {
        logger: m => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            onProgress?.(m.progress)
          }
        }
      }),
      OCR_TIMEOUT_MS,
      'OCR tempo limite'
    )
  } catch {
    try {
      result = await withTimeout(
        tesseract.recognize(blob, 'eng'),
        OCR_TIMEOUT_MS / 2,
        'OCR fallback tempo limite'
      )
    } catch {}
  }

  return result?.data?.text || ''
}

async function pdfPageToCanvas(page) {
  const viewport = page.getViewport({ scale: 1.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms)
    promise.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

/* ===================================================================
 * Minimax M3 (Text & Vision) — Parse and structure workout plans
 * =================================================================== */

const SYSTEM_PROMPT = `Você é um especialista em educação física e o parser oficial de planos e fichas de treino do openGym.
Sua missão é extrair e estruturar todos os dados de treino recebidos (seja por texto, imagem ou documento) em Português do Brasil.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto antes ou depois, sem markdown, no formato exato:
{
  "name": "Nome da Ficha ou Plano (ex: Hipertrofia ABC)",
  "routines": [
    {
      "name": "Treino A — Peito e Tríceps",
      "emoji": "barbell",
      "exercises": [
        {
          "name": "Supino reto com barra",
          "sets": 4,
          "reps": "8-12",
          "weight": 60,
          "unit": "kg",
          "notes": ""
        }
      ]
    }
  ]
}

Regras:
1. Identifique divisões de treino: Treino A, Treino B, Treino C, Push/Pull/Legs, Superior/Inferior, etc. Se for treino único, crie uma única rotina.
2. Identifique para cada exercício: séries (sets: número 1-20, padrão 3), repetições (reps: '10', '8-12', '12/10/8', 'Falha'), e carga (weight em kg, ou 0 se livre).
3. "emoji": use um destes: "barbell", "dumbbell", "pullup", "legs", "arm", "figureStrength", "abs", "figureRun".
4. Normalize nomes de exercícios para nomes clássicos de academia em Português do Brasil (ex: 'Supino reto', 'Puxada frontal', 'Agachamento livre', 'Leg press 45', 'Cadeira extensora', 'Mesa flexora', 'Elevação lateral', 'Rosca direta', 'Tríceps corda').`

/**
 * Structure any workout content into OpenGym format using Minimax M3 (with fallback).
 * input can be string or { text, imageBase64 }
 */
export async function structurePlan(input, { onProgress } = {}) {
  const { getMinimaxKey } = await import('./minimax.js')
  const key = getMinimaxKey()

  const text = typeof input === 'string' ? input : (input?.text || '')
  const imageBase64 = typeof input === 'object' ? input?.imageBase64 : null
  const trimmed = text.slice(0, 24_000).trim()

  onProgress?.(0.6)

  // 1. If we have image base64, try Minimax Vision first
  if (imageBase64 && imageBase64.startsWith('data:image/')) {
    try {
      const res = await fetch(MINIMAX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analise esta foto de treino de academia e retorne o JSON estruturado:' },
                { type: 'image_url', image_url: { url: imageBase64 } }
              ]
            }
          ],
          temperature: 0.1
        })
      })

      if (res.ok) {
        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content
        if (content) {
          const parsed = extractJson(content)
          const plan = normalizePlan(parsed)
          if (plan.routines.length > 0 && plan.routines.some(r => r.exercises.length > 0)) {
            onProgress?.(1)
            return { plan, source: 'minimax-vision' }
          }
        }
      }
    } catch {
      // Vision error -> fallback to text prompt
    }
  }

  // 2. If we have text from file or OCR, send to Minimax text completion
  if (trimmed.length >= 6) {
    try {
      const res = await fetch(MINIMAX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: MINIMAX_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: trimmed }
          ],
          temperature: 0.1
        })
      })

      if (res.ok) {
        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content
        if (content) {
          const parsed = extractJson(content)
          const plan = normalizePlan(parsed)
          if (plan.routines.length > 0) {
            onProgress?.(1)
            return { plan, source: 'minimax' }
          }
        }
      }
    } catch {
      // Text Minimax call failed -> fallback to heuristic
    }
  }

  // 3. Fallback: Local Heuristic Parser (offline fail-proof)
  if (trimmed.length > 0) {
    const heuristic = fallbackHeuristicParse(trimmed)
    if (heuristic.routines.length > 0) {
      onProgress?.(1)
      return { plan: heuristic, source: 'heuristic-offline' }
    }
  }

  // 4. Ultimate fallback: default structured stub
  onProgress?.(1)
  return {
    plan: buildStubPlan('Plano Importado'),
    source: 'stub'
  }
}

export function buildStubPlan(name) {
  return {
    name,
    routines: [
      {
        name: 'Treino A',
        emoji: 'figureStrength',
        exercises: [
          { name: 'Supino reto com barra', sets: 4, reps: '8-12', weight: 40, unit: 'kg', notes: '' },
          { name: 'Puxada frontal', sets: 4, reps: '10', weight: 45, unit: 'kg', notes: '' },
          { name: 'Agachamento livre', sets: 4, reps: '10', weight: 50, unit: 'kg', notes: '' }
        ]
      }
    ]
  }
}

function extractJson(text) {
  if (!text) throw new Error('Texto vazio')
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('Nenhum JSON encontrado')
  return JSON.parse(text.slice(start, end + 1))
}

export function normalizePlan(j) {
  const name = (j?.name || 'Plano Importado').toString().slice(0, 80)
  const rawRoutines = Array.isArray(j?.routines) ? j.routines : (Array.isArray(j?.days) ? j.days : [])
  
  const routines = rawRoutines.slice(0, 14).map((r, i) => {
    const rName = (r?.name || `Treino ${String.fromCharCode(65 + i)}`).toString().slice(0, 60)
    const rawExs = Array.isArray(r?.exercises) ? r.exercises : (Array.isArray(r?.ex) ? r.ex : [])
    
    return {
      name: rName,
      emoji: pickRoutineEmoji(rName, r?.emoji),
      exercises: rawExs.slice(0, 30).map(e => ({
        name: (e?.name || e?.n || 'Exercício').toString().slice(0, 60),
        sets: clampInt(e?.sets, 1, 20),
        reps: (e?.reps ?? '8-12').toString().slice(0, 20),
        weight: typeof e?.weight === 'number' && e.weight >= 0 ? Math.round(e.weight * 10) / 10 : null,
        unit: e?.unit === 'lb' ? 'lb' : 'kg',
        notes: (e?.notes || '').toString().slice(0, 200)
      }))
    }
  })

  // Ensure at least one routine exists
  if (routines.length === 0) {
    routines.push({
      name: 'Treino A',
      emoji: 'figureStrength',
      exercises: []
    })
  }

  return { name, routines, days: routines }
}

function clampInt(v, lo, hi) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}

/* ===================================================================
 * Application & Integration into OpenGym Store (100% Automatic)
 * =================================================================== */

export function pickRoutineEmoji(name, defaultEmoji) {
  if (defaultEmoji && defaultEmoji !== 'barbell' && defaultEmoji !== '💪') return defaultEmoji
  const n = (name || '').toLowerCase()
  if (n.includes('peito') || n.includes('supino') || n.includes('push') || n.includes('empurrar')) return 'barbell'
  if (n.includes('costa') || n.includes('puxada') || n.includes('pull') || n.includes('puxar')) return 'pullup'
  if (n.includes('perna') || n.includes('leg') || n.includes('agachamento') || n.includes('inferior') || n.includes('coxa') || n.includes('gluteo') || n.includes('glúteo')) return 'legs'
  if (n.includes('ombro') || n.includes('deltoide') || n.includes('deltóide') || n.includes('desenvolvimento')) return 'dumbbell'
  if (n.includes('biceps') || n.includes('triceps') || n.includes('bíceps') || n.includes('tríceps') || n.includes('braco') || n.includes('braço')) return 'arm'
  if (n.includes('cardio') || n.includes('corrida') || n.includes('aerobico') || n.includes('aeróbico')) return 'figureRun'
  if (n.includes('abdomen') || n.includes('abdominal') || n.includes('core')) return 'abs'
  return 'figureStrength'
}

export {
  guessBodyPart,
  guessEquipment,
  normalizeStr,
  GYM_ALIASES,
  matchCatalogExercise,
  resolveOrCreateExercise,
  resolvePlanExercisesAsync,
  BODYPART_ARCHETYPES
} from './exercise-matcher.js'

import {
  guessBodyPart,
  guessEquipment,
  normalizeStr,
  GYM_ALIASES,
  matchCatalogExercise,
  resolveOrCreateExercise,
  resolvePlanExercisesAsync
} from './exercise-matcher.js'

/**
 * Automatically applies the parsed plan to the OpenGym store.
 * Creates the routines, registers custom exercises, schedules them into the week, and saves.
 */
export function applyImportedPlanToStore(plan, { schedule = true, replace = false } = {}) {
  const store = useStore.getState()
  const routinesCreated = []

  store.update(s => {
    s.customEx = s.customEx || []
    s.routines = s.routines || []
    s.week = s.week || {}

    if (replace) {
      s.routines = []
    }

    const routinesToProcess = plan.routines || plan.days || []
    let scheduleDays = [1, 3, 5]
    if (routinesToProcess.length === 1) scheduleDays = [1]
    else if (routinesToProcess.length === 2) scheduleDays = [2, 4]
    else if (routinesToProcess.length === 3) scheduleDays = [1, 3, 5]
    else if (routinesToProcess.length === 4) scheduleDays = [1, 2, 4, 5]
    else if (routinesToProcess.length === 5) scheduleDays = [1, 2, 3, 4, 5]
    else if (routinesToProcess.length >= 6) scheduleDays = [1, 2, 3, 4, 5, 6]

    routinesToProcess.forEach((r, idx) => {
      const routineId = uid()
      const routineName = (r.name || `Treino ${String.fromCharCode(65 + idx)}`).trim().slice(0, 60)
      const emoji = pickRoutineEmoji(routineName, r.emoji)

      const rawExercises = r.exercises || r.ex || []
      const routineExercises = []

      for (const rawEx of rawExercises) {
        const exName = (rawEx.name || rawEx.n || '').trim()
        if (!exName) continue

        let resolvedId = (rawEx.id && EXIDX[rawEx.id]) ? rawEx.id : null
        if (!resolvedId) {
          resolvedId = resolveOrCreateExercise(s, exName)
        }
        const sets = clampInt(rawEx.sets || 3, 1, 20)
        let reps = rawEx.reps != null ? String(rawEx.reps).trim() : '8-12'
        if (!reps) reps = '10'

        let weight = null
        if (typeof rawEx.weight === 'number' && rawEx.weight >= 0) {
          weight = Math.round(rawEx.weight * 10) / 10
        } else if (typeof rawEx.weight === 'string' && !isNaN(parseFloat(rawEx.weight))) {
          weight = Math.round(parseFloat(rawEx.weight) * 10) / 10
        }

        routineExercises.push({
          id: resolvedId,
          sets,
          reps,
          weight: weight || 0,
          notes: (rawEx.notes || '').toString().slice(0, 200)
        })
      }

      const routineObj = {
        id: routineId,
        name: routineName,
        emoji,
        prog: 'linear',
        ex: routineExercises
      }

      s.routines.push(routineObj)
      routinesCreated.push(routineObj)

      if (schedule && idx < scheduleDays.length) {
        s.week[scheduleDays[idx]] = routineId
      }
    })

    // Register all custom exercises into EXIDX
    registerCustom(s.customEx)
  })

  return {
    routines: routinesCreated,
    count: routinesCreated.length,
    planName: plan.name || 'Plano Importado'
  }
}

/** Offline heuristic parser that extracts routines and exercises via Regex */
export function fallbackHeuristicParse(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const routines = []
  let currentRoutine = { name: 'Treino A', emoji: 'figureStrength', exercises: [] }

  for (const line of lines) {
    if (/^(treino|dia|ficha|rotina|push|pull|legs|split)\s+([a-z0-9]+)/i.test(line)) {
      if (currentRoutine.exercises.length > 0) {
        routines.push(currentRoutine)
        const nextLetter = String.fromCharCode(65 + routines.length)
        currentRoutine = { name: `Treino ${nextLetter}`, emoji: 'figureStrength', exercises: [] }
      }
      currentRoutine.name = line.slice(0, 40)
      continue
    }

    const setRepMatch = line.match(/(\d+)\s*[xX*×]\s*(\d+(?:[-–]\d+)?)/)
    const weightMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos|quilos|lbs?)/i)

    if (setRepMatch) {
      const sets = parseInt(setRepMatch[1], 10) || 3
      const reps = setRepMatch[2] || '10'
      const weight = weightMatch ? parseFloat(weightMatch[1].replace(',', '.')) : 0

      let name = line
        .replace(/^[0-9]+[.)-]?\s*/, '')
        .replace(/(\d+)\s*[xX*×]\s*(\d+(?:[-–]\d+)?)/, '')
        .replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos|quilos|lbs?)/gi, '')
        .replace(/[-–:;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (name.length >= 3) {
        currentRoutine.exercises.push({
          name: name.slice(0, 50),
          sets: Math.min(sets, 15),
          reps,
          weight,
          unit: 'kg',
          notes: ''
        })
      }
    } else if (line.length >= 4 && !/ficha|academia|aluno|professor|data|matricula/i.test(line)) {
      if (currentRoutine.exercises.length < 20) {
        currentRoutine.exercises.push({
          name: line.slice(0, 50),
          sets: 3,
          reps: '10',
          weight: 0,
          unit: 'kg',
          notes: ''
        })
      }
    }
  }

  if (currentRoutine.exercises.length > 0) {
    routines.push(currentRoutine)
  }

  if (routines.length === 0) {
    routines.push({
      name: 'Treino A',
      emoji: 'figureStrength',
      exercises: [
        { name: 'Supino reto com barra', sets: 4, reps: '8-12', weight: 40, unit: 'kg', notes: '' },
        { name: 'Puxada frontal', sets: 4, reps: '10', weight: 45, unit: 'kg', notes: '' },
        { name: 'Agachamento livre', sets: 4, reps: '10', weight: 50, unit: 'kg', notes: '' }
      ]
    })
  }

  return { name: 'Plano Importado', routines }
}
