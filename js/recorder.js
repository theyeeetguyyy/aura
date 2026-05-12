// ============================================================
// AURA - Recording System v2
// canvas.captureStream + MediaRecorder -> MP4 1080p with audio
// ============================================================

const Recorder = (() => {
    let mediaRecorder = null;
    let chunks = [];
    let isRecording = false;
    let startTime = 0;

    function start(canvas) {
        if (isRecording) return;

        // Record at native canvas resolution - DO NOT resize the renderer.
        // Forcing 1920x1080 makes the render loop draw a 2MP frame every tick,
        // which tanks the GPU and kills FPS.
        // captureStream() with no arguments captures every frame painted to the canvas.
        // This ensures the recording FPS matches the render FPS perfectly.
        const videoStream = canvas.captureStream();
        const audioStream = AudioEngine.getAudioStream();

        // Combine video + audio streams
        const combinedStream = new MediaStream();
        videoStream.getTracks().forEach(t => combinedStream.addTrack(t));
        if (audioStream) {
            audioStream.getTracks().forEach(t => combinedStream.addTrack(t));
        }

        // Prefer MP4 output first, with WebM kept as a compatibility fallback.
        let mimeType, ext;
        if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1.640033,mp4a.40.2')) {
            // High Profile 5.1
            mimeType = 'video/mp4; codecs=avc1.640033,mp4a.40.2';
            ext = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1.4d002a,mp4a.40.2')) {
            // Main Profile 4.2
            mimeType = 'video/mp4; codecs=avc1.4d002a,mp4a.40.2';
            ext = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            ext = 'mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')) {
            mimeType = 'video/webm; codecs=vp9,opus';
            ext = 'webm';
        } else {
            mimeType = 'video/webm';
            ext = 'webm';
        }

        mediaRecorder = new MediaRecorder(combinedStream, {
            mimeType,
            videoBitsPerSecond: 100000000, // 100 Mbps for 4K-ready sharpness
            audioBitsPerSecond: 320000 // 320 kbps for studio audio quality
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
        const w = canvas.width;
        const h = canvas.height;
        console.log(`Recording started (${w}x${h} native @ ${mimeType})`);
    }

    function stop() {
        if (!isRecording || !mediaRecorder) return;
        mediaRecorder.stop();
        isRecording = false;
        console.log('Recording stopped');
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
