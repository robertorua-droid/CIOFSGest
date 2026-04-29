import { utils } from './utils.js';

function renderClock() {
  const el = document.getElementById('current-datetime');
  if (!el) return;
  el.textContent = new Date().toLocaleString();
}

function renderCalendar() {
  const container = document.getElementById('calendar-widget');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay() === 0 ? 7 : first.getDay(); // 1..7 (Mon..Sun)
  const days = last.getDate();

  let html = '<table class="table table-sm"><thead><tr>';
  ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(d => html += `<th>${d}</th>`);
  html += '</tr></thead><tbody><tr>';

  for (let i = 1; i < startDay; i++) html += '<td></td>';
  let day = 1;
  const today = now.getDate();
  for (let cell = startDay; cell <= 7; cell++) {
    html += `<td class="${day === today ? 'today' : ''}">${day}</td>`;
    day++;
  }
  html += '</tr>';

  while (day <= days) {
    html += '<tr>';
    for (let i = 0; i < 7; i++) {
      if (day <= days) html += `<td class="${day === today ? 'today' : ''}">${day}</td>`;
      else html += '<td></td>';
      day++;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

export function createHome({ db, ui, events }) {
  let clockInterval = null;

  function initNotes(user) {
    const ta = document.getElementById('notes-textarea');
    const btn = document.getElementById('save-notes-btn');
    if (!ta || !btn) return;

    const curDb = db.ensure();
    const key = user?.id || user?.surname || 'default';
    ta.value = (curDb.notes && curDb.notes[key]) || '';

    btn.addEventListener('click', () => {
      const d = db.ensure();
      d.notes = d.notes || {};
      d.notes[key] = ta.value || '';
      db.save(d);
      ui.showToast('Note salvate', 'success');
    });
  }

  return {
    start(user) {
      renderClock();
      renderCalendar();
      initNotes(user);
      if (clockInterval) clearInterval(clockInterval);
      clockInterval = setInterval(renderClock, 1000);
    }
  };
}
