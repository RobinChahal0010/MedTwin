/**
  * MedTwin Shared API Client
  * Centralizes SSE streaming and data fetching for the agent reasoning pipeline.
  */

import { apiUrl } from './common';

export interface ChatStreamParams {
  user_id: string;
  question: string;
  mode: 'patient' | 'clinician';
}

export interface ChatStreamSource {
  doc: string;
  sec?: string;
  text: string;
}

export interface ChatStreamEvent {
  type: 'start' | 'done' | 'result' | 'content';
  agent?: 'scope' | 'twin' | 'knowledge' | 'simulate' | 'answer' | 'verify' | string;
  action?: string;
  preview?: string;
  text?: string;
  exit_early?: boolean;
  on_topic?: boolean;
  found?: boolean;
  risk?: number;
  passages?: number;
  titles?: string[];
  ran?: boolean;
  projection?: string;
  draft_preview?: string;
  confidence?: number;
  sources?: ChatStreamSource[];
}

export interface LanguageOption {
  code: string;
  label: string;
}

export const API = {
  /**
   * Fetch canonical Indian regional languages from GET /languages
   */
  async getLanguages(): Promise<LanguageOption[]> {
    try {
      const res = await fetch(apiUrl('/languages'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.languages)) return data.languages;
      }
    } catch (e) {
      console.warn('[MedTwin API] Could not fetch languages from /languages:', e);
    }
    return [
      { code: 'en-IN', label: 'English (India)' },
      { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
      { code: 'bn-IN', label: 'বাংলা (Bengali)' },
      { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
      { code: 'te-IN', label: 'తెలుగు (Telugu)' },
      { code: 'mr-IN', label: 'मराठी (Marathi)' },
      { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)' },
      { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
      { code: 'ml-IN', label: 'മലയാളം (Malayalam)' },
      { code: 'pa-IN', label: 'ਪੰਜਾਬੀ (Punjabi)' },
      { code: 'ur-IN', label: 'اردو (Urdu)' },
    ];
  },

  /**
   * Stream agent reasoning pipeline events from POST /chat/stream
   */
  async chatStream(
    params: ChatStreamParams,
    onEvent: (event: ChatStreamEvent) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void
  ): Promise<void> {
    const baseUrl = apiUrl('');
    let res: Response;

    try {
      res = await fetch(apiUrl('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          user_id: params.user_id,
          question: params.question,
          mode: params.mode,
        }),
      });
    } catch (netErr: any) {
      const err = new Error(`Could not reach the backend at ${baseUrl} (${netErr.message || 'Network error'})`);
      if (onError) onError(err);
      throw err;
    }

    if (!res.ok) {
      const err = new Error(`Backend error (${res.status}): Could not reach the backend at ${baseUrl}`);
      if (onError) onError(err);
      throw err;
    }

    if (!res.body) {
      const err = new Error(`No readable SSE stream from ${baseUrl}`);
      if (onError) onError(err);
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            try {
              const eventData: ChatStreamEvent = JSON.parse(payload);
              onEvent(eventData);
            } catch (pErr) {
              console.warn('[MedTwin API] Warning parsing SSE data:', pErr, payload);
            }
          }
        }
      }

      if (onComplete) {
        onComplete();
      }
    } catch (streamErr: any) {
      const err = new Error(`Stream interrupted from ${baseUrl}: ${streamErr.message || 'Stream error'}`);
      if (onError) onError(err);
      throw err;
    }
  },

  /**
   * Save user language preference
   */
  async setUserLanguage(userId: string, language: string): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/user/language'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, language }),
      });
      return res.ok;
    } catch (e) {
      console.warn('[MedTwin API] Could not save language to backend:', e);
      return false;
    }
  },
};

// Also attach to window for any script referencing window.API
if (typeof window !== 'undefined') {
  (window as any).API = API;
}
