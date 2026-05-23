// ============================================================
// AURA — Recorder
//
// Capture:  canvas.captureStream() → MediaRecorder → WebM/VP8
// Export:   Raw, ultra-high bitrate WebM download
// ============================================================

const Recorder = (() => {

    // ── Profile (Max Quality) ───────────────────────────────
    const PROFILE = {
        label:              'Best',
        captureVideoBitrate: 100_000_000, // 100 Mbps for visually lossless WebM
        captureAudioBitrate: 320_000      // 320 kbps for audio
    };

    const CAPTURE_FPS = 60;
    const CHUNK_MS    = 5_000;

    // ── State ───────────────────────────────────────────────
    let mediaRecorder  = null;
    let chunks         = [];
    let isRecording    = false;
    let isProcessing   = false;
    let startTime      = 0;

    // ── MIME type ───────────────────────────────────────────
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

    function setStatus(msg) {
        const el = document.getElementById('record-status');
        if (el) el.textContent = msg || '';
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

    function buildFilename(ext = 'webm') {
        return `aura_best_${Date.now()}.${ext}`;
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

        mediaRecorder.onstop = () => {
            isProcessing = true;
            setStatus('Finalizing WebM…');
            const webmBlob = new Blob(chunks, { type: mimeType });
            chunks = [];
            
            const filename = buildFilename('webm');
            downloadBlob(webmBlob, filename);
            
            const mb = (webmBlob.size / 1_048_576).toFixed(1);
            console.log(`[Recorder] ✓ WebM ready — ${mb} MB — ${filename}`);

            if (typeof UI !== 'undefined' && UI.showToast) {
                UI.showToast(`WebM exported — ${mb} MB`, 'info');
            }

            isProcessing = false;
            setStatus('');
        };

        mediaRecorder.start(CHUNK_MS);
        setStatus('Recording Best…');

        console.log(
            `[Recorder] Started — ${canvas.width}×${canvas.height} @ ${CAPTURE_FPS}fps` +
            ` [${mimeType}] [Best]`
        );
    }

    function stop() {
        if (!isRecording || !mediaRecorder || isProcessing) return;
        mediaRecorder.stop();
        isRecording = false;
        setStatus('Finishing…');
        console.log('[Recorder] Stopped — finalizing WebM…');
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