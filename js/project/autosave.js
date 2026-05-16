// ============================================================
// AURA — Autosave System
// Saves project state to localStorage every 30s.
// On load, shows recovery banner if unsaved data exists.
// ============================================================

const Autosave = (() => {
  const STORAGE_KEY = 'aura_autosave';
  const INTERVAL_MS = 30000; // 30 seconds
  let _timer = null;

  function init() {
    // Check for saved data on startup
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data && data.version && data.timeline) {
          showRecoveryBanner(data);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Start autosave interval
    _timer = setInterval(save, INTERVAL_MS);

    // Also save on beforeunload
    window.addEventListener('beforeunload', save);
  }

  function save() {
    if (typeof ProjectStore === 'undefined') return;
    try {
      const state = ProjectStore.getState();
      // Only save if project has meaningful content
      const hasContent = (state.timeline.visualTrack?.length > 1) ||
                         (state.timeline.cameraTrack?.length > 0) ||
                         (state.timeline.markers?.length > 0) ||
                         (state.nodes?.length > 1);
      if (hasContent) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      // localStorage full or other error — silently fail
      console.warn('[Autosave] Failed:', e.message);
    }
  }

  function showRecoveryBanner(data) {
    const banner = document.getElementById('autosave-banner');
    if (!banner) return;

    const restoreBtn = document.getElementById('autosave-restore');
    const dismissBtn = document.getElementById('autosave-dismiss');

    banner.style.display = 'flex';

    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        ProjectStore.dispatch({ type: 'project/load', project: data }, { recordHistory: false });
        banner.style.display = 'none';
        localStorage.removeItem(STORAGE_KEY);
        if (typeof TimelineUI !== 'undefined') TimelineUI.render();
        if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('Project restored from autosave.', 'success');
      }, { once: true });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.removeItem(STORAGE_KEY);
      }, { once: true });
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { init, save, clear };
})();
