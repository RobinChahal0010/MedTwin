import { initNavbar, enforceAuthGuard, getSessionUserId } from '../common';
import { API, ChatStreamEvent, ChatStreamSource } from '../api';

enforceAuthGuard('flow');
initNavbar('flow');

const userId = getSessionUserId() || '';
if (!userId) {
  window.location.replace('login.html');
}

// 6 Pipeline Agents in exact order
const AGENTS = ['scope', 'twin', 'knowledge', 'simulate', 'answer', 'verify'] as const;
type AgentId = (typeof AGENTS)[number];

const AGENT_CONNECTORS: Record<string, string> = {
  scope: 'line-scope-twin',
  twin: 'line-twin-knowledge',
  knowledge: 'line-knowledge-simulate',
  simulate: 'line-simulate-answer',
  answer: 'line-answer-verify',
};

// Elements
const modeToggleBtn = document.getElementById('flow-mode-toggle') as HTMLButtonElement | null;
const runBtn = document.getElementById('flow-run-btn') as HTMLButtonElement | null;
const statusPill = document.getElementById('flow-status-pill') as HTMLElement | null;
const errorBox = document.getElementById('flow-error') as HTMLElement | null;
const resultBox = document.getElementById('flow-result-box') as HTMLElement | null;
const resultContent = document.getElementById('flow-result-content') as HTMLElement | null;
const resultModeBadge = document.getElementById('flow-result-mode-badge') as HTMLElement | null;
const confidenceBadge = document.getElementById('flow-confidence-badge') as HTMLElement | null;
const sourcesContainer = document.getElementById('flow-sources-container') as HTMLElement | null;

// State
let currentMode: 'patient' | 'clinician' = 'patient';
let isRunning = false;
let lastRunningAgent: AgentId | null = null;
let accumulatedText = '';
let accumulatedSources: ChatStreamSource[] = [];
let accumulatedConfidence: number | undefined;

function formatMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[•\-]\s+(.*)$/gm, '<li style="margin-left: 20px; list-style-type: disc;">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

/**
 * RESET: Reset all 6 circles to idle state, clear connecting lines & outputs
 */
function resetFlowDiagram() {
  lastRunningAgent = null;
  accumulatedText = '';
  accumulatedSources = [];
  accumulatedConfidence = undefined;

  AGENTS.forEach((agent) => {
    const circle = document.getElementById(agent);
    const statusText = document.getElementById(`status-${agent}`);
    if (circle) {
      circle.className = 'flow-circle idle';
    }
    if (statusText) {
      statusText.textContent = 'Idle';
      statusText.className = 'flow-agent-status';
    }
  });

  // Reset all connecting lines
  Object.values(AGENT_CONNECTORS).forEach((lineId) => {
    const line = document.getElementById(lineId);
    if (line) {
      line.className = 'flow-connector';
    }
  });

  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  if (resultBox) {
    resultBox.style.display = 'none';
  }

  if (statusPill) {
    statusPill.textContent = 'System Ready';
    statusPill.className = 'badge';
  }
}

/**
 * STATE: Running - circle gets glowing/pulsing border
 */
function setAgentRunning(agent: AgentId, actionText?: string) {
  lastRunningAgent = agent;
  const circle = document.getElementById(agent);
  const statusText = document.getElementById(`status-${agent}`);

  if (circle) {
    circle.className = 'flow-circle running';
  }
  if (statusText) {
    statusText.textContent = actionText || 'Running...';
    statusText.className = 'flow-agent-status active';
  }
  if (statusPill) {
    statusPill.textContent = `Running: ${agent.toUpperCase()}`;
    statusPill.className = 'badge warn';
  }
}

/**
 * STATE: Done - glow stops, solid green border, line to NEXT circle highlighted/colored
 */
