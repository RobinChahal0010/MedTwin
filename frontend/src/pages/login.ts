import { initNavbar, setSessionAuth, getSessionUserId, clearSessionAuth, apiUrl } from '../common';

initNavbar('login');

const formLogin = document.getElementById('form-login') as HTMLFormElement | null;
const errorBox = document.getElementById('auth-error') as HTMLDivElement | null;
const successBox = document.getElementById('auth-success') as HTMLDivElement | null;
const loggedInCard = document.getElementById('logged-in-card') as HTMLDivElement | null;
const authCard = document.getElementById('auth-card') as HTMLDivElement | null;

// Check if already logged in
const currentUserId = getSessionUserId();
if (currentUserId && loggedInCard && authCard) {
  loggedInCard.style.display = 'block';
  authCard.style.display = 'none';

  const continueBtn = document.getElementById('continue-upload-btn');
  const logoutBtn = document.getElementById('switch-account-btn');

  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      window.location.href = 'twin.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSessionAuth();
      loggedInCard.style.display = 'none';
      authCard.style.display = 'grid';
    });
  }
}

function showError(msg: string) {
  if (errorBox) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
  if (successBox) successBox.style.display = 'none';
}

function showSuccess(msg: string) {
  if (successBox) {
    successBox.textContent = msg;
    successBox.style.display = 'block';
  }
  if (errorBox) errorBox.style.display = 'none';
}

function hideAlerts() {
  if (errorBox) errorBox.style.display = 'none';
  if (successBox) successBox.style.display = 'none';
}

// LOGIN SUBMIT
formLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlerts();

  const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
  const passwordInput = document.getElementById('login-password') as HTMLInputElement | null;
  const submitBtn = document.getElementById('login-submit-btn') as HTMLButtonElement | null;

  if (!emailInput || !passwordInput || !submitBtn) return;

  const emailId = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!emailId || !password) {
    showError('Please enter both your email address and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.detail || data?.message || `Login failed (HTTP ${res.status}). Please check your credentials.`);
    }

    if (data.user && data.user.id && data.token) {
      setSessionAuth(data.user, data.token);
      showSuccess('Welcome back! Loading your Type 2 Diabetes twin...');
      setTimeout(() => {
        window.location.href = 'twin.html';
      }, 700);
    } else {
      throw new Error('Unexpected response format from auth service.');
    }
  } catch (err: any) {
    showError(err.message || 'Network error connecting to backend auth.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue';
  }
});
