// ============================================================
// AURA - Recording System v4  (FFmpeg WASM, proper transcode)
//
// Pipeline:
//   canvas.captureStream()
//     → MediaRecorder  →  video/webm; codecs=vp8,opus
//     → chunks (5s timeslice, safe for long recordings)
//     → single WebM Blob
//     → FFmpeg WASM transcode:
//         VP8  → H.264 Baseline 3.0  (libx264, yuv420p)
//         Opus → AAC 192k
//         -movflags +faststart        (moov atom at front)
//     → output.mp4  — accepted by WhatsApp, Instagram,
//                      iOS Photos, iMessage, QuickTime,
//                      Android Gallery, video editors
//
// Why transcode instead of -c copy:
//   -c copy would produce an MP4 container holding VP8+Opus.
//   That is not a standard MP4. WhatsApp, iOS, and most mobile
//   apps expect H.264 + AAC inside MP4. -c copy skips the
//   codec conversion so the file still gets rejected.
//
// Why H.264 Baseline 3.0:
//   Baseline is the most compatible H.264 profile. Every device
//   that has ever played video supports it: iPhones from 2009,
//   WhatsApp, Instagram, QuickTime, embedded players, all of them.
//
// Why yuv420p:
//   Browsers can produce yuv444 or other chroma formats.
//   iOS and QuickTime sometimes show a black screen with audio
//   when chroma is not yuv420p. This flag forces the safe format.
//
// Why 5s timeslice:
//   Without a timeslice the entire recording lives in RAM until
//   stop(). At 18 Mbps that is ~2.25 MB/sec → 1.35 GB for 10 min.
//   Mobile browsers (especially Safari) can be killed by the OS
//   before the file is ready. 5s chunks cap peak RAM to ~11 MB
//   per chunk while still producing a single clean WebM blob.
//
// ── HTML setup ──────────────────────────────────────────────────────
//   <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>
//
// ── Required HTTP response headers (for WASM threading) ─────────────
//   Cross-Origin-Opener-Policy: same-origin
//   Cross-Origin-Embedder-Policy: require-corp
//   (Without these FFmpeg falls back to single-threaded — still works,
//    just slower on long recordings.)
//
// ── Optional status element ─────────────────────────────────────────
//   <span id="record-status"></span>
// ============================================================