function setAgentDone(agent: AgentId, event: ChatStreamEvent) {
  const circle = document.getElementById(agent);
  const statusText = document.getElementById(`status-${agent}`);

  if (circle) {
    circle.className = 'flow-circle done';
  }

  // Highlight connecting line to the NEXT circle
  const lineId = AGENT_CONNECTORS[agent];
  if (lineId) {
    const line = document.getElementById(lineId);
    if (line) {
      line.className = 'flow-connector active';
    }
  }

  // Extract concise one-line status from the event payload
  let displayText = event.preview || 'Done';
  if (agent === 'scope') {
    if (event.on_topic === false) displayText = 'Out of scope';
    else if (event.on_topic === true) displayText = 'In scope — Type 2 Diabetes';
  } else if (agent === 'twin') {
    if (event.found && typeof event.risk === 'number') {
      displayText = `Loaded — risk ${event.risk}%`;
    }
  } else if (agent === 'knowledge') {
    if (typeof event.passages === 'number') {
      displayText = `${event.passages} passages found`;
    }
  } else if (agent === 'simulate') {
    if (event.projection) {
      displayText = `Projection: ${event.projection}`;
    }
  } else if (agent === 'answer') {
    if (event.draft_preview) {
      displayText = event.draft_preview;
    }
  } else if (agent === 'verify') {
    if (typeof event.confidence === 'number') {
      const conf = event.confidence <= 1 ? Math.round(event.confidence * 100) : event.confidence;
      displayText = `Confidence ${conf}%`;
    }
  }

  if (statusText) {
    statusText.textContent = displayText;
    statusText.className = 'flow-agent-status done';
    statusText.title = displayText;
  }
}

/**
 * STATE: Skipped - dimmed/grayed for all circles after early exit
 */
function markRemainingSkipped(fromAgent: AgentId) {
  const idx = AGENTS.indexOf(fromAgent);
  if (idx === -1) return;

  for (let i = idx + 1; i < AGENTS.length; i++) {
    const skipAgent = AGENTS[i];
    const circle = document.getElementById(skipAgent);
    const statusText = document.getElementById(`status-${skipAgent}`);

    if (circle) {
      circle.className = 'flow-circle skipped';
    }
    if (statusText) {
      statusText.textContent = 'Skipped';
      statusText.className = 'flow-agent-status skipped';
    }

    const lineId = AGENT_CONNECTORS[skipAgent];
    if (lineId) {
      const line = document.getElementById(lineId);
      if (line) {
        line.className = 'flow-connector skipped';
      }
    }
  }

  if (statusPill) {
    statusPill.textContent = 'Early Exit (Scope Boundary)';
    statusPill.className = 'badge warn';
  }
}

/**
 * STATE: Error - last running circle turns red/error-colored, error message shown
 */
function handleStreamError(err: Error) {
  if (lastRunningAgent) {
    const circle = document.getElementById(lastRunningAgent);
    const statusText = document.getElementById(`status-${lastRunningAgent}`);
    if (circle) {
      circle.className = 'flow-circle error';
    }
    if (statusText) {
      statusText.textContent = 'Failed';
      statusText.className = 'flow-agent-status error';
    }
  }

  if (errorBox) {
    errorBox.style.display = 'block';
    errorBox.textContent = err.message || `Could not reach the backend at ${window.location.origin}`;
  }

  if (statusPill) {
    statusPill.textContent = 'Stream Error';
    statusPill.className = 'badge warn';
  }
}

/**
 * Render Final Synthesized Answer Box below diagram
 */
