// ============================================================
// AURA — Studio Layout
// Topbar view toggles + library tabs + status
// ============================================================

const StudioLayout = (() => {
  function init() {
    initLibraryTabs();
    initViewButtons();
    updateStatus();
  }

  function initLibraryTabs() {
    document.querySelectorAll('.library-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.libraryTab;
        document.querySelectorAll('.library-tab').forEach(x => x.classList.toggle('active', x === btn));
        document.querySelectorAll('.library-view').forEach(view => {
          view.classList.toggle('active', view.id === `library-${tab}-view`);
        });
      });
    });
  }

  function initViewButtons() {
    bindToggle('btn-view-library', 'modes-panel', true);
    bindToggle('btn-view-inspector', 'params-panel', true);
    bindToggle('btn-view-timeline', 'timeline-dock', true);
  }

  function bindToggle(btnId, targetId, startsActive) {
    const btn = document.getElementById(btnId);
    const target = document.getElementById(targetId);
    if (!btn || !target) return;

    if (startsActive) {
      btn.classList.add('active');
      if (target.classList.contains('panel')) target.classList.add('open');
      else target.classList.add('active');
    }

    btn.addEventListener('click', () => {
      const isPanel = target.classList.contains('panel');
      const next = isPanel ? !target.classList.contains('open') : !target.classList.contains('hidden-by-layout');
      btn.classList.toggle('active', next);

      if (isPanel) {
        target.classList.toggle('open', next);
      } else {
        target.classList.toggle('hidden-by-layout', !next);
      }
    });
  }

  function updateStatus(text) {
    const el = document.getElementById('studio-status');
    if (!el) return;
    el.textContent = text || (AudioEngine?.audioBus?.loaded ? 'Editing project' : 'Load audio to start editing');
  }

  return { init, updateStatus };
})();

