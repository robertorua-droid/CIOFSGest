/**
 * Badge "Sorgente dati attiva" (Firebase).
 * - Mostra lo stato della sorgente dati Firebase-only.
 * - Aggiunge un hint sullo stato di sync.
 */
export function initDataSourceBadge(App) {
  const el = document.getElementById('data-source-badge');
  if (!el || !App?.db) return;

  function render(syncStatus) {
    let label = 'Sorgente dati attiva: Firebase';
    const st = syncStatus?.state || App.db.getSyncStatus?.()?.state;

    // Hint discreti sullo stato (utile nei test)
    if (st === 'syncing') label += ' (sync…)';
    if (st === 'error') label += ' (errore sync)';

    el.textContent = label;

    // colori: verde se ok, giallo se errore
    el.classList.remove('text-bg-secondary', 'text-bg-success', 'text-bg-warning');
    el.classList.add(st === 'error' ? 'text-bg-warning' : 'text-bg-success');
  }

  render();

  // Aggiorna quando cambia lo stato di sincronizzazione
  try {
    App.events?.on?.('sync:status', (st) => render(st));
  } catch {
    // no-op
  }
}
