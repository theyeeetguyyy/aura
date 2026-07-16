// ============================================================
// AURA Studio — Studio Controller
// Manages the mode chooser, scene picker, immersive mode,
// and scenes tab in the Library panel.
// This is the bridge between ScenePresets and the UI.
// ============================================================

const StudioController = (() => {

    let _auraMode = null;            // 'classic' | 'studio'
    let _currentPresetId = null;
    let _scenePickerFilter = 'all';
    let _immersive = false;

    // ── INIT ────────────────────────────────────────────────
    function init() {
        _setupChooser();
        _setupScenePicker();
        _setupImmersiveMode();
        _setupScenesTab();
    }

    // ── MODE CHOOSER ────────────────────────────────────────
    function _setupChooser() {
        const chooser = document.getElementById('aura-mode-chooser');
        const classicBtn = document.getElementById('chooser-classic');
        const studioBtn = document.getElementById('chooser-studio');
        const dropZone = document.getElementById('drop-zone');

        if (!chooser) return;

        // Hide the drop zone initially — chooser comes first
        if (dropZone) dropZone.classList.add('hidden');

        classicBtn?.addEventListener('click', () => {
            _auraMode = 'classic';
            window.AURA_MODE = 'classic';
            chooser.classList.add('hidden');
            // Show the original drop zone
            if (dropZone) dropZone.classList.remove('hidden');
            console.log('[Studio] Classic mode selected');
        });

        studioBtn?.addEventListener('click', () => {
            _auraMode = 'studio';
            window.AURA_MODE = 'studio';
            chooser.classList.add('hidden');
            // Show the original drop zone — scene picker comes after audio loads
            if (dropZone) dropZone.classList.remove('hidden');
            // Add a "Scenes" tab to Library panel in Studio mode
            _addScenesTabToLibrary();
            console.log('[Studio] Studio mode selected');
        });
    }

    // ── SCENE PICKER ────────────────────────────────────────
    function _setupScenePicker() {
        const skipBtn = document.getElementById('scene-picker-skip');
        skipBtn?.addEventListener('click', _closeScenePicker);
    }

    function showScenePicker() {
        if (_auraMode !== 'studio') return;

        const picker = document.getElementById('scene-picker');
        if (!picker) return;

        // Build category pills
        _buildCategoryPills();

        // Build preset cards
        _buildPresetCards('all');

        // Show picker
        picker.classList.remove('hidden');
    }

    function _closeScenePicker() {
        const picker = document.getElementById('scene-picker');
        if (picker) picker.classList.add('hidden');
    }

    function _buildCategoryPills() {
        const container = document.getElementById('scene-picker-categories');
        if (!container) return;
        container.innerHTML = '';

        // "All" pill
        const allPill = document.createElement('div');
        allPill.className = 'scene-cat-pill active';
        allPill.textContent = '🎯 All';
        allPill.addEventListener('click', () => {
            _scenePickerFilter = 'all';
            _updateCategoryPillStates();
            _buildPresetCards('all');
        });
        container.appendChild(allPill);

        // Category pills
        const categories = ScenePresets.getCategories();
        categories.forEach(cat => {
            const pill = document.createElement('div');
            pill.className = 'scene-cat-pill';
            pill.dataset.category = cat.id;
            pill.textContent = `${cat.icon} ${cat.name}`;
            pill.addEventListener('click', () => {
                _scenePickerFilter = cat.id;
                _updateCategoryPillStates();
                _buildPresetCards(cat.id);
            });
            container.appendChild(pill);
        });
    }

    function _updateCategoryPillStates() {
        const pills = document.querySelectorAll('.scene-cat-pill');
        pills.forEach(pill => {
            const cat = pill.dataset.category || 'all';
            const isAll = !pill.dataset.category && _scenePickerFilter === 'all';
            pill.classList.toggle('active', cat === _scenePickerFilter || isAll);
        });
    }

    function _buildPresetCards(categoryFilter) {
        const grid = document.getElementById('scene-picker-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const presets = categoryFilter === 'all'
            ? ScenePresets.getAll()
            : ScenePresets.getByCategory(categoryFilter);

        const categories = ScenePresets.getCategories();
        const catMap = {};
        categories.forEach(c => { catMap[c.id] = c; });

        presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = 'scene-preset-card';
            const cat = catMap[preset.category];
            if (cat) {
                card.style.setProperty('--card-accent', cat.color + '25');
            }

            card.innerHTML = `
                <div class="preset-card-icon">${preset.icon || '✨'}</div>
                <div class="preset-card-name">${preset.name}</div>
                <div class="preset-card-desc">${preset.description}</div>
                <div class="preset-card-category">${cat?.icon || ''} ${cat?.name || ''}</div>
            `;

            card.addEventListener('click', () => {
                _applyPresetAndClose(preset.id);
            });

            grid.appendChild(card);
        });
    }

    function _applyPresetAndClose(presetId) {
        _currentPresetId = presetId;
        ScenePresets.apply(presetId);
        _closeScenePicker();

        // Update the scenes list in Library if it exists
        _updateScenesListActiveState();

        const preset = ScenePresets.getById(presetId);
        if (preset) {
            console.log(`[Studio] Applied scene: "${preset.name}"`);
        }
    }

    // ── SCENES TAB IN LIBRARY ───────────────────────────────
    function _addScenesTabToLibrary() {
        const tabsContainer = document.querySelector('.library-tabs');
        if (!tabsContainer) return;

        // Check if scenes tab already exists
        if (tabsContainer.querySelector('[data-library-tab="scenes"]')) return;

        // Add "Scenes" tab button
        const scenesTab = document.createElement('button');
        scenesTab.className = 'library-tab';
        scenesTab.dataset.libraryTab = 'scenes';
        scenesTab.textContent = 'Scenes';
        tabsContainer.appendChild(scenesTab);

        // Add scenes view container
        const modesPanel = document.getElementById('modes-panel');
        if (modesPanel) {
            const scenesView = document.createElement('div');
            scenesView.id = 'library-scenes-view';
            scenesView.className = 'library-view';
            scenesView.innerHTML = '<div class="library-scenes-grid" id="library-scenes-grid"></div>';
            modesPanel.appendChild(scenesView);

            _buildScenesLibraryList();
        }

        // Wire up tab switching (integrate with existing tab system)
        scenesTab.addEventListener('click', () => {
            // Deactivate all tabs and views
            tabsContainer.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
            modesPanel?.querySelectorAll('.library-view').forEach(v => v.classList.remove('active'));
            // Activate scenes
            scenesTab.classList.add('active');
            const sv = document.getElementById('library-scenes-view');
            if (sv) sv.classList.add('active');
        });
    }

    function _buildScenesLibraryList() {
        const grid = document.getElementById('library-scenes-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const categories = ScenePresets.getCategories();
        const catMap = {};
        categories.forEach(c => { catMap[c.id] = c; });

        // Group by category
        categories.forEach(cat => {
            const presets = ScenePresets.getByCategory(cat.id);
            if (presets.length === 0) return;

            // Category header
            const header = document.createElement('div');
            header.style.cssText = 'font-size:10px; font-family:var(--mono); letter-spacing:1.5px; text-transform:uppercase; color:var(--text-dim); opacity:0.5; padding:8px 4px 2px;';
            header.textContent = `${cat.icon} ${cat.name}`;
            grid.appendChild(header);

            // Preset items
            presets.forEach(preset => {
                const item = document.createElement('div');
                item.className = 'library-scene-item';
                item.dataset.presetId = preset.id;
                item.innerHTML = `
                    <div class="library-scene-icon">${preset.icon || '✨'}</div>
                    <div class="library-scene-info">
                        <div class="library-scene-name">${preset.name}</div>
                        <div class="library-scene-desc">${preset.description}</div>
                    </div>
                `;
                item.addEventListener('click', () => {
                    _currentPresetId = preset.id;
                    ScenePresets.apply(preset.id);
                    _updateScenesListActiveState();
                });
                grid.appendChild(item);
            });
        });
    }

    function _updateScenesListActiveState() {
        const items = document.querySelectorAll('.library-scene-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.presetId === _currentPresetId);
        });
    }

    function _setupScenesTab() {
        // Scenes tab is added dynamically when Studio mode is selected
    }

    // ── IMMERSIVE MODE ──────────────────────────────────────
    function _setupImmersiveMode() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            if (e.key === 'h' || e.key === 'H') {
                toggleImmersive();
            }
        });
    }

    function toggleImmersive() {
        _immersive = !_immersive;
        document.body.classList.toggle('immersive-mode', _immersive);

        const tooltip = document.getElementById('immersive-tooltip');
        if (_immersive && tooltip) {
            // Show tooltip briefly
            tooltip.classList.remove('hidden');
            // Reset animation
            tooltip.style.animation = 'none';
            tooltip.offsetHeight; // force reflow
            tooltip.style.animation = 'immersiveTooltipFade 3s ease forwards';
        } else if (tooltip) {
            tooltip.classList.add('hidden');
        }
    }

    // ── PUBLIC API ──────────────────────────────────────────
    return {
        init,
        showScenePicker,
        toggleImmersive,
        get mode() { return _auraMode; },
        get currentPresetId() { return _currentPresetId; },
        get isImmersive() { return _immersive; },
    };
})();
