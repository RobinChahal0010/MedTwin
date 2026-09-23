import { initNavbar, enforceAuthGuard, getSessionUserId, getUserLanguage, setUserLanguage, apiUrl } from '../common';
import { API } from '../api';

enforceAuthGuard('chat');
initNavbar('chat');

const userId = getSessionUserId() || 'usr_demo_patient';

// UI Elements: Chat Container
const msgsEl = document.getElementById('msgs') as HTMLDivElement | null;
const formEl = document.getElementById('chat-form') as HTMLFormElement | null;
const questionInput = document.getElementById('question-input') as HTMLInputElement | null;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement | null;
const styleToggleBtn = document.getElementById('style-toggle-btn') as HTMLButtonElement | null;
const suggestionChips = document.querySelectorAll('.suggestion-chip');

// UI Elements: Voice Container
const micBtn = document.getElementById('mic-btn') as HTMLButtonElement | null;
const chatLangSelect = document.getElementById('chat-lang-select') as HTMLSelectElement | null;
const voiceStatusDot = document.getElementById('voice-status-dot');
const voiceStatusTitle = document.getElementById('voice-status-title');
const voiceStatusDesc = document.getElementById('voice-status-desc');
const voiceWaveform = document.getElementById('voice-waveform');
const voiceLiveBadge = document.getElementById('voice-live-badge');
const voiceTranscriptText = document.getElementById('voice-transcript-text');
const voiceSendBtn = document.getElementById('voice-send-btn');
const voiceClearBtn = document.getElementById('voice-clear-btn');

// Chat State
let currentMode: 'patient' | 'clinician' = 'patient';
let currentChatLang: string = getUserLanguage() || 'en-IN';
let isGenerating = false;
let isRecording = false;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let lastTranscribedText = '';

// Initialize Language Selector dynamically from GET /languages
async function setupChatLanguageSelector() {
  if (!chatLangSelect) return;

  try {
    const langs = await API.getLanguages();
    if (langs && langs.length > 0) {
      chatLangSelect.innerHTML = '';
      for (const item of langs) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.label;
        chatLangSelect.appendChild(opt);
      }
    }
  } catch (err) {
    console.warn('[MedTwin] Could not load chat languages from /languages:', err);
  }

  const savedLang = getUserLanguage() || 'en-IN';
  const baseCode = savedLang.slice(0, 2).toLowerCase();
  const matched = Array.from(chatLangSelect.options).find(
    (opt) =>
      opt.value.toLowerCase() === savedLang.toLowerCase() ||
      opt.value.toLowerCase().startsWith(baseCode)
  );

  if (matched) {
    chatLangSelect.value = matched.value;
    currentChatLang = matched.value;
  } else {
    chatLangSelect.value = 'en-IN';
    currentChatLang = 'en-IN';
  }

  chatLangSelect.addEventListener('change', () => {
    currentChatLang = chatLangSelect.value;
    const label = chatLangSelect.selectedOptions[0]?.textContent || undefined;
    setUserLanguage(currentChatLang, label);
  });
}

setupChatLanguageSelector();

