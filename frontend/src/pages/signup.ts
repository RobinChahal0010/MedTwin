import { initNavbar, setSessionAuth, getSessionUserId, clearSessionAuth, apiUrl } from '../common';

initNavbar('signup');

const formSignup = document.getElementById('form-signup') as HTMLFormElement | null;
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

// SIGNUP SUBMISSION
formSignup?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlerts();

  const userInput = document.getElementById('signup-username') as HTMLInputElement | null;
  const emailInput = document.getElementById('signup-email') as HTMLInputElement | null;
  const passInput = document.getElementById('signup-password') as HTMLInputElement | null;
  const submitBtn = document.getElementById('signup-submit-btn') as HTMLButtonElement | null;

  if (!userInput || !emailInput || !passInput || !submitBtn) return;

  const username = userInput.value.trim();
  const emailId = emailInput.value.trim().toLowerCase();
  const password = passInput.value;

  if (username.length < 5 || username.length > 20) {
    showError('Username must be between 5 and 20 characters.');
    return;
  }
  if (!emailId || !emailId.includes('@')) {
    showError('Please enter a valid email address.');
    return;
  }
  if (password.length < 8) {
    showError('Password must be at least 8 characters in length.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating twin profile...';

  try {
    const res = await fetch(apiUrl('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, emailId, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Signup failed. Please try a different email address.');
    }

    if (data.user && data.user.id && data.token) {
      setSessionAuth(data.user, data.token);
      showSuccess('Profile created! Proceeding to digital twin upload...');
      setTimeout(() => {
        window.location.href = 'upload.html';
      }, 700);
    } else {
      throw new Error('Unexpected response format from authentication service.');
    }
  } catch (err: any) {
    showError(err.message || 'Error creating account. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue';
  }
});
