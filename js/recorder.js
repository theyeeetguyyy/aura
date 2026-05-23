// ============================================================
// AURA — Recorder v6
//
// Capture:  canvas.captureStream() → MediaRecorder → WebM/VP8
// Export:   FFmpeg WASM (single-threaded, no SharedArrayBuffer)
//           → H.264 High + AAC + yuv420p + faststart MP4
//
// Single-threaded core works on GitHub Pages with zero headers.
// Quality is always locked to "best" — no UI override.
// ============================================================

const Recorder = (() => {

    // ── Profile (locked to best) ────────────────────────────
    const PROFILE = {
        label:              'Best',
        captureVideoBitrate: 48_000_000,
        captureAudioBitrate: 192_000,
        x264Preset:         'fast', // balanced speed/compression for WASM
        crf:                16,     // lowered from 18 to 16 for near-lossless quality
        audioBitrate:       '256k'
    };

    const CAPTURE_FPS = 60;
    const CHUNK_MS    = 5_000;

    // ── State ───────────────────────────────────────────────
    let mediaRecorder  = null;
    let chunks         = [];
    let isRecording    = false;
    let isProcessing   = false;
    let startTime      = 0;

    // ── FFmpeg ──────────────────────────────────────────────
    let ffmpeg          = null;
    let ffmpegReady     = false;
    let ffmpegLoading   = false;
    let ffmpegLoadPromise = null;

    // ── MIME type ───────────────────────────────────────────
    // VP8 only — VP9 → H.264 transcode causes sync drift in ffmpeg-wasm
    function pickMimeType() {
        const candidates = [
            'video/webm; codecs=vp8,opus',
            'video/webm; codecs=vp8',
            'video/webm'
        ];
        for (const m of candidates) {
            if (MediaRecorder.isTypeSupported(m)) return m;
        }
        return 'video/webm';
    }

    // ── Progress UI ─────────────────────────────────────────
    function ui() {
        return {
            modal:   document.getElementById('export-progress-modal'),
            title:   document.getElementById('export-progress-title'),
            detail:  document.getElementById('export-progress-detail'),
            bar:     document.getElementById('export-progress-bar'),
            fill:    document.getElementById('export-progress-fill'),
            label:   document.getElementById('export-progress-label'),
            percent: document.getElementById('export-progress-percent')
        };
    }

    function showProgress(title, detail, progress, label) {
        const el = ui();
        if (!el.modal) return;
        el.modal.classList.add('open');
        if (el.title)   el.title.textContent   = title   || 'Exporting MP4';
        if (el.detail)  el.detail.textContent  = detail  || '';
        if (el.label)   el.label.textContent   = label   || 'Working…';

        const numeric = Number.isFinite(progress);
        if (el.bar)     el.bar.classList.toggle('indeterminate', !numeric);
        if (el.fill && numeric) el.fill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        if (el.percent) el.percent.textContent = numeric ? `${Math.round(progress)}%` : '…';
    }

    function hideProgress() {
        const el = ui();
        if (!el.modal) return;
        if (el.bar)  el.bar.classList.remove('indeterminate');
        if (el.fill) el.fill.style.width = '0%';
        el.modal.classList.remove('open');
    }

    function setStatus(msg) {
        const el = document.getElementById('record-status');
        if (el) el.textContent = msg || '';
    }

    // ── FFmpeg loader ───────────────────────────────────────
    // Uses @ffmpeg/core-st (single-threaded) — no SharedArrayBuffer
    // required, so it works on GitHub Pages without COOP/COEP headers.
    async function ensureFFmpeg({ showUi = true } = {}) {
        if (ffmpegReady) return true;

        // Can't use Workers from file:// regardless of build
        if (location.protocol === 'file:') {
            console.warn('[Recorder] file:// origin — run via HTTP for MP4 export.');
            if (showUi && typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Run AURA over HTTP (not file://) for MP4 export.', 'warning');
            }
            return false;
        }

        // Deduplicate concurrent load calls
        if (ffmpegLoadPromise) {
            if (showUi) showProgress('Preparing export engine', 'Loading FFmpeg…', null, 'Loading');
            return ffmpegLoadPromise;
        }

        const FFmpegLib  = globalThis.FFmpegWASM || globalThis.FFmpeg || null;
        const FFmpegUtil = globalThis.FFmpegUtil  || null;
        const FFmpegCtor = FFmpegLib?.FFmpeg  || null;
        const fetchFile  = FFmpegUtil?.fetchFile || null;
        const toBlobURL  = FFmpegUtil?.toBlobURL || null;

        if (!FFmpegCtor || !fetchFile || !toBlobURL) {
            console.error(
                '[Recorder] FFmpeg globals missing.\n' +
                'Make sure these two scripts appear before recorder.js in index.html:\n' +
                '  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"></script>\n' +
                '  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>'
            );
            return false;
        }

        if (showUi) showProgress('Preparing export engine', 'Loading FFmpeg…', null, 'Loading');

        ffmpegLoadPromise = (async () => {
            ffmpeg = new FFmpegCtor();

            // Wire transcode progress → progress bar (15–95 %)
            ffmpeg.on('progress', ({ progress }) => {
                const pct = 15 + Math.round(Math.max(0, Math.min(1, progress || 0)) * 80);
                showProgress('Exporting Best MP4', 'Transcoding H.264 + AAC…', pct, 'Transcoding');
            });
            
            ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]', message);
            });

            // ── KEY CHANGE: core = single-threaded in v0.12, no SharedArrayBuffer ──
            const coreBaseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
            const workerURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                classWorkerURL: await toBlobURL(workerURL, 'text/javascript')
            });

            ffmpegReady = true;
            console.log('[Recorder] FFmpeg (single-threaded) ready.');
            return true;
        })().catch(err => {
            console.error('[Recorder] FFmpeg failed to load:', err);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('FFmpeg failed to load — will save as WebM instead.', 'error');
            }
            ffmpeg = null;
            return false;
        }).finally(() => {
            ffmpegLoadPromise = null;
        });

        return ffmpegLoadPromise;
    }

    // ── Helpers ─────────────────────────────────────────────
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }

    function buildFilename(ext = 'mp4') {
        return `aura_best_${Date.now()}.${ext}`;
    }

    async function safeDelete(path) {
        if (!ffmpeg) return;
        try { await ffmpeg.deleteFile(path); } catch (_) {}
    }

    // ── Transcode ────────────────────────────────────────────
    async function transcodeToMp4(webmBlob) {
        showProgress('Exporting Best MP4', 'Preparing source…', 5, 'Preparing');

        const loaded = await ensureFFmpeg({ showUi: true });
        if (!loaded) {
            console.warn('[Recorder] FFmpeg unavailable — saving WebM.');
            hideProgress();
            downloadBlob(webmBlob, buildFilename('webm'));
            return;
        }

        const inputName  = 'input.webm';
        const outputName = 'output.mp4';

        try {
            const FFmpegUtil = globalThis.FFmpegUtil || null;
            const fetchFile  = FFmpegUtil?.fetchFile;
            if (!fetchFile) throw new Error('fetchFile helper missing');

            showProgress('Exporting Best MP4', 'Writing source to virtual FS…', 10, 'Writing');
            await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));

            showProgress('Exporting Best MP4', 'Building MP4 — H.264 High + AAC + yuv420p…', 12, 'Starting encode');

            await ffmpeg.exec([
                '-fflags',    '+genpts',
                '-i',          inputName,
                '-map',        '0:v:0',
                '-map',        '0:a:0?',
                // Video
                '-c:v',        'libx264',
                '-preset',     PROFILE.x264Preset,
                '-crf',        String(PROFILE.crf),
                '-profile:v',  'high',
                '-level',      '4.2',
                '-vf',         'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
                '-pix_fmt',    'yuv420p',
                // Audio
                '-c:a',        'aac',
                '-b:a',        PROFILE.audioBitrate,
                '-ar',         '48000',
                '-ac',         '2',
                // Container
                '-movflags',   '+faststart',
                '-shortest',
                outputName
            ]);

            showProgress('Exporting Best MP4', 'Finalising…', 98, 'Finalising');
            const data    = await ffmpeg.readFile(outputName);
            const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
            const filename = buildFilename('mp4');

            downloadBlob(mp4Blob, filename);

            const mb = (mp4Blob.size / 1_048_576).toFixed(1);
            console.log(`[Recorder] ✓ MP4 ready — ${mb} MB — ${filename}`);

            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast(`MP4 exported — ${mb} MB`, 'info');
            }

        } catch (err) {
            console.error('[Recorder] Transcode failed:', err);
            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast('Transcode failed — saving WebM fallback.', 'error');
            }
            downloadBlob(webmBlob, buildFilename('webm'));
        } finally {
            await safeDelete(inputName);
            await safeDelete(outputName);
            hideProgress();
        }
    }

    // ── Public API ───────────────────────────────────────────
    function start(canvas) {
        if (isRecording || isProcessing) return;

        const mimeType    = pickMimeType();
        const videoStream = canvas.captureStream(CAPTURE_FPS);
        const audioStream = (typeof AudioEngine !== 'undefined') ? AudioEngine.getAudioStream() : null;

        const combined = new MediaStream();
        videoStream.getTracks().forEach(t => combined.addTrack(t));
        if (audioStream) {
            audioStream.getTracks().forEach(t => combined.addTrack(t));
        } else {
            console.warn('[Recorder] No audio stream — export will be video-only.');
        }

        mediaRecorder = new MediaRecorder(combined, {
            mimeType,
            videoBitsPerSecond: PROFILE.captureVideoBitrate,
            audioBitsPerSecond: PROFILE.captureAudioBitrate
        });

        chunks    = [];
        startTime = performance.now();
        isRecording = true;

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            isProcessing = true;
            setStatus('Exporting MP4…');
            const webmBlob = new Blob(chunks, { type: mimeType });
            chunks = [];
            await transcodeToMp4(webmBlob);
            isProcessing = false;
            setStatus('');
        };

        mediaRecorder.start(CHUNK_MS);
        setStatus('Recording Best…');

        console.log(
            `[Recorder] Started — ${canvas.width}×${canvas.height} @ ${CAPTURE_FPS}fps` +
            ` [${mimeType}] [Best]`
        );

        // Pre-warm FFmpeg while the user is still recording
        ensureFFmpeg({ showUi: false });
    }

    function stop() {
        if (!isRecording || !mediaRecorder || isProcessing) return;
        mediaRecorder.stop();
        isRecording = false;
        setStatus('Finishing…');
        console.log('[Recorder] Stopped — transcoding to MP4…');
    }

    function toggle(canvas) {
        if (isProcessing) return;
        if (isRecording) stop();
        else start(canvas);
    }

    function getRecordingTime() {
        if (!isRecording) return 0;
        return (performance.now() - startTime) / 1000;
    }

    return {
        start,
        stop,
        toggle,
        get isRecording()  { return isRecording;  },
        get isProcessing() { return isProcessing; },
        getRecordingTime
    };
})();