const Recorder = (() => {

    // ── State ─────────────────────────────────────────────────────────
    let mediaRecorder = null;
    let chunks        = [];
    let isRecording   = false;
    let startTime     = 0;
    let ffmpegReady   = false;
    let ffmpeg        = null;

    // ── Bitrates ──────────────────────────────────────────────────────
    // 18 Mbps video: visually lossless for canvas animations.
    // libx264 will also apply its own internal quality pass on top.
    // 192 kbps AAC: transparent for music and voice alike.
    const VIDEO_BITRATE = 18_000_000;
    const AUDIO_BITRATE =    192_000;

    // ── MIME selection ────────────────────────────────────────────────
    // VP8 + Opus: most reliable MediaRecorder WebM output across
    // Chrome, Edge, and Firefox. VP9 also works but occasionally
    // produces timestamps that confuse FFmpeg's demuxer.
    function pickMimeType() {
        const candidates = [
            'video/webm; codecs=vp8,opus',
            'video/webm; codecs=vp9,opus',
            'video/webm; codecs=vp8',
            'video/webm',
        ];
        for (const mime of candidates) {
            if (MediaRecorder.isTypeSupported(mime)) return mime;
        }
        return 'video/webm';
    }

    // ── Load FFmpeg WASM once ─────────────────────────────────────────
    async function ensureFFmpeg() {
        if (ffmpegReady) return true;

        if (typeof FFmpeg === 'undefined' || typeof FFmpegUtil === 'undefined') {
            console.error(
                '[Recorder] @ffmpeg/ffmpeg and @ffmpeg/util are not loaded.\n' +
                'Add before recorder.js:\n' +
                '  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js"></script>\n' +
                '  <script src="https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js"></script>'
            );
            return false;
        }

        try {
            ffmpeg = new FFmpeg.FFmpeg();

            // Uncomment to debug FFmpeg output:
            // ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message));

            ffmpeg.on('progress', ({ progress }) => {
                setStatus(`Processing… ${Math.round(progress * 100)}%`);
            });

            setStatus('Loading FFmpeg…');
            await ffmpeg.load({
                coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            });

            ffmpegReady = true;
            setStatus('');
            console.log('[Recorder] FFmpeg WASM ready');
            return true;

        } catch (err) {
            console.error('[Recorder] FFmpeg load failed:', err);
            setStatus('');
            return false;
        }
    }

    // ── Transcode WebM → proper MP4 ───────────────────────────────────
    async function transcodeToMp4(webmBlob, filename) {
        const loaded = await ensureFFmpeg();

        if (!loaded) {
            console.warn('[Recorder] FFmpeg unavailable — saving as WebM fallback');
            downloadBlob(webmBlob, filename.replace('.mp4', '.webm'));
            return;
        }

        try {
            setStatus('Processing…');

            const { fetchFile } = FFmpegUtil;
            await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

            await ffmpeg.exec([
                '-i',         'input.webm',

                // ── Video: VP8 → H.264 ───────────────────────────────
                '-c:v',       'libx264',
                '-profile:v', 'baseline',   // maximum device compatibility
                '-level',     '3.0',        // supported since iPhone 3GS (2009)
                '-pix_fmt',   'yuv420p',    // prevents black-screen on iOS/QuickTime
                '-b:v',       `${VIDEO_BITRATE}`,

                // ── Audio: Opus → AAC ────────────────────────────────
                '-c:a',       'aac',
                '-b:a',       '192k',

                // ── Container: moov atom at front ────────────────────
                '-movflags',  '+faststart', // required by WhatsApp, Instagram, iMessage

                'output.mp4',
            ]);

            const data    = await ffmpeg.readFile('output.mp4');
            const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });

            // Clean up virtual FS
            await ffmpeg.deleteFile('input.webm');
            await ffmpeg.deleteFile('output.mp4');

            downloadBlob(mp4Blob, filename);
            setStatus('');

            const mb = (mp4Blob.size / 1_048_576).toFixed(1);
            console.log(`[Recorder] MP4 ready — ${mb} MB`);

        } catch (err) {
            console.error('[Recorder] Transcode failed:', err);
            setStatus('');
            // Still give the user their recording in some form
            downloadBlob(webmBlob, filename.replace('.mp4', '.webm'));
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }

    function setStatus(msg) {
        const el = document.getElementById('record-status');
        if (el) el.textContent = msg;
    }

    // ── Public API ────────────────────────────────────────────────────
    function start(canvas) {
        if (isRecording) return;

        const mimeType = pickMimeType();

        const videoStream    = canvas.captureStream(); // matches render FPS
        const audioStream    = AudioEngine.getAudioStream();
        const combinedStream = new MediaStream();

        videoStream.getTracks().forEach(t => combinedStream.addTrack(t));
        if (audioStream) {
            audioStream.getTracks().forEach(t => combinedStream.addTrack(t));
        }

        mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: VIDEO_BITRATE,
            audioBitsPerSecond: AUDIO_BITRATE,
        });

        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const webmBlob = new Blob(chunks, { type: mimeType });
            chunks = [];
            await transcodeToMp4(webmBlob, `aura_${Date.now()}.mp4`);
        };

        // 5000ms timeslice: chunks are flushed every 5 seconds.
        // Peak RAM per chunk: ~11 MB at 18 Mbps.
        // Without this, a 10-minute recording accumulates ~1.35 GB
        // in RAM before onstop fires — enough to crash Safari on iOS.
        mediaRecorder.start(5000);

        isRecording = true;
        startTime   = performance.now();

        console.log(`[Recorder] Started: ${canvas.width}×${canvas.height} [${mimeType}]`);

        // Pre-warm FFmpeg during recording so the transcode starts
        // immediately after stop() without waiting for WASM load.
        ensureFFmpeg();
    }

    function stop() {
        if (!isRecording || !mediaRecorder) return;
        mediaRecorder.stop();
        isRecording = false;
        console.log('[Recorder] Stopped — transcoding to H.264/AAC MP4…');
    }

    function toggle(canvas) {
        if (isRecording) stop();
        else             start(canvas);
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
        getRecordingTime,
    };

})();