/**
 * Theme toggle (Bootstrap 5.3 data-bs-theme).
 *
 * No browser storage is used: the initial value follows the system preference
 * and the toggle affects only the current page session.
 */

function prefersDark() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

export function getSavedTheme() {
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
  applyTheme(theme === 'dark' ? 'dark' : 'light');
}

export function initThemeToggle() {
  applyTheme(getSavedTheme());

  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  toggle.checked = (document.documentElement.getAttribute('data-bs-theme') === 'dark');

  toggle.addEventListener('change', () => {
    setTheme(toggle.checked ? 'dark' : 'light');
  });
}