// Append User Message to Chat Stream
function appendUserMessage(text: string) {
  if (!msgsEl) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = 'm u';
  msgDiv.textContent = text;
  msgsEl.appendChild(msgDiv);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

interface ChatSource {
  doc: string;
  sec?: string;
  text: string;
}

interface AssistantMessageHandle {
  messageEl: HTMLDivElement;
  contentEl: HTMLDivElement;
  footerEl: HTMLDivElement;
  appendToken: (token: string) => void;
  markCompleted: () => void;
  markEarlyExit: (reason: string) => void;
}

function createAssistantMessage(): AssistantMessageHandle {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'm a';

  const contentEl = document.createElement('div');
  contentEl.className = 'assistant-text';
  contentEl.innerHTML = '<span class="mute" style="font-size: 0.88rem;">Consulting 6-agent clinical reasoning pipeline...</span>';

  const footerEl = document.createElement('div');
  footerEl.className = 'assistant-meta';
  footerEl.style.marginTop = '8px';

  msgDiv.appendChild(contentEl);
  msgDiv.appendChild(footerEl);

  if (msgsEl) {
    msgsEl.appendChild(msgDiv);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  let fullText = '';
  let isFirstToken = true;

  return {
    messageEl: msgDiv,
    contentEl,
    footerEl,
    appendToken: (token: string) => {
      if (isFirstToken) {
        contentEl.innerHTML = '';
        isFirstToken = false;
      }
      fullText += token;
      contentEl.innerHTML = renderMarkdownSimple(fullText);
      if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
    },
    markCompleted: () => {
      if (isFirstToken) {
        contentEl.innerHTML = renderMarkdownSimple(fullText);
      }
    },
    markEarlyExit: (reason: string) => {
      contentEl.innerHTML = `<span style="color: var(--danger); font-weight: 500;">Scope Notice: ${reason}</span>`;
    },
  };
}

// Minimal markdown helper
function renderMarkdownSimple(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const formatted = escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.*)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
    .replace(/\n\n/g, '<br/><br/>');

  return formatted;
}

// Submit Question to Multi-Agent Stream
async function submitQuestion(questionText: string) {
  const trimmed = questionText.trim();
  if (!trimmed || isGenerating) return;

  isGenerating = true;
  if (sendBtn) sendBtn.disabled = true;
  if (questionInput) questionInput.value = '';

  appendUserMessage(trimmed);

  const { contentEl, footerEl, appendToken, markCompleted, markEarlyExit } = createAssistantMessage();

  let accumulatedText = '';
  let sources: ChatSource[] = [];
  let confidence: number | undefined;

  try {
    const res = await fetch(apiUrl('/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        question: trimmed,
        mode: currentMode,
        lang: currentChatLang,
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    if (!res.body) {
      throw new Error('ReadableStream not supported on this response');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            continue;
          }

          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'token' && typeof data.token === 'string') {
              accumulatedText += data.token;
              appendToken(data.token);
            } else if (data.type === 'content' && typeof data.text === 'string') {
              accumulatedText = data.text;
              contentEl.innerHTML = renderMarkdownSimple(data.text);
            } else if (data.type === 'result') {
              if (typeof data.answer === 'string' && data.answer.trim()) {
                accumulatedText = data.answer;
                contentEl.innerHTML = renderMarkdownSimple(data.answer);
              }
              if (Array.isArray(data.sources)) {
                sources = data.sources;
              }
              if (typeof data.confidence === 'number' && Number.isFinite(data.confidence)) {
                confidence = data.confidence;
              }
            }
          } catch (parseErr) {
            console.warn('[MedTwin] SSE JSON parse note:', parseErr);
          }
        }
      }
    }

    try {
      const safeAnswer = (typeof accumulatedText === 'string' && accumulatedText.trim())
        ? accumulatedText
        : 'No answer returned from the clinical reasoning pipeline.';

      if (!contentEl.innerHTML || contentEl.innerHTML.trim() === '' || contentEl.innerHTML === '<span class="mute" style="font-size: 0.88rem;">Consulting 6-agent clinical reasoning pipeline...</span>') {
        contentEl.innerHTML = renderMarkdownSimple(safeAnswer);
      }

      markCompleted();

      // Render metadata, sources accordion, and optional read aloud button
      let metaHtml = '';
      if (Array.isArray(sources) && sources.length > 0) {
        const sourceListHtml = sources
          .map((s) => {
            const doc = s && typeof s.doc === 'string' ? s.doc : 'Clinical source';
            const sec = s && typeof s.sec === 'string' ? s.sec : '';
            const text = s && typeof s.text === 'string' ? s.text : '';
            return `
              <div style="font-size: 0.8rem; margin-top: 4px; padding: 4px 8px; background: rgba(0,0,0,0.04); border-radius: 6px;">
                <b>${doc}</b> ${sec ? `(${sec})` : ''}: <span>${text}</span>
              </div>
            `;
          })
          .join('');

        metaHtml += `
          <details style="margin-top: 10px; font-size: 0.84rem; cursor: pointer;">
            <summary style="font-weight: 600; color: var(--forest);">Verified Clinical Guidelines (${sources.length})</summary>
            <div style="margin-top: 6px;">${sourceListHtml}</div>
          </details>
        `;
      }

      if (typeof confidence === 'number' && Number.isFinite(confidence)) {
        const confPct = Math.round(confidence * 100);
        metaHtml += `
          <div style="margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 3px;">
              <span class="mute">Evidence Grounding</span>
              <span style="font-weight: 600; color: var(--forest);">${confPct}%</span>
            </div>
            <div class="bar">
              <i style="width: ${confPct}%;"></i>
            </div>
          </div>
        `;
      }

      footerEl.innerHTML = metaHtml;
    } catch (renderErr: any) {
      console.error('[MedTwin] Chat bubble render failed:', renderErr);
      contentEl.innerHTML = `<span style="color: var(--danger); font-weight: 500;">Unable to render this response. Please try again.</span>`;
      footerEl.innerHTML = '';
    }
  } catch (err: any) {
    markEarlyExit(err.message || 'Stream connection failed');
    contentEl.innerHTML = `<span style="color: var(--danger);">Error contacting multi-agent pipeline: ${err.message || 'Stream connection failed'}</span>`;
  } finally {
    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}