function showResultBox() {
  if (!resultBox) return;

  if (resultModeBadge) {
    resultModeBadge.textContent = currentMode === 'patient' ? 'Patient Mode' : 'Clinician Mode';
  }

  if (confidenceBadge) {
    if (typeof accumulatedConfidence === 'number') {
      const pct = accumulatedConfidence <= 1 ? Math.round(accumulatedConfidence * 100) : accumulatedConfidence;
      confidenceBadge.textContent = `Confidence: ${pct}%`;
      confidenceBadge.style.display = 'inline-block';
    } else {
      confidenceBadge.style.display = 'none';
    }
  }

  if (resultContent) {
    resultContent.innerHTML = formatMarkdown(accumulatedText);
  }

  if (sourcesContainer) {
    if (accumulatedSources && accumulatedSources.length > 0) {
      const itemsHtml = accumulatedSources
        .map(
          (s) => `
          <div class="source-item" style="margin-top: 6px; padding: 8px 12px; background: var(--input-bg); border-radius: 8px; border: 1px solid var(--border);">
            <b>${s.doc}</b> ${s.sec ? `(${s.sec})` : ''}: <span>${s.text}</span>
          </div>
        `
        )
        .join('');
      sourcesContainer.innerHTML = `
        <details open>
          <summary style="cursor: pointer; font-weight: 600; font-size: 0.88rem; color: var(--forest);">
            Retrieved Clinical Guidelines (${accumulatedSources.length})
          </summary>
          <div style="margin-top: 8px;">${itemsHtml}</div>
        </details>
      `;
      sourcesContainer.style.display = 'block';
    } else {
      sourcesContainer.style.display = 'none';
    }
  }

  resultBox.style.display = 'block';
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Main Run Handler: Driven entirely by actual SSE events from POST /chat/stream
 */
async function runFlow(question: string) {
  if (!question.trim() || isRunning) return;

  isRunning = true;
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Executing...';
  }

  // RESET diagram before each new run
  resetFlowDiagram();

  try {
    // Reuses the existing API.chatStream() function from api.ts
    await API.chatStream(
      {
        user_id: userId,
        question: question.trim(),
        mode: currentMode,
      },
      (event: ChatStreamEvent) => {
        // Event type: "start"
        if (event.type === 'start' && event.agent && AGENTS.includes(event.agent as AgentId)) {
          setAgentRunning(event.agent as AgentId, event.action);
        }

        // Event type: "done"
        if (event.type === 'done' && event.agent && AGENTS.includes(event.agent as AgentId)) {
          setAgentDone(event.agent as AgentId, event);

          // Early exit condition
          if (event.exit_early) {
            markRemainingSkipped(event.agent as AgentId);
          }
        }

        // Event type: "result"
        if (event.type === 'result') {
          if (event.text) accumulatedText = event.text;
          if (event.sources) accumulatedSources = event.sources;
          if (typeof event.confidence === 'number') accumulatedConfidence = event.confidence;

          // If result arrived early before reaching the last agent ("verify")
          if (event.agent && event.agent !== 'verify') {
            markRemainingSkipped(event.agent as AgentId);
          }
          showResultBox();
        }

        // Fallback for content events
        if (event.type === 'content') {
          if (event.text) accumulatedText = event.text;
          if (event.sources) accumulatedSources = event.sources;
          if (typeof event.confidence === 'number') accumulatedConfidence = event.confidence;
          showResultBox();
        }
      },
      (err: Error) => {
        handleStreamError(err);
      },
      () => {
        // onComplete
        if (statusPill && !statusPill.textContent?.includes('Error') && !statusPill.textContent?.includes('Early')) {
          statusPill.textContent = 'Chain Complete (6/6)';
          statusPill.className = 'badge ok';
        }
        if (accumulatedText) {
          showResultBox();
        }
      }
    );
  } catch (err: any) {
    handleStreamError(err);
  } finally {
    isRunning = false;
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = 'Test Endpoints';
    }
  }
}

// Wire test endpoints button
runBtn?.addEventListener('click', () => {
  runFlow('Verify pipeline reasoning and clinical biomarker endpoints');
});

// Mode Toggle
modeToggleBtn?.addEventListener('click', () => {
  currentMode = currentMode === 'patient' ? 'clinician' : 'patient';
  if (modeToggleBtn) {
    modeToggleBtn.textContent = currentMode === 'patient' ? 'Mode: Patient' : 'Mode: Clinician';
    modeToggleBtn.classList.toggle('on', currentMode === 'clinician');
  }
});
