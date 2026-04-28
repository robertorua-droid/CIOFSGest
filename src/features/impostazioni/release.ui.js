export async function initReleaseChangelogSettings() {
      const h = value => App.utils.escapeHtml(value);
      const section = document.getElementById('release-changelog');
      if (!section) return;
      const verEl = document.getElementById('release-current-version');
      const dateEl = document.getElementById('release-current-date');
      const nameEl = document.getElementById('release-current-name');
      const changesEl = document.getElementById('release-current-changes');
      const histEl = document.getElementById('release-history');
      const rawEl = document.getElementById('release-changelog-raw');
      const sideVer = document.getElementById('version-sidebar');

      if (section.dataset.loading === '1') return;
      section.dataset.loading = '1';
      try {
        const rel = await fetch('data/release.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('release.json non disponibile'); return r.json(); });
        const current = rel?.current || {};
        if (verEl) verEl.textContent = current.version || '-';
        if (dateEl) dateEl.textContent = current.date || '-';
        if (nameEl) nameEl.textContent = current.name || '-';
        if (sideVer) sideVer.textContent = current.version ? `Versione ${current.version}` : '';
        if (changesEl) {
          changesEl.innerHTML = (current.changes || []).map(x => `<li>${h(x)}</li>`).join('') || '<li>Nessuna nota disponibile</li>';
        }
        if (histEl) {
          const history = Array.isArray(rel?.history) ? rel.history : [];
          histEl.innerHTML = history.map((item, idx) => `
            <div class="accordion-item">
              <h2 class="accordion-header" id="rel-h-${idx}">
                <button class="accordion-button ${idx === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#rel-c-${idx}" aria-expanded="${idx===0?'true':'false'}">
                  ${h(item.version || '-')} - ${h(item.date || '')} - ${h(item.name || '')}
                </button>
              </h2>
              <div id="rel-c-${idx}" class="accordion-collapse collapse ${idx===0?'show':''}" data-bs-parent="#release-history">
                <div class="accordion-body">
                  <ul class="mb-0">${(item.changes || []).map(ch => `<li>${ch}</li>`).join('') || '<li>Nessun dettaglio</li>'}</ul>
                </div>
              </div>
            </div>`).join('') || '<div class="text-muted">Nessuna release disponibile.</div>';
        }
        if (rawEl) {
          try {
            const txt = await fetch('CHANGELOG.md', { cache: 'no-store' }).then(r => r.ok ? r.text() : 'CHANGELOG.md non disponibile');
            rawEl.textContent = txt;
          } catch {
            rawEl.textContent = 'CHANGELOG.md non disponibile';
          }
        }
      } catch (e) {
        if (verEl) verEl.textContent = '-';
        if (dateEl) dateEl.textContent = '-';
        if (nameEl) nameEl.textContent = 'Errore caricamento';
        if (changesEl) changesEl.innerHTML = `<li>${h(e?.message || e)}</li>`;
        if (histEl) histEl.innerHTML = '<div class="text-danger">Impossibile caricare le release.</div>';
        if (rawEl) rawEl.textContent = 'Impossibile caricare CHANGELOG.md';
      } finally {
        section.dataset.loading = '0';
      }
}