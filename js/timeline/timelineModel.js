// ============================================================
// AURA — Timeline Model helpers (v1)
// ============================================================

const TimelineModel = (() => {
  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00.000';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s - Math.floor(s)) * 1000);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  function getDuration(project) {
    return Math.max(0, project?.audio?.duration || AudioEngine?.audioBus?.duration || 0);
  }

  return { formatTime, getDuration };
})();

