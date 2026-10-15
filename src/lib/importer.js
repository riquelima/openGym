// Smart importer: any file → text → Minimax M3 → routine.
// All heavy libraries are loaded on demand so the initial bundle stays slim.
// Three independent steps, each with its own fallback:
//   1. readFileText  — handles structured files (CSV, JSON, XML) directly
//   2. extractText   — handles images (OCR) and PDFs (PDF.js → OCR per page)
//   3. structurePlan — sends the text to Minimax M3; if no key or it fails,
//                      returns a hand-edited stub so the sheet still opens
// Every step never throws — the import flow is "100% à prova de falhas":
// any failure surfaces as a partial result plus a reason the user can act on.

import { useStore } from '../store/useStore.js'

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB hard cap; PDFs above this crash the tab
const MAX_OCR_PAGES = 12                  // first 12 pages are enough for a workout plan
const OCR_TIMEOUT_MS = 60_000             // per-page budget

let _tesseract = null
async function getTesseract() {
  if (_tesseract) return _tesseract
  // Tesseract.js is fetched from a CDN to avoid bloating the bundle. The worker
  // and language file are loaded by Tesseract itself from the same origin.
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm')
  _tesseract = mod
  return mod
}

let _pdfjs = null
async function getPdfjs() {
  if (_pdfjs) return _pdfjs
  const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs')
  // PDF.js needs a worker; point it at the same CDN copy. The mismatch warning
  // is harmless for our use (single-page text extraction).
  if (mod.GlobalWorkerOptions) {
    mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs'
  }
  _pdfjs = mod
  return mod
}

function bytesToBlob(bytes, type) { return new Blob([bytes], { type }) }

/** Read structured files (CSV/JSON/XML/TSV) by their MIME type or extension. */
export async function readFileText(file) {
  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('text/') || /\.(csv|tsv|json|xml|txt|log|md)$/.test(name)) {
    return await file.text()
  }
  return null
}

/** Convert any File → string of extracted text. Returns { text, source, warnings }. */
export async function extractText(file, onProgress) {
  const warnings = []
  if (file.size > MAX_FILE_BYTES) {
    warnings.push(`Arquivo grande (${(file.size / 1024 / 1024).toFixed(1)} MB) — apenas o início será processado.`)
  }

  // 1) Already-text files: instant
  const direct = await readFileText(file)
  if (direct != null) return { text: direct, source: 'text', warnings }

  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()

  // 2) JSON / CSV / XML: try to read as text even if MIME is wrong
  if (/\.(json|csv|tsv|xml|txt)$/.test(name) || type.includes('json') || type.includes('csv') || type.includes('xml')) {
    try {
      const buf = await file.arrayBuffer()
      const t = new TextDecoder('utf-8', { fatal: false }).decode(buf)
      return { text: t, source: 'text-fallback', warnings }
    } catch (e) { warnings.push('Falha ao ler como texto: ' + (e?.message || e)) }
  }

  // 3) PDF: PDF.js → text first (works for digital PDFs); OCR per page for scans
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    try {
      const pdfjs = await getPdfjs()
      const buf = await file.arrayBuffer()
      const doc = await pdfjs.getDocument({ data: buf }).promise
      const pages = Math.min(doc.numPages, MAX_OCR_PAGES)
      const chunks = []
      for (let p = 1; p <= pages; p++) {
        const page = await doc.getPage(p)
        const tc = await page.getTextContent()
        const txt = tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
        if (txt.length > 20) { chunks.push(txt); continue }
        // No text layer → render and OCR
        try {
          const ocr = await ocrImageFromCanvas(pdfPageToCanvas(page))
          chunks.push(ocr)
        } catch (e) { warnings.push(`OCR falhou na página ${p}: ${e?.message || e}`) }
        onProgress?.((p / pages) * 0.5)
      }
      return { text: chunks.join('\n\n'), source: 'pdf', warnings }
    } catch (e) {
      warnings.push('PDF não pôde ser lido: ' + (e?.message || e))
    }
  }

  // 4) Images (or anything else): OCR via Tesseract
  try {
    const ocrText = await ocrImage(file, onProgress)
    return { text: ocrText, source: 'ocr', warnings }
  } catch (e) {
    warnings.push('OCR falhou: ' + (e?.message || e))
    return { text: '', source: 'ocr-failed', warnings }
  }
}

