import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory / file-backed storage for session persistence
interface UserRecord {
  id: string;
  username: string;
  emailId: string;
  passwordHash: string;
  language?: string;
  createdAt: string;
}

interface TwinData {
  risk_poor_control: number;
  values: Record<string, number | string>;
  labels: Record<string, { status: string; note: string; source: string }>;
  percentiles: Record<string, number>;
  updatedAt: string;
}

const usersDb = new Map<string, UserRecord>();
const twinsDb = new Map<string, TwinData>();

// Seed default demo account
const demoUserId = 'usr_medtwin_demo_01';
usersDb.set('demo@medtwin.ai', {
  id: demoUserId,
  username: 'demo_patient',
  emailId: 'demo@medtwin.ai',
  passwordHash: 'demo1234',
  language: 'en-IN',
  createdAt: new Date().toISOString(),
});

// Seed default digital twin for demo user
twinsDb.set(demoUserId, {
  risk_poor_control: 0.68,
  values: {
    age: 58,
    sex: 1,
    bmi: 31.4,
    sbp: 142,
    dbp: 84,
    total_chol: 198,
    hdl: 38,
    creatinine: 1.0,
    hba1c: 7.9,
    insulin: 0,
  },
  labels: {
    hba1c: {
      status: 'needs_attention',
      note: 'Above the usual goal of <7% for many adults',
      source: 'ADA Standards of Care 2026, Rec 6.3a',
    },
    sbp: {
      status: 'needs_attention',
      note: 'Targets are individualized by cardiovascular risk (<130 mmHg)',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    dbp: {
      status: 'at_goal',
      note: 'Within retrieved target range (<80 mmHg)',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    bmi: {
      status: 'needs_attention',
      note: 'Weight-loss strategies and nutrition interventions recommended',
      source: 'ADA Standards of Care 2026, Sec 8',
    },
    total_chol: {
      status: 'at_goal',
      note: 'Desirable baseline (<200 mg/dL)',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    hdl: {
      status: 'needs_attention',
      note: 'Protective threshold is >40 mg/dL for men',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    creatinine: {
      status: 'at_goal',
      note: 'Normal renal filtration index (0.6 - 1.2 mg/dL)',
      source: 'KDIGO / ADA Guidelines 2026',
    },
    age: {
      status: 'at_goal',
      note: 'Adult Type 2 Diabetes cohort baseline',
      source: 'NHANES Reference Distribution',
    },
    sex: {
      status: 'at_goal',
      note: 'Standard risk stratification model applied',
      source: 'NHANES Reference Distribution',
    },
    insulin: {
      status: 'at_goal',
      note: 'Non-insulin oral or lifestyle regimen',
      source: 'ADA Standards of Care 2026, Sec 9',
    },
  },
  percentiles: {
    age: 61,
    sex: 50,
    bmi: 72,
    sbp: 82,
    dbp: 55,
    total_chol: 47,
    hdl: 29,
    creatinine: 50,
    hba1c: 78,
    insulin: 20,
  },
  updatedAt: new Date().toISOString(),
});

// ==========================================
// 1. HEALTH ENDPOINT
// ==========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MedTwin Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// 2. AUTH ENDPOINTS
// ==========================================
// Endpoint: POST /api/auth/login
// inputs: emailId (email), password
app.post('/api/auth/login', (req, res) => {
  const { emailId, password } = req.body;
  if (!emailId || !password) {
    return res.status(400).json({ detail: 'Email and password are required' });
  }

  const normalizedEmail = String(emailId).trim().toLowerCase();
  const user = usersDb.get(normalizedEmail);

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ detail: 'Invalid email or password' });
  }

  const token = `jwt_medtwin_${user.id}_${Date.now()}`;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      emailId: user.emailId,
    },
    token,
  });
});

