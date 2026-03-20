function q(selector, root = document) {
  return root.querySelector(selector);
}

function qa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 991.98px)').matches;
}

function setGroupExpanded(group, expanded) {
  if (!group) return;
  group.classList.toggle('is-open', !!expanded);
  const button = q('.nav-group-toggle', group);
  const menu = q('.nav-group-menu', group);
  if (button) button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (menu) menu.hidden = !expanded;
}

function getSidebarState() {
  const mainApp = document.getElementById('main-app');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const openBtn = document.getElementById('sidebar-open-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  return { mainApp, sidebar, overlay, openBtn, closeBtn };
}

export function initSidebar() {
  const state = getSidebarState();
  if (!state.sidebar || !state.mainApp) return null;

  function closeSidebar() {
    state.mainApp.classList.remove('sidebar-open');
    document.body.classList.remove('sidebar-mobile-open');
  }

  function openSidebar() {
    if (!isMobileViewport()) return;
    state.mainApp.classList.add('sidebar-open');
    document.body.classList.add('sidebar-mobile-open');
  }

  function collapseAllGroups(exceptGroup = null) {
    qa('.nav-group', state.sidebar).forEach((group) => {
      setGroupExpanded(group, group === exceptGroup);
    });
  }

  function ensureDesktopDefaults() {
    if (isMobileViewport()) return;
    qa('.nav-group', state.sidebar).forEach((group) => setGroupExpanded(group, true));
    closeSidebar();
  }

  function syncActiveSection(sectionId) {
    const link = q(`.sidebar .nav-link[data-target="${sectionId}"]`);
    const activeGroup = link?.closest('.nav-group');

    if (isMobileViewport()) {
      if (activeGroup) {
        collapseAllGroups(activeGroup);
        setGroupExpanded(activeGroup, true);
      }
      return;
    }

    if (activeGroup) setGroupExpanded(activeGroup, true);
  }

  function refresh() {
    if (isMobileViewport()) {
      const activeLink = q('.sidebar .nav-link.active', state.sidebar);
      const activeGroup = activeLink?.closest('.nav-group') || null;
      collapseAllGroups(activeGroup);
      if (activeGroup) setGroupExpanded(activeGroup, true);
      return;
    }
    ensureDesktopDefaults();
  }

  qa('.nav-group-toggle', state.sidebar).forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.closest('.nav-group');
      const willOpen = !group.classList.contains('is-open');
      if (isMobileViewport()) {
        collapseAllGroups(willOpen ? group : null);
      }
      setGroupExpanded(group, willOpen);
    });
  });

  state.openBtn?.addEventListener('click', openSidebar);
  state.closeBtn?.addEventListener('click', closeSidebar);
  state.overlay?.addEventListener('click', closeSidebar);

  qa('.sidebar .nav-link[data-target]', state.sidebar).forEach((link) => {
    link.addEventListener('click', () => {
      const group = link.closest('.nav-group');
      if (group) setGroupExpanded(group, true);
      if (isMobileViewport()) {
        window.setTimeout(closeSidebar, 0);
      }
    });
  });

  window.addEventListener('resize', refresh);
  refresh();

  return {
    open: openSidebar,
    close: closeSidebar,
    refresh,
    syncActiveSection,
  };
}