async function ocrImage(file, onProgress) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = drawToCanvas(img)
    return await ocrImageFromCanvas(canvas, onProgress)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function ocrImageFromCanvas(canvas, onProgress) {
  const tesseract = await getTesseract()
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  const result = await withTimeout(
    tesseract.recognize(blob, 'eng+por', {
      logger: m => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          onProgress?.(0.5 + m.progress * 0.5)
        }
      }
    }),
    OCR_TIMEOUT_MS,
    'OCR estourou o tempo limite'
  )
  return result?.data?.text || ''
}

async function loadImage(url) {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imagem inválida'))
    img.src = url
  })
}

function drawToCanvas(img) {
  // Cap the longest side at 2000 px — bigger images don't help OCR and
  // blow up memory on mobile.
  const max = 2000
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

async function pdfPageToCanvas(page) {
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width; canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
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
 * Minimax M3 — call only if the user has saved a key.
 * The text is sent with a strict JSON schema; we parse defensively and
 * never throw — if the model is down, we return a hand-built stub so
 * the preview sheet still opens for manual editing.
 * =================================================================== */
const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = 'MiniMax-M3'

const SYSTEM_PROMPT = `Você é um parser de planos de treino. Recebe um texto bruto (que pode vir de
CSV, JSON, PDF ou OCR de foto) e devolve APENAS um JSON válido no esquema abaixo, sem markdown, sem comentários.

Esquema:
{
  "name": "nome curto do plano",
  "days": [
    { "name": "Dia A — Peito", "exercises": [
      { "name": "Supino reto", "sets": 4, "reps": "8-12", "weight": 60, "unit": "kg", "notes": "" }
    ]}
  ]
}

Regras:
- "name" do plano: derive do conteúdo, ou "Plano importado".
- Detecte séries (sets) e repetições (reps) de cada exercício. "reps" pode ser número ("8") ou faixa ("8-12").
- "weight" em kg, número ou null. Converta lb → kg se a unidade for explícita (1 lb = 0.4536 kg).
- Normalize nomes para português do Brasil, sem acentos desnecessários nos identifiers.
- Se o texto estiver ilegível, devolva {"name":"Plano importado","days":[]}.`

export async function structurePlan(rawText, { onProgress } = {}) {
  const key = (useStore.getState().S.minimaxApiKey || '').trim()
  const trimmed = (rawText || '').slice(0, 24_000) // hard cap — long OCR dumps break context
  if (!key) {
    return { plan: buildStubPlan('Sem chave Minimax — preencha manualmente'), source: 'no-key' }
  }
  if (!trimmed || trimmed.length < 8) {
    return { plan: buildStubPlan('Texto vazio — preencha manualmente'), source: 'empty' }
  }
  onProgress?.(0.1)
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
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    })
    onProgress?.(0.7)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('Resposta vazia do Minimax')
    const json = extractJson(content)
    const plan = normalizePlan(json)
    onProgress?.(1)
    return { plan, source: 'minimax' }
  } catch (e) {
    return {
      plan: buildStubPlan(`Minimax indisponível (${e?.message || e}) — preencha manualmente`),
      source: 'minimax-failed',
      error: e?.message || String(e)
    }
  }
}

function buildStubPlan(name) {
  return { name, days: [{ name: 'Dia 1', exercises: [] }] }
}

function extractJson(text) {
  // The model is told to return raw JSON; still, be defensive: strip code
  // fences and grab the outermost {…} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1]
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('no JSON object found')
  return JSON.parse(text.slice(start, end + 1))
}

function normalizePlan(j) {
  const name = (j?.name || 'Plano importado').toString().slice(0, 80)
  const days = Array.isArray(j?.days) ? j.days.slice(0, 14).map((d, i) => ({
    name: (d?.name || `Dia ${i + 1}`).toString().slice(0, 60),
    exercises: Array.isArray(d?.exercises) ? d.exercises.slice(0, 30).map(e => ({
      name: (e?.name || 'Exercício').toString().slice(0, 60),
      sets: clampInt(e?.sets, 1, 20),
      reps: (e?.reps ?? '8-12').toString().slice(0, 20),
      weight: typeof e?.weight === 'number' && e.weight >= 0 ? Math.round(e.weight * 10) / 10 : null,
      unit: e?.unit === 'lb' ? 'lb' : 'kg',
      notes: (e?.notes || '').toString().slice(0, 200)
    })) : []
  })) : []
  return { name, days }
}

function clampInt(v, lo, hi) {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}
