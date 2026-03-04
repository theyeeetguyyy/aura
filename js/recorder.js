// ============================================================
// AURA — Recording System v2
// canvas.captureStream + MediaRecorder → MP4 1080p with audio
// ============================================================

const Recorder = (() => {
    let mediaRecorder = null;
    let chunks = [];
    let isRecording = false;
    let startTime = 0;

    function start(canvas) {
        if (isRecording) return;

        // Record at native canvas resolution — DO NOT resize the renderer.
        // Forcing 1920×1080 makes the render loop draw a 2MP frame every tick,
        // which tanks the GPU and kills FPS. captureStream(60) is a browser hint;
        // actual FPS is determined by how fast the canvas is being painted.
        // At native res the render loop stays fast and the capture hits true 60fps.
        const videoStream = canvas.captureStream(60);
        const audioStream = AudioEngine.getAudioStream();

        // Combine video + audio streams
        const combinedStream = new MediaStream();
        videoStream.getTracks().forEach(t => combinedStream.addTrack(t));
        if (audioStream) {
            audioStream.getTracks().forEach(t => combinedStream.addTrack(t));
        }

        // Prefer MP4 (H264+AAC), fallback to WebM VP9, then VP8
        let mimeType, ext;
        if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1.42E01E,mp4a.40.2')) {
            mimeType = 'video/mp4; codecs=avc1.42E01E,mp4a.40.2'; ext = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4'; ext = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')) {
            mimeType = 'video/webm; codecs=vp9,opus'; ext = 'webm';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')) {
            mimeType = 'video/webm; codecs=vp8,opus'; ext = 'webm';
        } else {
            mimeType = 'video/webm'; ext = 'webm';
        }

        mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 16000000 // 16 Mbps for crisp 1080p
        });

        chunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aura_${Date.now()}.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
            chunks = [];
        };

        mediaRecorder.start(100);
        isRecording = true;
        startTime = performance.now();
        const w = canvas.width, h = canvas.height;
        console.log(`🔴 Recording started (${w}×${h} native @ ${mimeType})`);
    }

    function stop() {
        if (!isRecording || !mediaRecorder) return;
        mediaRecorder.stop();
        isRecording = false;
        console.log('⬜ Recording stopped');
    }

    function toggle(canvas) {
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
        getRecordingTime
    };
})();