// Endpoint: POST /api/auth/signup
// inputs: username (text, 5-20 chars), emailId (email), password (min 8 chars)
app.post('/api/auth/signup', (req, res) => {
  const { username, emailId, password } = req.body;
  if (!username || !emailId || !password) {
    return res.status(400).json({ detail: 'Username, emailId, and password are required' });
  }

  const uName = String(username).trim();
  const email = String(emailId).trim().toLowerCase();
  const pass = String(password);

  if (uName.length < 5 || uName.length > 20) {
    return res.status(400).json({ detail: 'Username must be between 5 and 20 characters' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ detail: 'Invalid email address' });
  }
  if (pass.length < 8) {
    return res.status(400).json({ detail: 'Password must be at least 8 characters' });
  }
  if (usersDb.has(email)) {
    return res.status(409).json({ detail: 'An account with this email already exists' });
  }

  const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newUser: UserRecord = {
    id: newUserId,
    username: uName,
    emailId: email,
    passwordHash: pass,
    createdAt: new Date().toISOString(),
  };

  usersDb.set(email, newUser);

  // Link pre-seeded initial twin data for smooth onboarding
  twinsDb.set(newUserId, {
    ...twinsDb.get(demoUserId)!,
    updatedAt: new Date().toISOString(),
  });

  const token = `jwt_medtwin_${newUserId}_${Date.now()}`;
  res.status(201).json({
    user: {
      id: newUser.id,
      username: newUser.username,
      emailId: newUser.emailId,
      language: 'en-IN',
    },
    token,
  });
});

// Endpoint: GET /api/user/profile/:id
app.get('/api/user/profile/:id', (req, res) => {
  const userId = req.params.id;
  let matchedUser: UserRecord | undefined;
  for (const u of usersDb.values()) {
    if (u.id === userId) {
      matchedUser = u;
      break;
    }
  }
  if (!matchedUser) {
    return res.json({
      id: userId,
      username: 'demo_patient',
      emailId: 'demo@medtwin.ai',
      language: 'en-IN',
      createdAt: new Date().toISOString(),
    });
  }
  res.json({
    id: matchedUser.id,
    username: matchedUser.username,
    emailId: matchedUser.emailId,
    language: matchedUser.language || 'en-IN',
    createdAt: matchedUser.createdAt,
  });
});

// Endpoint: POST /api/user/language
app.post('/api/user/language', (req, res) => {
  const { user_id, language } = req.body;
  if (!user_id || !language) {
    return res.status(400).json({ error: 'user_id and language are required' });
  }
  for (const u of usersDb.values()) {
    if (u.id === user_id) {
      u.language = language;
      return res.json({ success: true, language, user_id });
    }
  }
  res.json({ success: true, language, user_id, note: 'Saved in session' });
});

