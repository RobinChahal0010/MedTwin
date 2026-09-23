import {
  initNavbar,
  enforceAuthGuard,
  getSessionUser,
  getSessionUserId,
  getUserLanguage,
  getUserLanguageName,
  setUserLanguage,
  clearSessionAuth,
  apiUrl,
} from '../common';
import { API } from '../api';

enforceAuthGuard('profile');
initNavbar('profile');

const usernameEl = document.getElementById('profile-username');
const emailEl = document.getElementById('profile-email');
const avatarEl = document.getElementById('profile-avatar-initial');
const activeLangDisplay = document.getElementById('active-lang-display');
const langSelect = document.getElementById('profile-lang-select') as HTMLSelectElement | null;
const langSavedMsg = document.getElementById('lang-saved-msg');
const signoutBtn = document.getElementById('profile-signout-btn');
const requestLangForm = document.getElementById('request-lang-form');
const requestLangInput = document.getElementById('request-lang-input') as HTMLInputElement | null;
const requestLangSuccess = document.getElementById('request-lang-success');

const user = getSessionUser();
const userId = getSessionUserId() || 'usr_demo_patient';

const displayName = user?.username || 'Patient';
if (usernameEl) {
  usernameEl.textContent = displayName;
}

if (emailEl) {
  emailEl.textContent = user?.emailId || 'patient@medtwin.ai';
}

if (avatarEl) {
  avatarEl.textContent = displayName.trim()[0].toUpperCase();
}

function updateActiveLangLabel() {
  if (activeLangDisplay) {
    activeLangDisplay.textContent = getUserLanguageName() || 'English (India)';
  }
}

updateActiveLangLabel();

// Initialize active language dropdown dynamically from GET /languages
async function setupLanguageDropdown() {
  if (!langSelect) return;

  try {
    const languages = await API.getLanguages();
    if (languages && languages.length > 0) {
      langSelect.innerHTML = '';
      for (const item of languages) {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = item.label;
        langSelect.appendChild(opt);
      }
    }
  } catch (err) {
    console.warn('[MedTwin] Could not load languages from /languages:', err);
  }

  const activeLang = getUserLanguage() || 'en-IN';
  const baseCode = activeLang.slice(0, 2).toLowerCase();

  // Find matching option (exact match or prefix)
  const matchedOption = Array.from(langSelect.options).find(
    (opt) =>
      opt.value.toLowerCase() === activeLang.toLowerCase() ||
      opt.value.toLowerCase().startsWith(baseCode)
  );

  if (matchedOption) {
    langSelect.value = matchedOption.value;
  } else {
    langSelect.value = 'en-IN';
  }

  langSelect.addEventListener('change', async () => {
    const newLang = langSelect.value;
    const selectedOption = langSelect.selectedOptions[0];
    const newLabel = selectedOption ? selectedOption.textContent || undefined : undefined;
    setUserLanguage(newLang, newLabel);
    updateActiveLangLabel();

    if (langSavedMsg) {
      langSavedMsg.style.display = 'block';
      setTimeout(() => {
        if (langSavedMsg) langSavedMsg.style.display = 'none';
      }, 2500);
    }

    try {
      await API.setUserLanguage(userId, newLang);
    } catch (err) {
      console.warn('[MedTwin] Note saving language preference:', err);
    }
  });
}

setupLanguageDropdown();

// Regional language request handler
if (requestLangForm) {
  requestLangForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (requestLangSuccess && requestLangInput && requestLangInput.value.trim()) {
      requestLangSuccess.style.display = 'block';
      requestLangInput.value = '';
      setTimeout(() => {
        if (requestLangSuccess) requestLangSuccess.style.display = 'none';
      }, 4000);
    }
  });
}

// Sign out button
if (signoutBtn) {
  signoutBtn.addEventListener('click', () => {
    clearSessionAuth();
  });
}
