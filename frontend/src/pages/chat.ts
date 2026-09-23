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
const voiceStopBtn = document.getElementById('voice-stop-btn') as HTMLButtonElement | null;

// Chat State
let currentMode: 'patient' | 'clinician' = 'patient';
let currentChatLang: string = getUserLanguage() || 'en-IN';
let isGenerating = false;
let isRecording = false;
let isSpeaking = false;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let lastTranscribedText = '';
let recordingStartTime = 0;
let lastMicLang = 'en-IN';   // lang used for the most recent mic recording
let ttsAudioEl: HTMLAudioElement | null = null;  // current TTS <audio> element

/**
 * Clean PDF hyphenation artifacts (e.g. "car-\niovascular" -> "cardiovascular")
 * and normalise whitespace.
 */
function cleanPdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/([a-zA-Z]+)-\s*\r?\n\s*([a-zA-Z]+)/g, '$1$2')  // re-join hyphenated words
    .replace(/\r?\n+/g, ' ')                                   // flatten newlines
    .replace(/\s{2,}/g, ' ')                                   // collapse spaces
    .trim();
}

/**
 * Encode Float32 audio samples to 16 kHz mono 16-bit PCM WAV.
 * This runs entirely in the browser — no server-side ffmpeg needed.
 */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

/**
 * Convert any MediaRecorder Blob to a 16 kHz mono 16-bit PCM WAV Blob
 * using the browser's AudioContext. No server-side transcoding needed.
 */
async function convertAudioBlobTo16kPcmWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.round(decodedBuffer.duration * targetSampleRate));
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const resampledBuffer = await offlineCtx.startRendering();
  const channelData = resampledBuffer.getChannelData(0);
  const wavBuffer = encodeWAV(channelData, targetSampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

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
  setResultContent: (html: string) => void;
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
  let resultHasSetContent = false;  // true once a 'result' event has written innerHTML

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
      // Only write innerHTML here if neither tokens nor a result event have written it
      if (isFirstToken && !resultHasSetContent) {
        contentEl.innerHTML = renderMarkdownSimple(fullText);
      }
    },
    setResultContent: (html: string) => {
      contentEl.innerHTML = html;
      resultHasSetContent = true;
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
// fromMic=true: triggers TTS reply after the answer arrives
async function submitQuestion(questionText: string, fromMic = false) {
  const trimmed = questionText.trim();
  if (!trimmed || isGenerating) return;

  isGenerating = true;
  if (sendBtn) sendBtn.disabled = true;
  if (questionInput) questionInput.value = '';

  appendUserMessage(trimmed);

  const { contentEl, footerEl, appendToken, markCompleted, setResultContent, markEarlyExit } = createAssistantMessage();

  let accumulatedText = '';
  let sources: ChatSource[] = [];
  let confidence: number | undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(apiUrl('/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
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
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() || '';

      for (const chunk of chunks) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data:')) {
            const jsonStr = trimmedLine.replace(/^data:\s*/, '').trim();
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
                setResultContent(renderMarkdownSimple(data.text));
              } else if (data.type === 'result') {
                // Always use answer if present; fall back to a visible message
                const answer = (typeof data.answer === 'string' && data.answer.trim())
                  ? data.answer
                  : 'No answer returned from the clinical reasoning pipeline.';
                accumulatedText = answer;
                setResultContent(renderMarkdownSimple(answer));
              }
            } catch (parseErr) {
              console.warn('[MedTwin] SSE JSON parse note:', parseErr);
            }
          }
        }
      }
    }

    try {
      const safeAnswer = accumulatedText.trim()
        ? accumulatedText
        : 'No answer returned from the clinical reasoning pipeline.';

      markCompleted(); // only writes if no result/token set the content
      footerEl.innerHTML = '';

      // Voice reply for mic-initiated messages
      if (fromMic) {
        speakAnswer(safeAnswer, lastMicLang);
      }
    } catch (renderErr: any) {
      console.error('[MedTwin] Chat bubble render failed:', renderErr);
      contentEl.innerHTML = `<span style="color: var(--danger); font-weight: 500;">Unable to render this response. Please try again.</span>`;
      footerEl.innerHTML = '';
    }
  } catch (err: any) {
    const errMsg = err?.name === 'AbortError'
      ? 'The clinical reasoning pipeline timed out after 120 seconds. Please try asking a more focused question.'
      : (err.message || 'Stream connection failed');
    markEarlyExit(errMsg);
    contentEl.innerHTML = `<span style="color: var(--danger);">Error contacting multi-agent pipeline: ${errMsg}</span>`;
  } finally {
    clearTimeout(timeoutId);
    isGenerating = false;
    if (sendBtn) sendBtn.disabled = false;
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
    if (fromMic) setVoiceUIState('ready');
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
      const rawBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      // ── Minimum duration guard (< 1 s) ─────────────────────────────────
      const durationMs = Date.now() - recordingStartTime;
      if (durationMs < 1000) {
        setVoiceUIState('ready');
        if (voiceStatusDesc) {
          voiceStatusDesc.textContent = 'Recording was too short. Please speak for at least 1 second.';
        }
        isRecording = false;
        return;
      }

      setVoiceUIState('transcribing');

      try {
        // ── Convert WebM Opus -> 16 kHz mono 16-bit PCM WAV in the browser ─
        let wavBlob: Blob;
        try {
          wavBlob = await convertAudioBlobTo16kPcmWav(rawBlob);
        } catch (convErr: any) {
          console.warn('[MedTwin] WAV conversion failed, uploading raw WebM:', convErr);
          wavBlob = rawBlob; // fall back to raw — server will try REST API
        }

        const fd = new FormData();
        fd.append('file', wavBlob, 'mic_recording.wav');
        fd.append('lang', currentChatLang);

        const transcribeUrl = `${apiUrl('/speech/transcribe')}?lang=${encodeURIComponent(currentChatLang)}`;
        const res = await fetch(transcribeUrl, {
          method: 'POST',
          body: fd,
        });

        // Parse JSON whether ok or not (backend returns detail on 422/502)
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const reason = data?.detail || `Speech transcription failed (HTTP ${res.status})`;
          throw new Error(reason);
        }

        if (data?.text) {
          handleTranscribedText(data.text);
        } else {
          setVoiceUIState('ready');
          if (voiceStatusDesc) {
            voiceStatusDesc.textContent = data?.error || 'No speech recognised — please try again and speak clearly.';
          }
        }
      } catch (err: any) {
        console.warn('[MedTwin] Transcribe endpoint error:', err);
        setVoiceUIState('ready');
        if (voiceStatusDesc) {
          voiceStatusDesc.textContent = err?.message || 'Speech transcription failed. Please try again.';
        }
      } finally {
        isRecording = false;
      }
    };

    mediaRecorder.start();
    isRecording = true;
    recordingStartTime = Date.now();
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