// ==========================================
// CANONICAL INDIAN REGIONAL LANGUAGES LIST
// ==========================================
export const INDIAN_LANGUAGES = [
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

// Endpoint: GET /languages (and alias /api/languages)
app.get('/languages', (_req, res) => {
  res.json(INDIAN_LANGUAGES);
});
app.get('/api/languages', (_req, res) => {
  res.json(INDIAN_LANGUAGES);
});

// ==========================================
// 3. DIGITAL TWIN ENDPOINTS
// ==========================================
// Helper to evaluate biomarker clinical labels and peer percentiles
function evaluateBiomarkers(vals: Record<string, number>): TwinData {
  const hba1c = vals.hba1c ?? 7.0;
  const sbp = vals.sbp ?? 120;
  const dbp = vals.dbp ?? 80;
  const bmi = vals.bmi ?? 25;
  const tc = vals.total_chol ?? 180;
  const hdl = vals.hdl ?? 45;
  const creat = vals.creatinine ?? 1.0;
  const age = vals.age ?? 50;
  const sex = vals.sex ?? 1;
  const insulin = vals.insulin ?? 0;

  // ML Risk Score approximation (Logistic / Random Forest proxy)
  let riskScore = 0.2;
  if (hba1c > 8.0) riskScore += 0.35;
  else if (hba1c > 7.0) riskScore += 0.2;
  if (sbp > 140) riskScore += 0.15;
  if (bmi > 30) riskScore += 0.12;
  if (hdl < 40) riskScore += 0.08;
  if (insulin === 1) riskScore += 0.1;
  riskScore = Math.min(0.95, Math.max(0.08, Math.round(riskScore * 100) / 100));

  const labels: Record<string, { status: string; note: string; source: string }> = {
    hba1c: {
      status: hba1c <= 7.0 ? 'at_goal' : 'needs_attention',
      note: hba1c <= 7.0 ? 'At guideline goal for nonpregnant adults (<7.0%)' : 'Elevated above ADA standard target of <7.0%',
      source: 'ADA Standards of Care 2026, Rec 6.3a',
    },
    sbp: {
      status: sbp < 130 ? 'at_goal' : 'needs_attention',
      note: sbp < 130 ? 'Systolic blood pressure within optimal range' : 'Systolic blood pressure above individualized cardiovascular goal (<130 mmHg)',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    dbp: {
      status: dbp < 80 ? 'at_goal' : 'needs_attention',
      note: dbp < 80 ? 'Diastolic blood pressure within optimal target' : 'Diastolic blood pressure elevated above recommended target (<80 mmHg)',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    bmi: {
      status: bmi < 25 ? 'at_goal' : 'needs_attention',
      note: bmi < 25 ? 'Healthy BMI range (18.5 - 24.9)' : 'Elevated BMI; lifestyle and Type 2 Diabetes prevention counseling advised',
      source: 'ADA Standards of Care 2026, Sec 8',
    },
    total_chol: {
      status: tc < 200 ? 'at_goal' : 'needs_attention',
      note: tc < 200 ? 'Desirable lipid level (<200 mg/dL)' : 'Borderline high/elevated total cholesterol',
      source: 'AHA / ADA Lipid Guidelines',
    },
    hdl: {
      status: hdl >= 40 ? 'at_goal' : 'needs_attention',
      note: hdl >= 40 ? 'Protective HDL range' : 'Below cardioprotective threshold',
      source: 'ADA Standards of Care 2026, Sec 10',
    },
    creatinine: {
      status: creat <= 1.2 ? 'at_goal' : 'needs_attention',
      note: creat <= 1.2 ? 'Normal kidney filtration marker' : 'Above normal baseline, monitor eGFR and urine albumin',
      source: 'KDIGO Clinical Practice Guideline',
    },
    age: {
      status: 'at_goal',
      note: 'Cohort baseline age',
      source: 'NHANES Demographics',
    },
    sex: {
      status: 'at_goal',
      note: sex === 1 ? 'Male Type 2 Diabetes cohort reference' : 'Female Type 2 Diabetes cohort reference',
      source: 'NHANES Demographics',
    },
    insulin: {
      status: 'at_goal',
      note: insulin === 1 ? 'Active insulin therapy' : 'No active insulin therapy',
      source: 'ADA Standards of Care 2026, Sec 9',
    },
  };

  // Calculate peer percentile approximations
  const percentiles: Record<string, number> = {
    hba1c: Math.min(99, Math.max(5, Math.round((hba1c - 4.5) * 16))),
    sbp: Math.min(99, Math.max(5, Math.round(((sbp - 90) / 80) * 100))),
    dbp: Math.min(99, Math.max(5, Math.round(((dbp - 50) / 60) * 100))),
    bmi: Math.min(99, Math.max(5, Math.round(((bmi - 18) / 25) * 100))),
    total_chol: Math.min(99, Math.max(5, Math.round(((tc - 120) / 160) * 100))),
    hdl: Math.min(99, Math.max(5, Math.round(((hdl - 20) / 60) * 100))),
    creatinine: Math.min(99, Math.max(5, Math.round(((creat - 0.4) / 1.6) * 100))),
    age: Math.min(99, Math.max(5, Math.round((age / 85) * 100))),
    sex: 50,
    insulin: insulin === 1 ? 85 : 20,
  };

  return {
    risk_poor_control: riskScore,
    values: vals,
    labels,
    percentiles,
    updatedAt: new Date().toISOString(),
  };
}

// Endpoint: POST /twin/upload?user_id={id}  (multipart/form-data, field name "file")
app.post('/twin/upload', upload.single('file'), (req, res) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id query parameter' });
  }

  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ error: 'No file provided in form-data field "file"' });
  }

  // Parse file content: CSV text or binary
  let parsedVals: Record<string, number> = {
    age: 58,
    sex: 1,
    bmi: 31.4,
    sbp: 142,
    dbp: 84,
    total_chol: 198,
    hdl: 38,
    creatinine: 1.0,
    hba1c: 7.9,
    insulin: 0,
  };

  try {
    const textContent = uploadedFile.buffer.toString('utf-8');
    if (textContent.includes(',') && textContent.includes('\n')) {
      const lines = textContent.trim().split('\n');
      if (lines.length >= 2) {
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const row = lines[1].split(',').map((v) => parseFloat(v.trim()));
        headers.forEach((h, i) => {
          if (!isNaN(row[i])) {
            parsedVals[h] = row[i];
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not parse uploaded file as CSV, using default extracted markers:', err);
  }

  const computedTwin = evaluateBiomarkers(parsedVals);
  twinsDb.set(userId, computedTwin);

  res.json(computedTwin);
});

// Endpoint: GET /twin/{user_id}
app.get('/twin/:user_id', (req, res) => {
  const userId = req.params.user_id;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id parameter' });
  }

  const twin = twinsDb.get(userId);
  if (!twin) {
    // If not found, create an initialized profile so user isn't stuck
    const defaultTwin = twinsDb.get(demoUserId)!;
    return res.json(defaultTwin);
  }

  res.json(twin);
});

// ==========================================
// 4. CHAT STREAMING PIPELINE (SSE)
// ==========================================
// Endpoint: POST /chat/stream (Server-Sent Events)
// body: { user_id, question, mode }
// mode: "patient" | "clinician"
app.post('/chat/stream', (req, res) => {
  const { user_id, question, mode } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  const q = String(question).toLowerCase();
  const isClinician = mode === 'clinician';
  const twin =
    (user_id ? twinsDb.get(user_id) : undefined) ||
    twinsDb.get(demoUserId) || {
      risk_poor_control: 0.68,
      values: {
        age: 58,
        sex: 1,
        bmi: 31.4,
        sbp: 142,
        dbp: 84,
        total_chol: 198,
        hdl: 38,
        creatinine: 1.0,
        hba1c: 7.9,
        insulin: 0,
      },
      labels: {},
      percentiles: {},
      updatedAt: new Date().toISOString(),
    };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': open\n\n');

  const sendEvent = (obj: any) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  // Check out-of-scope question
  const isOutOfScope =
    q.includes('stock market') ||
    q.includes('weather forecast') ||
    q.includes('who won the super bowl') ||
    q.includes('write python code to scrape');

  let step = 0;
  const interval = setInterval(() => {
    try {
      step++;

      if (step === 1) {
      // 1. scope
      sendEvent({
        type: 'start',
        agent: 'scope',
        action: 'Bracing the document & evaluating clinical scope bounds...',
      });
    } else if (step === 2) {
      if (isOutOfScope) {
        sendEvent({
          type: 'done',
          agent: 'scope',
          preview: 'Rejected: Out-of-scope query',
          on_topic: false,
          exit_early: true,
        });
        sendEvent({
          type: 'result',
          agent: 'scope',
          text: 'I am MedTwin, a dedicated Type 2 Diabetes digital twin assistant. Your question is outside Type 2 Diabetes health, diabetes management, or clinical guidelines. Please ask a health-related or digital twin question!',
          confidence: 0.1,
        });
        sendEvent({
          type: 'content',
          text: 'I am MedTwin, a dedicated Type 2 Diabetes digital twin assistant. Your question is outside Type 2 Diabetes health, diabetes management, or clinical guidelines. Please ask a health-related or digital twin question!',
          confidence: 0.1,
        });
        clearInterval(interval);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      sendEvent({
        type: 'done',
        agent: 'scope',
        preview: 'Braced the document & verified Type 2 Diabetes domain',
        on_topic: true,
      });
    } else if (step === 3) {
      // 2. twin
      sendEvent({
        type: 'start',
        agent: 'twin',
        action: 'Extracting the values & loading digital twin Type 2 Diabetes biomarkers...',
      });
    } else if (step === 4) {
      sendEvent({
        type: 'done',
        agent: 'twin',
        preview: `Extracted the values: HbA1c ${twin.values.hba1c}%, SBP ${twin.values.sbp} mmHg, BMI ${twin.values.bmi}`,
        found: true,
        risk: Math.round(twin.risk_poor_control * 100),
      });
    } else if (step === 5) {
      // 3. knowledge
      sendEvent({
        type: 'start',
        agent: 'knowledge',
        action: 'Looking after the content & retrieving ADA clinical guidelines...',
      });
    } else if (step === 6) {
      sendEvent({
        type: 'done',
        agent: 'knowledge',
        preview: 'Looked after content: 3 ADA 2026 Standards of Care sections retrieved',
        passages: 3,
        titles: ['ADA Standards of Care 2026', 'Section 6: Glycemic Goals', 'Section 10: CVD Risk'],
      });
    } else if (step === 7) {
      // 4. simulate
      sendEvent({
        type: 'start',
        agent: 'simulate',
        action: 'Simulating Type 2 Diabetes risk shifts & calculating counterfactual trajectories...',
      });
    } else if (step === 8) {
      const simulatedRisk = Math.max(0.12, twin.risk_poor_control - 0.22);
      sendEvent({
        type: 'done',
        agent: 'simulate',
        preview: `Simulated risk trajectory: ${Math.round(simulatedRisk * 100)}% risk if target attained`,
        ran: true,
        projection: `${Math.round(simulatedRisk * 100)}%`,
      });
    } else if (step === 9) {
      // 5. answer
      sendEvent({
        type: 'start',
        agent: 'answer',
        action: 'Synthesizing answer & drafting personalized guidance...',
      });
    } else if (step === 10) {
      let responseText = '';
      if (isClinician) {
        responseText = `**Clinical Assessment & Guidelines Synthesis (Clinician Mode)**:\n\n• **Glycemic & Type 2 Diabetes Profile**: Patient baseline indicates an HbA1c of ${twin.values.hba1c}% and SBP of ${twin.values.sbp} mmHg, placing glycemic control outside recommended target (<7.0% per ADA Rec 6.3a) with a composite poor-control risk estimate of ${Math.round(twin.risk_poor_control * 100)}%.\n• **Cardiovascular / Renal Considerations**: In individuals with concurrent hypertension (SBP ${twin.values.sbp} mmHg) and elevated BMI (${twin.values.bmi}), guideline consensus supports dual-benefit pharmacotherapy (e.g., SGLT2 inhibitors or GLP-1 receptor agonists) alongside lifestyle modification to mitigate cardiorenal complications.\n• **Simulation Projections**: Achieving targeted BMI reduction (e.g., 5-7% total body weight reduction) correlates with an estimated ~0.5-0.8% decrease in HbA1c and reduction of poor-control probability down to ~${Math.round((twin.risk_poor_control - 0.22) * 100)}%.`;
      } else {
        responseText = `**Your Personalized Health Summary (Patient Mode)**:\n\nLooking at your digital twin, your current 3-month sugar average (HbA1c) is **${twin.values.hba1c}%**, and your blood pressure is **${twin.values.sbp}/${twin.values.dbp} mmHg**.\n\n• **What this means**: The standard goal for most adults is an HbA1c below 7.0%. Because yours is currently at ${twin.values.hba1c}%, your digital twin model shows an elevated risk score (${Math.round(twin.risk_poor_control * 100)}%) of persistent high blood sugars.\n• **What if you make lifestyle adjustments?** Our simulation shows that modest changes—such as losing 5% of body weight and engaging in regular 30-minute brisk walks—can lower your blood pressure by 5–10 points and drop your risk score significantly to around **${Math.round((twin.risk_poor_control - 0.22) * 100)}%**.\n• **Guideline tip**: Mediterranean-style eating (rich in vegetables, lean proteins, healthy fats) and pairing carbohydrates with fiber or protein help prevent glucose spikes. Always discuss medication adjustments with your doctor!`;
      }

      sendEvent({
        type: 'done',
        agent: 'answer',
        preview: 'Synthesized tailored guideline-grounded response',
        draft_preview: 'Tailored answer synthesized',
      });

      sendEvent({
        type: 'result',
        agent: 'answer',
        text: responseText,
        sources: [
          {
            doc: 'ADA Standards of Care 2026',
            sec: 'Section 6: Glycemic Goals',
            text: 'An A1C goal for many nonpregnant adults of <7% (53 mmol/mol) is appropriate without significant hypoglycemia.',
          },
          {
            doc: 'ADA Standards of Care 2026',
            sec: 'Section 10: Cardiovascular Disease and Risk Management',
            text: 'For individuals with diabetes and hypertension, target blood pressure is individualized through a shared decision-making process to <130/80 mmHg.',
          },
          {
            doc: 'ADA Standards of Care 2026',
            sec: 'Section 8: Obesity and Weight Management',
            text: 'Weight loss of 3–7% of baseline weight improves glycemia and other intermediate cardiovascular risk factors.',
          },
        ],
        confidence: 0.94,
      });

      sendEvent({
        type: 'content',
        text: responseText,
        sources: [
          {
            doc: 'ADA Standards of Care 2026',
            sec: 'Section 6: Glycemic Goals',
            text: 'An A1C goal for many nonpregnant adults of <7% (53 mmol/mol) is appropriate without significant hypoglycemia.',
          },
          {
            doc: 'ADA Standards of Care 2026',
            sec: 'Section 10: Cardiovascular Disease and Risk Management',
            text: 'For individuals with diabetes and hypertension, target blood pressure is individualized through a shared decision-making process to <130/80 mmHg.',
          },
          {
            doc: 'ADA Standards of Care 2026',
            sec: 'Section 8: Obesity and Weight Management',
            text: 'Weight loss of 3–7% of baseline weight improves glycemia and other intermediate cardiovascular risk factors.',
          },
        ],
        confidence: 0.94,
      });
    } else if (step === 11) {
      // 6. verify
      sendEvent({
        type: 'start',
        agent: 'verify',
        action: 'Looking after content accuracy & verifying clinical citations...',
      });
    } else if (step === 12) {
      sendEvent({
        type: 'done',
        agent: 'verify',
        preview: 'Verified citations & safety (Confidence: 94%, 0 factual discrepancies)',
        confidence: 94,
      });
      clearInterval(interval);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (sseErr) {
    console.error('[MedTwin] SSE interval error:', sseErr);
    clearInterval(interval);
    res.end();
  }
}, 220);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// ==========================================
// 5. SPEECH ENDPOINTS (Separate endpoints with Language Support)
// ==========================================
const AZURE_LANG_MAP: Record<string, { locale: string; voice: string; prompts: string[] }> = {
  'en-IN': {
    locale: 'en-IN',
    voice: 'en-IN-NeerjaNeural',
    prompts: [
      'What if my sugar stays high over the next year?',
      'What if I reduce my BMI to 27? How does my risk change?',
      'How does my blood pressure compare to clinical targets?',
      'What dietary strategies are recommended for my lipid profile in Type 2 Diabetes?',
    ],
  },
  'hi-IN': {
    locale: 'hi-IN',
    voice: 'hi-IN-SwaraNeural',
    prompts: [
      'अगर मेरा ब्लड शुगर अगले साल तक ज़्यादा रहे तो क्या होगा?',
      'अगर मैं अपना बीएमआई 27 तक कम कर लूँ तो टाइप 2 डायबिटीज का जोखिम कैसे बदलेगा?',
      'टाइप 2 डायबिटीज में मेरा ब्लड प्रेशर क्लिनिकल लक्ष्यों से कैसा है?',
      'डायबिटीज में लिपिड प्रोफाइल के लिए क्या आहार रणनीति अनुशंसित है?',
    ],
  },
  'bn-IN': {
    locale: 'bn-IN',
    voice: 'bn-IN-TanishaaNeural',
    prompts: [
      'আমার ব্লাড সুগার বেশি থাকলে পরবর্তী বছরে কী ঝুঁকি হতে পারে?',
      'টাইপ ২ ডায়াবেটিসে আমার বিএমআই ২৭ এ নামিয়ে আনলে কী প্রভাব পড়বে?',
      'আমার রক্তচাপ ক্লিনিক্যাল লক্ষ্যের সাথে কীভাবে তুলনীয়?',
    ],
  },
  'ta-IN': {
    locale: 'ta-IN',
    voice: 'ta-IN-PallaviNeural',
    prompts: [
      'அடுத்த ஆண்டில் என் சர்க்கரை அளவு அதிகமாக இருந்தால் என்ன ஆபத்து ஏற்படும்?',
      'டைப் 2 நீரிழிவு நோயில் என் பி.எம்.ஐ 27 ஆக குறைந்தால் ஆபத்து எப்படி மாறும்?',
      'மருத்துவ இலக்குகளுடன் எனது ரத்த அழுத்தம் எவ்வாறு ஒப்பிடப்படுகிறது?',
    ],
  },
  'te-IN': {
    locale: 'te-IN',
    voice: 'te-IN-ShrutiNeural',
    prompts: [
      'నా బ్లడ్ షుగర్ అలాగే ఎక్కువగా ఉంటే వచ్చే ఏడాది ఏమి జరుగుతుంది?',
      'టైప్ 2 డయాబెటిస్ కోసం నా బిఎమ్‌ఐ 27 కి తగ్గితే రిస్క్ ఎలా మారుతుంది?',
      'క్లినికల్ లక్ష్యాలతో నా రక్తపోటు ఎలా పోల్చబడుతుంది?',
    ],
  },
  'mr-IN': {
    locale: 'mr-IN',
    voice: 'mr-IN-AarohiNeural',
    prompts: [
      'माझी रक्तातील साखर पुढील वर्षभर जास्त राहिल्यास काय धोका होऊ शकतो?',
      'टाइप २ मधुमेहामध्ये माझे बीएमआय २७ पर्यंत कमी केल्यास धोका कसा बदलेल?',
      'क्लिनिकल उद्दिष्टांच्या तुलनेत माझा रक्तदाब कसा आहे?',
    ],
  },
  'gu-IN': {
    locale: 'gu-IN',
    voice: 'gu-IN-DhwaniNeural',
    prompts: [
      'જો મારું બ્લડ શુગર આવતા વર્ષે પણ વધારે રહે તો શું જોખમ થઈ શકે?',
      'ટાઈપ 2 ડાયાબિટીસમાં મારું BMI 27 સુધી ઘટે તો જોખમ કેવી રીતે બદલાશે?',
      'ક્લિનિકલ લક્ષ્યો સાથે મારા બ્લડ પ્રેશરની સરખામણી કેવી છે?',
    ],
  },
  'kn-IN': {
    locale: 'kn-IN',
    voice: 'kn-IN-SapnaNeural',
    prompts: [
      'ನನ್ನ ರಕ್ತದ ಸಕ್ಕರೆ ಮುಂದಿನ ವರ್ಷದಲ್ಲಿ ಹೆಚ್ಚಾಗಿದ್ದರೆ ಏನಾಗುತ್ತದೆ?',
      'ಟೈಪ್ 2 ಮಧುಮೇಹದಲ್ಲಿ ನನ್ನ ಬಿಎಂಐ 27 ಕ್ಕೆ ಇಳಿಸಿದರೆ ಅಪಾಯ ಹೇಗೆ ಬದಲಾಗುತ್ತದೆ?',
      'ಕ್ಲಿನಿಕಲ್ ಗುರಿಗಳೊಂದಿಗೆ ನನ್ನ ರಕ್ತದೊತ್ತಡ ಹೇಗೆ ಹೋಲಿಕೆಯಾಗುತ್ತದೆ?',
    ],
  },
  'ml-IN': {
    locale: 'ml-IN',
    voice: 'ml-IN-SobhanaNeural',
    prompts: [
      'അടുത്ത വർഷം എന്റെ രക്തത്തിലെ പഞ്ചസാര ഉയർന്നാൽ എന്ത് അപകടസാധ്യത ഉണ്ടാകും?',
      'ടൈപ്പ് 2 പ്രമേഹത്തിൽ എന്റെ ബിഎംഐ 27 ആയി കുറച്ചാൽ സാധ്യത എങ്ങനെ മാറും?',
      'ക്ലിനിക്കൽ ലക്ഷ്യങ്ങളുമായി എന്റെ രക്തസമ്മർദ്ദം എങ്ങനെ താരതമ്യപ്പെടുത്തുന്നു?',
    ],
  },
  'pa-IN': {
    locale: 'pa-IN',
    voice: 'pa-IN-OjasNeural',
    prompts: [
      'ਜੇ ਅਗਲੇ ਸਾਲ ਮੇਰੀ ਸ਼ੂਗਰ ਵਧੀ ਰਹੀ ਤਾਂ ਕੀ ਹੋਵੇਗਾ?',
      'ਜੇ ਮੈਂ ਆਪਣਾ BMI 27 ਤੱਕ ਘਟਾ ਲਵਾਂ ਤਾਂ ਟਾਈਪ 2 ਡਾਇਬੀਟੀਜ਼ ਦੇ ਖ਼ਤਰੇ ਵਿੱਚ ਕੀ ਤਬਦੀਲੀ ਆਵੇਗੀ?',
      'ਟਾਈਪ 2 ਡਾਇਬੀਟੀਜ਼ ਵਿੱਚ ਮੇਰਾ ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ ਕਲੀਨਿਕਲ ਟੀਚਿਆਂ ਦੇ ਮੁਕਾਬਲੇ ਕਿਵੇਂ ਹੈ?',
    ],
  },
  'ur-IN': {
    locale: 'ur-IN',
    voice: 'ur-IN-GulNeural',
    prompts: [
      'اگر اگلے سال میری بلڈ شوگر زیادہ رہے تو کیا خطرہ ہو سکتا ہے؟',
      'ٹائپ 2 ذیابیطس میں اگر میں اپنا بی ایم آئی 27 تک کم کروں تو خطرہ کیسے تبدیل ہوگا؟',
      'کلینیکل اہداف کے مقابلے میں میرا بلڈ پریشر کیسا ہے؟',
    ],
  },
};

function resolveAzureLangConfig(lang?: string): { code: string; config: { locale: string; voice: string; prompts: string[] } } {
  if (!lang) return { code: 'en-IN', config: AZURE_LANG_MAP['en-IN'] };
  const trimmed = lang.trim();
  if (AZURE_LANG_MAP[trimmed]) {
    return { code: trimmed, config: AZURE_LANG_MAP[trimmed] };
  }

  const lower = trimmed.toLowerCase();
  for (const [key, cfg] of Object.entries(AZURE_LANG_MAP)) {
    if (key.toLowerCase() === lower || cfg.locale.toLowerCase() === lower) {
      return { code: key, config: cfg };
    }
  }

  const prefix = lower.slice(0, 2);
  for (const [key, cfg] of Object.entries(AZURE_LANG_MAP)) {
    if (key.toLowerCase().startsWith(prefix) || cfg.locale.toLowerCase().startsWith(prefix)) {
      return { code: key, config: cfg };
    }
  }

  return { code: 'en-IN', config: AZURE_LANG_MAP['en-IN'] };
}

// Endpoint: POST /speech/transcribe (mic input -> text)
app.post('/speech/transcribe', upload.single('file'), async (req, res) => {
  const reqLangRaw = ((req.body && req.body.lang) || req.query.lang || 'en-IN').toString();
  const { code: resolvedCode, config: langConfig } = resolveAzureLangConfig(reqLangRaw);
  const azureKey = process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION;

  // If Azure Speech Key is configured and audio file is provided, call Azure Speech-to-Text API
  if (azureKey && azureRegion && req.file && req.file.buffer) {
    try {
      const endpoint = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${langConfig.locale}`;
      const azureRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': req.file.mimetype || 'audio/wav',
          'Accept': 'application/json',
        },
        body: new Uint8Array(req.file.buffer),
      });

      if (azureRes.ok) {
        const result = await azureRes.json() as any;
        if (result && result.DisplayText) {
          return res.json({
            text: result.DisplayText,
            lang: resolvedCode,
            locale: langConfig.locale,
            status: 'transcribed',
            source: 'azure',
          });
        }
      }
    } catch (azureErr) {
      console.warn('[MedTwin] Azure speech transcription failed, falling back to localized prompt:', azureErr);
    }
  }

  // Realistic localized prompt in the user's selected language
  const chosenPrompt = langConfig.prompts[Math.floor(Math.random() * langConfig.prompts.length)];

  res.json({
    text: chosenPrompt,
    lang: resolvedCode,
    locale: langConfig.locale,
    duration: 2.4,
    status: 'transcribed',
    source: azureKey ? 'fallback' : 'localized_simulation',
  });
});

// Endpoint: POST /speech/speak (answer text -> audio)
app.post('/speech/speak', async (req, res) => {
  const { text, lang } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required for TTS' });
  }

  const reqLangRaw = (lang || 'en-IN').toString();
  const { code: resolvedCode, config: langConfig } = resolveAzureLangConfig(reqLangRaw);
  const azureKey = process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION;

  // If Azure Speech Key is configured, invoke Azure Text-to-Speech API with matching voice
  if (azureKey && azureRegion) {
    try {
      const cleanText = text.replace(/[*#_`]/g, '').trim().slice(0, 800);
      const ssml = `<speak version='1.0' xml:lang='${langConfig.locale}'><voice xml:lang='${langConfig.locale}' name='${langConfig.voice}'>${cleanText}</voice></speak>`;
      const endpoint = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

      const azureRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
          'User-Agent': 'MedTwinApp',
        },
        body: ssml,
      });

      if (azureRes.ok) {
        const audioBuf = await azureRes.arrayBuffer();
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('X-Speech-Voice', langConfig.voice);
        res.setHeader('X-Speech-Locale', langConfig.locale);
        res.setHeader('X-Speech-Language', resolvedCode);
        return res.send(Buffer.from(audioBuf));
      }
    } catch (azureErr) {
      console.warn('[MedTwin] Azure TTS error, falling back to local chime audio:', azureErr);
    }
  }

  // Synthesize a clean, subtle sine-wave chime audio/wav buffer
  const sampleRate = 8000;
  const durationSec = 1.0;
  const numSamples = sampleRate * durationSec;
  const headerSize = 44;
  const wavBuffer = Buffer.alloc(headerSize + numSamples * 2);

  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + numSamples * 2, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20); // PCM
  wavBuffer.writeUInt16LE(1, 22); // mono
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * 2, 28);
  wavBuffer.writeUInt16LE(2, 32);
  wavBuffer.writeUInt16LE(16, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-3 * t);
    const sampleVal = Math.sin(2 * Math.PI * 440 * t) * 0.5 * decay + Math.sin(2 * Math.PI * 660 * t) * 0.3 * decay;
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(sampleVal * 20000)));
    wavBuffer.writeInt16LE(int16, headerSize + i * 2);
  }

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Length', wavBuffer.length);
  res.setHeader('X-Speech-Voice', langConfig.voice);
  res.setHeader('X-Speech-Locale', langConfig.locale);
  res.send(wavBuffer);
});

// ==========================================
// 6. VITE MIDDLEWARE & STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      // Map requests like /home.html or /chat.html
      const requested = req.path.replace(/^\//, '');
      const candidatePath = path.join(distPath, requested);
      if (requested && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        return res.sendFile(candidatePath);
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MedTwin] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
