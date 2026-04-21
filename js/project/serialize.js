// ============================================================
// AURA — Project Serialization (v1)
// Save/load project JSON to/from disk
// ============================================================

const ProjectIO = (() => {
  function downloadJson(filename, obj) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportProject() {
    const proj = ProjectStore.getState();
    const safe = ProjectSchema.clone(proj);
    // Never embed raw audio bytes for now.
    safe.audio = { ...safe.audio, duration: AudioEngine?.audioBus?.duration || safe.audio.duration };
    safe.meta.modifiedAt = Date.now();
    downloadJson(`${safe.meta.name.replace(/[^\w\-]+/g, '_') || 'aura_project'}.aura.json`, safe);
  }

  async function importProjectFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data.version !== 'number') throw new Error('Invalid project file');
    ProjectStore.dispatch({ type: 'project/load', project: data }, { recordHistory: false });
    return data;
  }

  return { exportProject, importProjectFile };
})();