// Fallback when browser blocks mic
function simulateSpeechFallback() {
  setVoiceUIState('ready');
  if (voiceStatusDesc) {
    voiceStatusDesc.textContent = 'Microphone access is unavailable or was denied. Please allow microphone permissions or type your question below.';
  }
}

// ── TTS: strip markdown / citation markers before speaking ──────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')           // citation markers [1], [2]
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
    .replace(/\*(\S[^*]*)\*/g, '$1')   // *italic*
    .replace(/#{1,6}\s+/g, '')         // ## headings
    .replace(/`[^`]+`/g, '')           // `code`
    .replace(/\n{2,}/g, ' ')           // paragraph breaks -> space
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── TTS: call /speech/synthesize and play the WAV ────────────────────────────
async function speakAnswer(rawText: string, lang: string): Promise<void> {
  stopSpeaking(); // cancel any previous playback

  const text = stripMarkdown(rawText).slice(0, 1500);
  if (!text) return;

  setVoiceUIState('speaking');

  try {
    const res = await fetch(apiUrl('/speech/synthesize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.detail || `Synthesis HTTP ${res.status}`);
    }

    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Reuse/create a single Audio element. Creating it here (inside a fetch callback
    // that was triggered by a user gesture chain) avoids autoplay policy blocks.
    ttsAudioEl = new Audio(audioUrl);
    isSpeaking = true;
    if (voiceStopBtn) voiceStopBtn.style.display = 'inline-flex';

    ttsAudioEl.onended = () => {
      isSpeaking = false;
      URL.revokeObjectURL(audioUrl);
      if (voiceStopBtn) voiceStopBtn.style.display = 'none';
      setVoiceUIState('ready');
    };

    ttsAudioEl.onerror = () => {
      isSpeaking = false;
      URL.revokeObjectURL(audioUrl);
      if (voiceStopBtn) voiceStopBtn.style.display = 'none';
      setVoiceUIState('ready');
    };

    const playPromise = ttsAudioEl.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Autoplay blocked: show a tap-to-play fallback in the transcript box
        isSpeaking = false;
        if (voiceStopBtn) voiceStopBtn.style.display = 'none';
        setVoiceUIState('ready');
        if (voiceTranscriptText) {
          voiceTranscriptText.textContent = 'Tap to play spoken reply.';
          voiceTranscriptText.style.cursor = 'pointer';
          voiceTranscriptText.onclick = () => {
            ttsAudioEl?.play().catch(() => {});
            voiceTranscriptText!.style.cursor = '';
            voiceTranscriptText!.onclick = null;
          };
        }
      });
    }
  } catch (err: any) {
    console.warn('[MedTwin] TTS error:', err);
    isSpeaking = false;
    if (voiceStopBtn) voiceStopBtn.style.display = 'none';
    setVoiceUIState('ready');
    if (voiceStatusDesc) {
      voiceStatusDesc.textContent = `Voice reply failed: ${err?.message || 'unknown error'}`;
    }
  }
}

function stopSpeaking() {
  if (ttsAudioEl) {
    ttsAudioEl.pause();
    ttsAudioEl.src = '';
    ttsAudioEl = null;
  }
  isSpeaking = false;
  if (voiceStopBtn) voiceStopBtn.style.display = 'none';
}

// ── Voice UI state machine ────────────────────────────────────────────────────
function handleTranscribedText(text: string) {
  lastTranscribedText = text;
  lastMicLang = currentChatLang;

  if (voiceTranscriptText) {
    voiceTranscriptText.textContent = `"${text}"`;
    voiceTranscriptText.style.cursor = '';
    voiceTranscriptText.onclick = null;
  }

  // Auto-submit immediately — no confirm step for mic input
  setVoiceUIState('thinking');
  submitQuestion(text, /* fromMic */ true);
}

function setVoiceUIState(state: 'ready' | 'listening' | 'transcribing' | 'thinking' | 'speaking') {
  if (state === 'listening') {
    micBtn?.classList.add('recording');
    voiceStatusDot?.classList.add('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Listening...';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Speak your question. Tap the mic again when done.';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Listening';
    voiceWaveform?.classList.add('animating');
  } else if (state === 'transcribing') {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Transcribing...';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Converting speech to text…';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Transcribing';
    voiceWaveform?.classList.add('animating');
  } else if (state === 'thinking') {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Thinking...';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Clinical reasoning pipeline is running…';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Thinking';
    voiceWaveform?.classList.add('animating');
  } else if (state === 'speaking') {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Speaking reply...';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Tap "Stop Speaking" to interrupt.';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Speaking';
    voiceWaveform?.classList.add('animating');
  } else {
    micBtn?.classList.remove('recording');
    voiceStatusDot?.classList.remove('active');
    if (voiceStatusTitle) voiceStatusTitle.textContent = 'Tap Mic to Speak';
    if (voiceStatusDesc) voiceStatusDesc.textContent = 'Speak your question. The answer will be read aloud.';
    if (voiceLiveBadge) voiceLiveBadge.textContent = 'Ready';
    voiceWaveform?.classList.remove('animating');
  }
}

// ── Wire Event Listeners ──────────────────────────────────────────────────────
formEl?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (questionInput) {
    submitQuestion(questionInput.value, /* fromMic */ false);
  }
});

micBtn?.addEventListener('click', () => {
  // A mic tap is a user gesture — use it to unlock the Audio element for autoplay
  if (!ttsAudioEl) {
    ttsAudioEl = new Audio();
  }
  // If speaking, stop and return
  if (isSpeaking) {
    stopSpeaking();
    return;
  }
  startAudioRecording();
});

voiceStopBtn?.addEventListener('click', () => {
  stopSpeaking();
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
    submitQuestion(text, /* fromMic */ false);
  });
});

