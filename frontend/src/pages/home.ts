import { initNavbar, enforceAuthGuard, getSessionUserId } from '../common';

enforceAuthGuard('home');
initNavbar('home');

const heroActions = document.querySelector('.hero-actions') as HTMLElement | null;
if (heroActions && getSessionUserId()) {
  heroActions.style.display = 'none';
}
