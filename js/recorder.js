// ============================================================
// AURA - Recording / Export System v5
//
// Capture strategy:
//   canvas.captureStream() -> MediaRecorder -> WebM source
//
// Delivery strategy:
//   FFmpeg WASM transcodes that source into a standard MP4:
//   H.264 High + AAC + yuv420p + faststart
//
// Goal:
//   reliable MP4 playback across WhatsApp, Instagram, iPhone,
//   QuickTime, Android gallery apps, and common editors.
// ============================================================

const Recorder = (() => {
    const EXPORT_PROFILES = {
        low: {
            key: 'low',
            label: 'Low',
            captureVideoBitrate: 12_000_000,
            captureAudioBitrate: 128_000,
            x264Preset: 'medium',
            crf: 24,
            audioBitrate: '128k'
        },
        medium: {
            key: 'medium',
            label: 'Medium',
            captureVideoBitrate: 24_000_000,
            captureAudioBitrate: 160_000,
            x264Preset: 'slow',
            crf: 20,
            audioBitrate: '192k'
        },
        best: {
            key: 'best',
            label: 'Best',
            captureVideoBitrate: 48_000_000,
            captureAudioBitrate: 192_000,
            x264Preset: 'slow',
            crf: 18,
            audioBitrate: '256k'
        },
        highest: {
            key: 'highest',
            label: 'Highest',
            captureVideoBitrate: 100_000_000,
            captureAudioBitrate: 320_000,
            x264Preset: 'slow',
            crf: 16,
            audioBitrate: '320k'
        }
    };

    const DEFAULT_PROFILE_KEY = 'best';
    const CAPTURE_FPS = 60;
    const CHUNK_MS = 5000;

    let mediaRecorder = null;
    let chunks = [];
    let isRecording = false;
    let isProcessing = false;
    let startTime = 0;
    let ffmpegReady = false;
    let ffmpeg = null;
    let ffmpegLoadPromise = null;
    let activeProfile = EXPORT_PROFILES[DEFAULT_PROFILE_KEY];

    function pickMimeType() {
        const candidates = [
            'video/webm; codecs=vp8,opus',
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8',
            'video/webm'
        ];

        for (const mime of candidates) {
            if (MediaRecorder.isTypeSupported(mime)) return mime;
        }

        return 'video/webm';
    }

    function getSelectedProfile() {
        const el = document.getElementById('settings-export-quality');
        const key = el?.value || DEFAULT_PROFILE_KEY;
        return EXPORT_PROFILES[key] || EXPORT_PROFILES[DEFAULT_PROFILE_KEY];
    }

    function getProgressElements() {
        return {
            modal: document.getElementById('export-progress-modal'),
            title: document.getElementById('export-progress-title'),
            detail: document.getElementById('export-progress-detail'),
            bar: document.getElementById('export-progress-bar'),
            fill: document.getElementById('export-progress-fill'),
            label: document.getElementById('export-progress-label'),
            percent: document.getElementById('export-progress-percent')
        };
    }

    function showProgress(title, detail, progress, label) {
        const ui = getProgressElements();
        if (!ui.modal) return;

        ui.modal.classList.add('open');
        if (ui.title) ui.title.textContent = title || 'Exporting MP4';
        if (ui.detail) ui.detail.textContent = detail || '';
        if (ui.label) ui.label.textContent = label || 'Working…';

        const numeric = Number.isFinite(progress);
        if (ui.bar) ui.bar.classList.toggle('indeterminate', !numeric);
        if (ui.fill && numeric) ui.fill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        if (ui.percent) ui.percent.textContent = numeric ? `${Math.round(progress)}%` : '...';
    }

    function hideProgress() {
        const ui = getProgressElements();
        if (!ui.modal) return;
        if (ui.bar) ui.bar.classList.remove('indeterminate');
        if (ui.fill) ui.fill.style.width = '0%';
        ui.modal.classList.remove('open');
    }

    function setStatus(msg) {
        const el = document.getElementById('record-status');
        if (el) el.textContent = msg || '';
    }

    function resolveFFmpegApi() {
        const ffmpegGlobal = globalThis.FFmpegWASM || globalThis.FFmpeg || null;
        const utilGlobal = globalThis.FFmpegUtil || null;
        const FFmpegCtor = ffmpegGlobal?.FFmpeg || null;
        const fetchFile = utilGlobal?.fetchFile || null;

        return {
            ffmpegGlobal,
            utilGlobal,
            FFmpegCtor,
            fetchFile
        };
    }

    async function ensureFFmpeg(options = {}) {
        const { showUi = true } = options;
        if (ffmpegReady) return true;
        if (ffmpegLoadPromise) {
            if (showUi) {
                showProgress(
                    'Preparing Export Engine',
                    'Loading FFmpeg so Aura can build a real MP4 instead of relying on browser recording magic.',
                    null,
                    'Loading FFmpeg'
                );
            }
            return ffmpegLoadPromise;
        }

        const api = resolveFFmpegApi();
        if (!api.FFmpegCtor || !api.fetchFile) {
            console.error(
                '[Recorder] @ffmpeg/ffmpeg and @ffmpeg/util are not loaded or exposed under an unexpected global name.\n' +
                'Add before recorder.js:\n' +
                '  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"></script>\n' +
                '  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>'
            );
            return false;
        }

        ffmpegLoadPromise = (async () => {
            if (showUi) {
                showProgress(
                    'Preparing Export Engine',
                    'Loading FFmpeg so Aura can build a real MP4 instead of relying on browser recording magic.',
                    null,
                    'Loading FFmpeg'
                );
            }

            ffmpeg = new api.FFmpegCtor();
            ffmpeg.on('progress', ({ progress }) => {
                const pct = 15 + Math.round(Math.max(0, Math.min(1, progress || 0)) * 80);
                showProgress(
                    `Exporting ${activeProfile.label} MP4`,
                    'Transcoding captured frames into a standard H.264/AAC MP4.',
                    pct,
                    'Transcoding'
                );
            });

            await ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
            });

            ffmpegReady = true;
            return true;
        })().catch((err) => {
            console.error('[Recorder] FFmpeg load failed:', err);
            ffmpeg = null;
            return false;
        }).finally(() => {
            ffmpegLoadPromise = null;
        });

        return ffmpegLoadPromise;
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }

    function buildOutputFilename(profile) {
        return `aura_${profile.key}_${Date.now()}.mp4`;
    }

    async function safeDelete(path) {
        if (!ffmpeg) return;
        try {
            await ffmpeg.deleteFile(path);
        } catch (_) {
            // Ignore cleanup failures in the virtual FS.
        }
    }

    async function transcodeToMp4(webmBlob, filename, profile) {
        activeProfile = profile;

        showProgress(
            `Exporting ${profile.label} MP4`,
            'Preparing the captured WebM for final MP4 packaging.',
            5,
            'Preparing source'
        );

        const loaded = await ensureFFmpeg({ showUi: true });
        if (!loaded) {
            console.warn('[Recorder] FFmpeg unavailable — saving WebM fallback');
            hideProgress();
            downloadBlob(webmBlob, filename.replace('.mp4', '.webm'));
            return;
        }

        const inputName = 'input.webm';
        const outputName = 'output.mp4';

        try {
            const { fetchFile } = resolveFFmpegApi();
            if (!fetchFile) throw new Error('FFmpeg fetchFile helper is unavailable');
            await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));

            showProgress(
                `Exporting ${profile.label} MP4`,
                'Building a WhatsApp-safe MP4 with H.264 video, AAC audio, front-loaded metadata, and iPhone-safe pixel format.',
                12,
                'Starting encode'
            );

            await ffmpeg.exec([
                '-fflags', '+genpts',
                '-i', inputName,
                '-map', '0:v:0',
                '-map', '0:a:0?',
                '-c:v', 'libx264',
                '-preset', profile.x264Preset,
                '-crf', String(profile.crf),
                '-profile:v', 'high',
                '-level', '4.2',
                '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', profile.audioBitrate,
                '-ar', '48000',
                '-ac', '2',
                '-movflags', '+faststart',
                '-shortest',
                outputName
            ]);

            showProgress(
                `Exporting ${profile.label} MP4`,
                'Finalizing the MP4 file and getting it ready to download.',
                98,
                'Finalizing'
            );

            const data = await ffmpeg.readFile(outputName);
            const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });

            downloadBlob(mp4Blob, filename);

            const mb = (mp4Blob.size / 1_048_576).toFixed(1);
            console.log(`[Recorder] MP4 ready — ${profile.label} preset — ${mb} MB`);
        } catch (err) {
            console.error('[Recorder] Transcode failed:', err);
            downloadBlob(webmBlob, filename.replace('.mp4', '.webm'));
        } finally {
            await safeDelete(inputName);
            await safeDelete(outputName);
            hideProgress();
        }
    }

    function start(canvas) {
        if (isRecording || isProcessing) return;

        const profile = getSelectedProfile();
        const mimeType = pickMimeType();

        const videoStream = canvas.captureStream(CAPTURE_FPS);
        const audioStream = AudioEngine.getAudioStream();
        const combinedStream = new MediaStream();

        videoStream.getTracks().forEach(track => combinedStream.addTrack(track));
        if (audioStream) {
            audioStream.getTracks().forEach(track => combinedStream.addTrack(track));
        } else {
            console.warn('[Recorder] No audio stream found — export will be video-only');
        }

        mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: profile.captureVideoBitrate,
            audioBitsPerSecond: profile.captureAudioBitrate
        });

        activeProfile = profile;
        chunks = [];
        setStatus(`Recording ${profile.label} source…`);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const webmBlob = new Blob(chunks, { type: mimeType });
            const filename = buildOutputFilename(profile);
            chunks = [];
            isProcessing = true;
            setStatus(`Exporting ${profile.label} MP4…`);
            await transcodeToMp4(webmBlob, filename, profile);
            isProcessing = false;
            setStatus('');
        };

        mediaRecorder.start(CHUNK_MS);
        isRecording = true;
        startTime = performance.now();

        console.log(
            `[Recorder] Started: ${canvas.width}x${canvas.height} @ ${CAPTURE_FPS}fps ` +
            `[${mimeType}] [${profile.label}]`
        );

        // Pre-warm FFmpeg while the user is recording so export starts faster.
        ensureFFmpeg({ showUi: false });
    }

    function stop() {
        if (!isRecording || !mediaRecorder || isProcessing) return;
        mediaRecorder.stop();
        isRecording = false;
        setStatus('Finishing recording…');
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
        get isRecording() { return isRecording; },
        get isProcessing() { return isProcessing; },
        getRecordingTime
    };
})();
