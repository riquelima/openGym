// Thin re-export so Settings.jsx can lazy-import just the test call without
// pulling in the (much larger) importer. Kept separate from importer.js so
// the key-test path stays small and dependency-free.
const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = 'MiniMax-M3'

export async function testMinimaxConnection(key) {
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [{ role: 'user', content: 'responda apenas: ok' }],
      max_tokens: 8,
      temperature: 0
    })
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = await res.json()
  const preview = data?.choices?.[0]?.message?.content || ''
  return { preview }
}
