export const ui = {
  showToast(message, type) {
    // fallback toast
    const id = 'toast-container';
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement('div');
      container.id = id;
      container.className = 'toast-container position-fixed top-0 end-0 p-3';
      container.style.zIndex = 1080;
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast align-items-center text-bg-' + (type || 'info') + ' border-0';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<div class="d-flex"><div class="toast-body">' + message +
      '</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';

    container.appendChild(el);
    try {
      new bootstrap.Toast(el, { delay: 2500 }).show();
      el.addEventListener('hidden.bs.toast', () => el.remove());
    } catch {
      console.log('[Toast]', message);
    }
  },

  setSidebarUserLabel(user) {
    const el = document.getElementById('user-name-sidebar');
    if (el && user) el.textContent = `Utente: ${user.surname} (${user.role})`;
  },

  setCompanySidebarName(db) {
    const el = document.getElementById('company-name-sidebar');
    if (el && db?.company?.name) el.textContent = db.company.name;
  },

  showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('d-none');

    document.querySelectorAll('.sidebar .nav-link').forEach(a => a.classList.remove('active'));
    const current = document.querySelector(`.sidebar .nav-link[data-target="${id}"]`);
    if (current) current.classList.add('active');
  }
};
