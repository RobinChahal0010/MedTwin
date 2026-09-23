import { initNavbar, enforceAuthGuard, getSessionUserId, apiUrl } from '../common';

enforceAuthGuard('twin');
initNavbar('twin');

const userId = getSessionUserId() || '';

const riskNumberEl = document.getElementById('risk-percent-number') as HTMLElement | null;
const riskArcEl = document.getElementById('risk-gauge-arc') as SVGPathElement | SVGCircleElement | null;
const valuesGridEl = document.getElementById('values-grid') as HTMLDivElement | null;
const loadingStateEl = document.getElementById('loading-state') as HTMLDivElement | null;
const dashboardContentEl = document.getElementById('dashboard-content') as HTMLDivElement | null;
const errorStateEl = document.getElementById('error-state') as HTMLDivElement | null;
const errorMessageEl = document.getElementById('error-message') as HTMLParagraphElement | null;

interface TwinLabel {
  status: 'at_goal' | 'needs_attention' | string;
  note?: string;
  source?: string;
}

interface TwinResponse {
  risk_poor_control: number;
  values: Record<string, number | string>;
  labels?: Record<string, TwinLabel>;
  percentiles?: Record<string, number>;
  error?: string;
}

const FIELD_CONFIG: Record<string, { label: string; unit: string; fallbackGoal: string }> = {
  hba1c: { label: 'Sugar, 3-Mo Average (HbA1c)', unit: '%', fallbackGoal: 'General target < 7.0%' },
  sbp: { label: 'Blood Pressure, Systolic (SBP)', unit: 'mmHg', fallbackGoal: 'Target individualized by risk (<130)' },
  dbp: { label: 'Blood Pressure, Diastolic (DBP)', unit: 'mmHg', fallbackGoal: 'Target individualized by risk (<80)' },
  bmi: { label: 'Body Mass Index (BMI)', unit: 'kg/m²', fallbackGoal: 'Healthy range 18.5 – 24.9' },
  total_chol: { label: 'Total Cholesterol', unit: 'mg/dL', fallbackGoal: 'Desirable < 200 mg/dL' },
  hdl: { label: 'HDL "Good" Cholesterol', unit: 'mg/dL', fallbackGoal: 'Protective > 40–50 mg/dL' },
  creatinine: { label: 'Serum Creatinine (Kidney)', unit: 'mg/dL', fallbackGoal: 'Typical baseline 0.6 – 1.2 mg/dL' },
  age: { label: 'Patient Age', unit: 'years', fallbackGoal: 'Reference baseline' },
  sex: { label: 'Biological Sex', unit: '', fallbackGoal: '1 = Male, 2 = Female' },
  insulin: { label: 'Insulin Regimen', unit: '', fallbackGoal: '0 = No, 1 = Yes' },
};

