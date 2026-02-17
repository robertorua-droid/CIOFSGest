/**
 * Theme toggle (Bootstrap 5.3 data-bs-theme).
 *
 * Applies theme by setting:
 *   document.documentElement.dataset.bsTheme = 'light' | 'dark'
 *
 * Persists to localStorage so it works on GitHub Pages without extra setup.
 */

const THEME_KEY = 'ciofs_gest_theme';

function prefersDark() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

export function getSavedTheme() {
  const v = (localStorage.getItem(THEME_KEY) || '').toLowerCase();
  if (v === 'dark' || v === 'light') return v;
  return prefersDark() ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const t = (theme === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-bs-theme', t);

  // Keep toggle in sync if present
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.checked = (t === 'dark');
}

export function setTheme(theme) {
  const t = (theme === 'dark') ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
}

export function initThemeToggle() {
  // Initial apply
  applyTheme(getSavedTheme());

  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  // Ensure correct state
  toggle.checked = (getSavedTheme() === 'dark');

  // Bind changes
  toggle.addEventListener('change', () => {
    setTheme(toggle.checked ? 'dark' : 'light');
  });
}
