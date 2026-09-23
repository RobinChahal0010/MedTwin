/**
 * MedTwin Common Client Logic
 * - Minimal, flat navbar with avatar dropdown & health status dot
 * - Route authentication guards & session management
 */

export interface StoredUser {
  id: string;
  username: string;
  emailId: string;
  language?: string;
}

const DEFAULT_API_BASE_URL = 'https://medtwin-ajhpaxgsbchtdkaz.koreacentral-01.azurewebsites.net';

export const API_BASE_URL = (
  (typeof window !== 'undefined' && (window as any).__API_BASE_URL__) ||
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : undefined) ||
  DEFAULT_API_BASE_URL
).replace(/\/$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export type PageName = 'home' | 'login' | 'signup' | 'upload' | 'twin' | 'flow' | 'chat' | 'profile';

export function getUserLanguage(): string {
  return localStorage.getItem('user_language') || 'en-IN';
}

export function getUserLanguageName(): string {
  return localStorage.getItem('user_language_name') || 'English (India)';
}

export const INDIAN_LANGUAGES_MAP: Record<string, string> = {
  'en-IN': 'English (India)',
  'hi-IN': 'हिन्दी (Hindi)',
  'bn-IN': 'বাংলা (Bengali)',
  'ta-IN': 'தமிழ் (Tamil)',
  'te-IN': 'తెలుగు (Telugu)',
  'mr-IN': 'मराठी (Marathi)',
  'gu-IN': 'ગુજરાતી (Gujarati)',
  'kn-IN': 'ಕನ್ನಡ (Kannada)',
  'ml-IN': 'മലയാളം (Malayalam)',
  'pa-IN': 'ਪੰਜਾਬੀ (Punjabi)',
  'ur-IN': 'اردو (Urdu)',
};

export function setUserLanguage(code: string, name?: string): void {
  let resolvedName = name;
  if (!resolvedName) {
    if (INDIAN_LANGUAGES_MAP[code]) {
      resolvedName = INDIAN_LANGUAGES_MAP[code];
    } else {
      const prefix = code.slice(0, 2).toLowerCase();
      const matchedKey = Object.keys(INDIAN_LANGUAGES_MAP).find((k) =>
        k.toLowerCase().startsWith(prefix)
      );
      resolvedName = matchedKey ? INDIAN_LANGUAGES_MAP[matchedKey] : code;
    }
  }

  localStorage.setItem('user_language', code);
  localStorage.setItem('user_language_name', resolvedName);
  const user = getSessionUser();
  if (user) {
    user.language = code;
    sessionStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function getSessionUserId(): string | null {
  return sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
}

export function getSessionToken(): string | null {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

export function getSessionUser(): StoredUser | null {
  const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSessionAuth(user: StoredUser, token: string): void {
  sessionStorage.setItem('user_id', user.id);
  localStorage.setItem('user_id', user.id);
  sessionStorage.setItem('token', token);
  localStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSessionAuth(): void {
  sessionStorage.removeItem('user_id');
  localStorage.removeItem('user_id');
  sessionStorage.removeItem('token');
  localStorage.removeItem('token');
  sessionStorage.removeItem('user');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

/**
 * Route guard:
 * Protected pages redirect to login.html if no user_id is stored.
 */
export function enforceAuthGuard(currentPage: PageName): void {
  if (currentPage !== 'home' && currentPage !== 'login' && currentPage !== 'signup') {
    const userId = getSessionUserId();
    if (!userId) {
      console.warn(`[MedTwin] Access denied to ${currentPage}.html: no user_id found. Redirecting to login.html...`);
      window.location.replace('login.html');
    }
  }
}

/**
 * Rebuilt thin, flat navbar:
 * - Logo/wordmark on the far left
 * - Page links evenly spaced in the center (including Flow)
 * - Compact user profile control on the right: clicking takes directly to profile.html
 *   to manage profile and switch language (Hindi, Punjabi, etc.)
 */
export function initNavbar(currentPage: PageName): void {
  let navEl = document.querySelector('nav');
  if (!navEl) {
    navEl = document.createElement('nav');
    document.body.prepend(navEl);
  }

  navEl.className = 'site-nav';
  const user = getSessionUser();

  const userInitial = user
    ? (user.username || user.emailId || 'P').trim()[0].toUpperCase()
    : '';

  navEl.innerHTML = `
    <div class="nav-container">
      <div class="nav-left">
        <a href="home.html" class="nav-brand" title="MedTwin: Type 2 Diabetes Digital Twin">
          MedTwin
        </a>
      </div>

      <div class="nav-center">
        <a href="home.html" class="nav-link ${currentPage === 'home' ? 'active' : ''}">Home</a>
        <a href="upload.html" class="nav-link ${currentPage === 'upload' ? 'active' : ''}">Upload</a>
        <a href="twin.html" class="nav-link ${currentPage === 'twin' ? 'active' : ''}">Digital Twin</a>
        <a href="chat.html" class="nav-link ${currentPage === 'chat' ? 'active' : ''}">Chat</a>
      </div>

      <div class="nav-right">
        ${
          user
            ? `
          <div class="nav-user-wrapper">
            <a href="profile.html" id="nav-avatar-btn" class="nav-avatar-btn" title="View Profile (${user.emailId})">
              <span class="nav-avatar-initial">${userInitial}</span>
            </a>
          </div>
        `
            : `
          <a href="login.html" class="nav-login-pill">
            <span>Log in</span>
          </a>
        `
        }
      </div>
    </div>
  `;

  // Dropdown toggle interaction
  const toggleBtn = document.getElementById('nav-dropdown-toggle');
  const dropdown = document.getElementById('nav-dropdown');

  if (toggleBtn && dropdown) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.style.display !== 'none';
      dropdown.style.display = isOpen ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target as Node) && e.target !== toggleBtn) {
        dropdown.style.display = 'none';
      }
    });
  }

  // Logout button handler
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSessionAuth();
    });
  }
}

/**
 * Check backend health status via GET /health
 */
export async function checkHealthStatus(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/health'), { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

