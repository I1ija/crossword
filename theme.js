/**
 * theme.js – Dark/light mode toggle, persisted in localStorage.
 * Loaded on every page. Applies theme before first paint to avoid flash.
 */

(function () {
  const STORAGE_KEY = 'crossword_theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update all toggle buttons on the page (there may be one per page)
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  // Apply immediately (before DOM paint) to avoid flash
  applyTheme(getTheme());

  // Wire up toggle buttons after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme()); // re-apply so button labels are set
    document.addEventListener('click', e => {
      if (e.target.closest('.theme-toggle')) {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
      }
    });
  });
})();