// Audio Recording via POST /speech/transcribe
async function startAudioRecording() {
  if (isRecording) {
    stopAudioRecording();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('[MedTwin] navigator.mediaDevices not supported');
    simulateSpeechFallback();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      setVoiceUIState('transcribing');

      try {
        const fd = new FormData();
        fd.append('file', audioBlob, 'mic_recording.webm');
        fd.append('lang', currentChatLang);

        const res = await fetch(`/speech/transcribe?lang=${encodeURIComponent(currentChatLang)}`, {
          method: 'POST',
          body: fd,
        });

        const data = await res.json();
        if (data.text) {
          handleTranscribedText(data.text);
        } else {
          setVoiceUIState('ready');
        }
      } catch (err) {
        console.warn('[MedTwin] Transcribe endpoint error:', err);
        setVoiceUIState('ready');
      } finally {
        isRecording = false;
      }
    };

    mediaRecorder.start();
    isRecording = true;
    setVoiceUIState('listening');
  } catch (err) {
    console.warn('[MedTwin] Microphone permission notice, using simulated speech:', err);
    simulateSpeechFallback();
  }
}

function stopAudioRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// Fallback when browser blocks mic in iframe
async function simulateSpeechFallback() {
  setVoiceUIState('transcribing');
  try {
    const res = await fetch(`/speech/transcribe?lang=${encodeURIComponent(currentChatLang)}`, {
      method: 'POST',
    });
    const data = await res.json();
    if (data.text) {
      handleTranscribedText(data.text);
    } else {
      setVoiceUIState('ready');
    }
  } catch (e) {
    console.warn('Fallback error:', e);
    setVoiceUIState('ready');
  }
}

function handleTranscribedText(text: string) {
  lastTranscribedText = text;
  if (voiceTranscriptText) {
    voiceTranscriptText.textContent = `"${text}"`;
  }
  if (questionInput) {
    questionInput.value = text;
  }
  if (voiceSendBtn) {
    voiceSendBtn.style.display = 'inline-flex';
  }
  if (voiceClearBtn) {
    voiceClearBtn.style.display = 'inline-flex';
  }
  setVoiceUIState('has_transcript');
}

function setVoiceUIState(state: 'ready' | 'listening' | 'transcribing' | 'has_transcript') {
  if (state === 'listening') {
    micBtn?.classList.add('recording');
    voiceStatusDot?.classList.add('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Listening to your voice...';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Speak your question. Tap the red mic again when done.';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Listening';
    voiceWaveform?.classList.add('animating');
  } else if (state === 'transcribing') {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Transcribing Speech...';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Running speech-to-text recognition...';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Transcribing';
    voiceWaveform?.classList.add('animating');
  } else if (state === 'has_transcript') {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Speech Captured';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Click "Ask MedTwin" to submit, or tap the mic again to re-record.';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Captured';
    voiceWaveform?.classList.remove('animating');
  } else {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Tap Mic to Speak';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Speak your health question or scenario inquiry in your preferred language.';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Ready';
    voiceWaveform?.classList.remove('animating');
  }
}

// Wire Event Listeners
formEl?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (questionInput) {
    submitQuestion(questionInput.value);
  }
});

micBtn?.addEventListener('click', () => {
  startAudioRecording();
});

voiceSendBtn?.addEventListener('click', () => {
  if (lastTranscribedText) {
    submitQuestion(lastTranscribedText);
    lastTranscribedText = '';
    if (voiceTranscriptText) {
      voiceTranscriptText.textContent = 'Question sent to MedTwin AI. Tap the mic to ask another query.';
    }
    if (voiceSendBtn) voiceSendBtn.style.display = 'none';
    if (voiceClearBtn) voiceClearBtn.style.display = 'none';
    setVoiceUIState('ready');
  }
});

voiceClearBtn?.addEventListener('click', () => {
  lastTranscribedText = '';
  if (voiceTranscriptText) {
    voiceTranscriptText.textContent = 'Tap the microphone above to start. Your speech will be recognized and transcribed.';
  }
  if (questionInput && questionInput.value === lastTranscribedText) {
    questionInput.value = '';
  }
  if (voiceSendBtn) voiceSendBtn.style.display = 'none';
  if (voiceClearBtn) voiceClearBtn.style.display = 'none';
  setVoiceUIState('ready');
});

// Style toggle: patient <-> clinician
styleToggleBtn?.addEventListener('click', () => {
  currentMode = currentMode === 'patient' ? 'clinician' : 'patient';
  if (styleToggleBtn) {
    styleToggleBtn.textContent =
      currentMode === 'patient' ? 'Style: Patient (Simple)' : 'Style: Clinician (Doctor)';
  }
});

// Suggestion chips
suggestionChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const text = (chip as HTMLElement).dataset.question || chip.textContent || '';
    if (questionInput) questionInput.value = text;
    submitQuestion(text);
  });
});
