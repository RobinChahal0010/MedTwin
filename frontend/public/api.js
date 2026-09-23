/**
 * MedTwin Client API helper (standalone bundle fallback)
 */
window.API = window.API || {
  async chatStream(params, onEvent, onError, onComplete) {
    const baseUrl = (window.__API_BASE_URL__ || 'https://medtwin-ajhpaxgsbchtdkaz.koreacentral-01.azurewebsites.net').replace(/\/$/, '');
    try {
      const res = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`Backend error (${res.status}) at ${baseUrl}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const raw = trimmed.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              onEvent(JSON.parse(raw));
            } catch (e) {}
          }
        }
      }
      if (onComplete) onComplete();
    } catch (err) {
      if (onError) onError(err);
      throw err;
    }
  }
};