function animateNumber(el: HTMLElement, target: number, durationMs = 1200) {
  const start = 0;
  const startTime = performance.now();
  function update(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * ease);
    el.textContent = current.toString();
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

function renderTwin(twin: TwinResponse) {
  if (loadingStateEl) loadingStateEl.style.display = 'none';
  if (errorStateEl) errorStateEl.style.display = 'none';
  if (dashboardContentEl) dashboardContentEl.style.display = 'block';

  // 1. risk_poor_control (0-1, show as %)
  const riskFloat = typeof twin.risk_poor_control === 'number' ? twin.risk_poor_control : 0.5;
  const riskPct = Math.round(riskFloat * 100);

  if (riskNumberEl) {
    animateNumber(riskNumberEl, riskPct);
  }

  if (riskArcEl) {
    // Circle perimeter with r=52 is 2 * pi * 52 ≈ 326.7
    const circumference = 327;
    const offset = circumference * (1 - riskPct / 100);
    setTimeout(() => {
      riskArcEl.style.strokeDashoffset = offset.toString();
    }, 150);
  }

  // 2. one card per field in values
  if (valuesGridEl && twin.values) {
    valuesGridEl.innerHTML = '';
    const entries = Object.entries(twin.values);

    // Prefer standard ordering
    const order = ['hba1c', 'sbp', 'dbp', 'bmi', 'total_chol', 'hdl', 'creatinine', 'age', 'sex', 'insulin'];
    entries.sort((a, b) => {
      const idxA = order.indexOf(a[0]);
      const idxB = order.indexOf(b[0]);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    for (const [field, rawVal] of entries) {
      const meta = FIELD_CONFIG[field] || {
        label: field.toUpperCase().replace('_', ' '),
        unit: '',
        fallbackGoal: 'Guideline reference',
      };

      // Status badge from labels[field].status (at_goal / needs_attention)
      const labelObj = twin.labels?.[field];
      const status = labelObj?.status || 'at_goal';
      const isAtGoal = status === 'at_goal' || status === 'ok';

      // Percentile bar per field from percentiles[field]
      const pct = twin.percentiles?.[field] ?? 50;

      let displayValue = rawVal;
      if (field === 'sex') {
        displayValue = rawVal === 1 || rawVal === '1' ? 'Male' : 'Female';
      } else if (field === 'insulin') {
        displayValue = rawVal === 1 || rawVal === '1' ? 'Active' : 'None';
      }

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="row" style="justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <span class="mute" style="font-size: 0.92rem; font-weight: 600;">${meta.label}</span>
          <span class="badge ${isAtGoal ? 'ok' : 'warn'}">
            ${isAtGoal ? 'At Goal' : 'Needs Attention'}
          </span>
        </div>
        
        <div class="big" style="font-size: 2.1rem; margin: 4px 0 8px;">
          ${displayValue}
          <small class="mute" style="font-size: 0.95rem; font-family: 'Instrument Sans', sans-serif; font-weight: 500;">
            ${meta.unit}
          </small>
        </div>

        <p class="mute" style="font-size: 0.88rem; line-height: 1.45; margin-bottom: 12px;">
          ${labelObj?.note || meta.fallbackGoal}
          ${labelObj?.source ? `<br><span style="font-size: 0.8rem; opacity: 0.85;">Source: <i>${labelObj.source}</i></span>` : ''}
        </p>

        <!-- Percentile Bar -->
        <div style="margin-top: auto;">
          <div class="row" style="justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span class="mute">Cohort Distribution</span>
            <span style="font-weight: 600; color: var(--g2);">${pct}th percentile</span>
          </div>
          <div class="bar ${isAtGoal ? '' : 'warn'}">
            <i data-width="${pct}" style="width: 0%;"></i>
          </div>
          <span class="mute" style="font-size: 0.78rem; display: block; margin-top: 4px;">
            Higher than ${pct}% of sampled peer cohort
          </span>
        </div>
      `;

      valuesGridEl.appendChild(card);
    }

    // Trigger bar animations
    setTimeout(() => {
      document.querySelectorAll('.bar i').forEach((bar) => {
        const targetW = (bar as HTMLElement).dataset.width || '50';
        (bar as HTMLElement).style.width = `${targetW}%`;
      });
    }, 200);
  }
}

// Fetch twin data: Endpoint GET /twin/{user_id}
async function loadTwin() {
  if (!userId) {
    window.location.href = 'login.html';
    return;
  }

  // Check cached twin from upload session
  const cachedTwinRaw = sessionStorage.getItem('twin');
  if (cachedTwinRaw) {
    try {
      const cached = JSON.parse(cachedTwinRaw);
      if (cached && cached.values && !cached.error) {
        renderTwin(cached);
        // Continue to fetch fresh in background
      }
    } catch (e) {
      // Ignore parse error and proceed to network fetch
    }
  }

  try {
    const res = await fetch(apiUrl(`/twin/${encodeURIComponent(userId)}`), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      // If no twin found yet, guide user
      if (loadingStateEl) loadingStateEl.style.display = 'none';
      if (errorStateEl) {
        errorStateEl.style.display = 'block';
        if (errorMessageEl) {
          errorMessageEl.textContent =
            data?.error || (res.status === 404 ? 'No digital twin found for your account yet. Please upload your health biomarkers first.' : `Failed to load digital twin (HTTP ${res.status}).`);
        }
      }
      return;
    }

    sessionStorage.setItem('twin', JSON.stringify(data));
    renderTwin(data);
  } catch (err: any) {
    // If cache was already rendered, don't show full-page error
    if (!sessionStorage.getItem('twin')) {
      if (loadingStateEl) loadingStateEl.style.display = 'none';
      if (errorStateEl) {
        errorStateEl.style.display = 'block';
        if (errorMessageEl) {
          errorMessageEl.textContent = `Could not load digital twin: ${err.message || 'Network error'}`;
        }
      }
    }
  }
}

loadTwin();
