export default {
  id: 'minimax',
  runtime: 'Minimax REST API',

  async check() {
    return { ok: true, version: 'APIv1' };
  },

  async invoke({ prompt, jobDir, env, model, timeoutMs }) {
    let timedOut = false;
    const abortController = new AbortController();
    const timer = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, timeoutMs);

    try {
      // The user requested to hardcode this key in the repo for immediate use
      const apiKey = env.MINIMAX_API_KEY || 'sk-cp-meaN0PHZdGi3-5gZffia9b6PyDIh27vyk54LwG6gw965dFLWoIHowFo19rTqoHdbxhaQezJlMMBgTEYhNni51sJnMWCcPHIKtCg4GRY-pGMmrXarNIxxGQA';
      
      const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'minimax-m3',
          messages: [
            { role: 'system', content: 'You are the openGym Coach. Answer only the supplied task and return exactly the requested JSON.' },
            { role: 'user', content: prompt }
          ]
        }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const err = await res.text();
        return { code: 1, text: '', stderr: `HTTP ${res.status}: ${err}`, timedOut: false, spawnError: false };
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || '';
      
      return { code: 0, text, stderr: '', timedOut: false, spawnError: false };
    } catch (e) {
      if (timedOut) return { code: -1, text: '', stderr: 'Minimax API timed out', timedOut: true, spawnError: false };
      return { code: -1, text: '', stderr: String(e), timedOut: false, spawnError: true };
    } finally {
      clearTimeout(timer);
    }
  }
};
