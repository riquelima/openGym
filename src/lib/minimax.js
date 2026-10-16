// Minimax M3 client. The API key is baked in here on purpose: this app is
// distributed as a single bundle and the AI features are part of the product,
// not an opt-in per user. Rotating the key means editing this file.
const MINIMAX_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2'
const MINIMAX_MODEL = 'MiniMax-M3'
const MINIMAX_KEY = 'sk-cp-meaN0PHZdGi3-5gZffia9b6PyDIh27vyk54LwG6gw965dFLWoIHowFo19rTqoHdbxhaQezJlMMBgTEYhNni51sJnMWCcPHIKtCg4GRY-pGMmrXarNIxxGQA'

export const getMinimaxKey = () => MINIMAX_KEY

export async function testMinimaxConnection() {
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_KEY}` },
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
