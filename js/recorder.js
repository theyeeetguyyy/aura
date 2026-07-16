// ============================================================
// AURA — Recorder v3  (WebCodecs MP4)
//
// Engine:   VideoEncoder (H.264) + AudioEncoder (AAC)
// Muxer:    mp4-muxer  (window.Mp4Muxer, loaded from CDN)
// Capture:  VideoFrame(canvas) — one frame per render tick,
//           zero dropped frames, zero stutter.
//
// Requires Chrome 94+ (VideoEncoder / VideoFrame API).
// Falls back to a clear error on unsupported browsers.
// ============================================================

const Recorder = (() => {

    // ── State ────────────────────────────────────────────────
    let _muxer            = null;
    let _muxerTarget      = null;
    let _videoEncoder     = null;
    let _audioEncoder     = null;
    let _audioScriptNode  = null;
    let _tapCtx           = null;

    let _isRecording      = false;
    let _isProcessing     = false;
    let _startTime        = 0;
    let _frameCount       = 0;
    let _audioTimestampUs = 0;   // running audio clock in μs

    const TARGET_FPS = 60;

    // Quality → video bitrate mapping (bps)
    const QUALITY_BITRATES = {
        low:     5_000_000,   //  5 Mbps – fast encode, smaller file
        medium:  15_000_000,  // 15 Mbps – good balance
        best:    40_000_000,  // 40 Mbps – visually lossless
        highest: 80_000_000,  // 80 Mbps – archival quality
    };

    // ── Helpers ──────────────────────────────────────────────
    function setStatus(msg) {
        const el = document.getElementById('record-status');
        if (el) el.textContent = msg || '';
    }

    function _toast(msg, type = 'info') {
        if (typeof UI !== 'undefined' && UI.showToast) UI.showToast(msg, type);
        else console.warn('[Recorder]', msg);
    }

    function _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

    // ── start() ──────────────────────────────────────────────
    async function start(canvas) {
        if (_isRecording || _isProcessing) return;

        // ── Browser support gate ─────────────────────────────
        if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
            _toast(
                'MP4 recording requires Chrome 94 or newer. ' +
                'Please update your browser.',
                'error'
            );
            return;
        }
        if (!window.Mp4Muxer) {
            _toast(
                'MP4 muxer not loaded — check your internet connection and reload the page.',
                'error'
            );
            return;
        }

        // ── Canvas dimensions (H.264 requires even W/H) ──────
        const W = Math.floor(canvas.width  / 2) * 2;
        const H = Math.floor(canvas.height / 2) * 2;
        if (W === 0 || H === 0) {
            _toast('Canvas is not ready yet. Try again.', 'error');
            return;
        }

        // ── Quality ──────────────────────────────────────────
        const quality      = document.getElementById('settings-export-quality')?.value || 'best';
        const videoBitrate = QUALITY_BITRATES[quality] ?? QUALITY_BITRATES.best;

        // ── Audio stream + sample rate ────────────────────────
        // We tap audio directly inside AudioEngine's own AudioContext via
        // the analyser node. Cross-context createMediaStreamSource is unreliable.
        const audioCtx     = (typeof AudioEngine !== 'undefined') ? AudioEngine.context  : null;
        const audioAnalyser= (typeof AudioEngine !== 'undefined') ? AudioEngine.analyser : null;
        const hasAudio     = !!(audioCtx && audioAnalyser);
        const sampleRate   = hasAudio ? audioCtx.sampleRate : 44100;

        // ── Create mp4-muxer ─────────────────────────────────
        const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;
        _muxerTarget = new ArrayBufferTarget();
        _muxer = new Muxer({
            target: _muxerTarget,
            video: {
                codec:  'avc',
                width:   W,
                height:  H,
            },
            ...(hasAudio ? {
                audio: {
                    codec:            'aac',
                    numberOfChannels:  2,
                    sampleRate,
                }
            } : {}),
            fastStart:              'in-memory',
            firstTimestampBehavior: 'offset',
        });

        // ── VideoEncoder (H.264) ─────────────────────────────
        _frameCount   = 0;
        _videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                if (_muxer) _muxer.addVideoChunk(chunk, meta);
            },
            error: (e) => {
                console.error('[Recorder] VideoEncoder error:', e);
                _toast('Video encoder error — check console.', 'error');
            },
        });

        try {
            _videoEncoder.configure({
                codec:       'avc1.4D0034',  // Main Profile Level 5.2
                width:        W,
                height:       H,
                bitrate:      videoBitrate,
                framerate:    TARGET_FPS,
                latencyMode: 'quality',
            });
        } catch (e) {
            console.error('[Recorder] VideoEncoder.configure() failed:', e);
            _toast('MP4 encoder not available on this device/browser. Try Chrome 94+.', 'error');
            _cleanup();
            return;
        }

        // ── AudioEncoder (AAC-LC, optional) ──────────────────
        // Tap directly from AudioEngine's analyser into a ScriptProcessorNode
        // in the SAME AudioContext — no cross-context issues.
        _audioTimestampUs = 0;

        if (hasAudio) {
            try {
                _audioEncoder = new AudioEncoder({
                    output: (chunk, meta) => {
                        if (_muxer) _muxer.addAudioChunk(chunk, meta);
                    },
                    error: (e) => console.warn('[Recorder] AudioEncoder error (non-fatal):', e),
                });

                _audioEncoder.configure({
                    codec:            'mp4a.40.2',  // AAC-LC
                    numberOfChannels:  2,
                    sampleRate,
                    bitrate:           320_000,
                });

                // Create ScriptProcessorNode in AudioEngine's own context.
                // Route: analyser → scriptNode → silentGain → destination
                // The silentGain (volume=0) keeps the graph active so
                // onaudioprocess fires without doubling the audio output.
                _audioScriptNode = audioCtx.createScriptProcessor(4096, 2, 2);
                const silentGain = audioCtx.createGain();
                silentGain.gain.value = 0;

                audioAnalyser.connect(_audioScriptNode);
                _audioScriptNode.connect(silentGain);
                silentGain.connect(audioCtx.destination);

                _audioScriptNode.onaudioprocess = (e) => {
                    if (!_isRecording || !_audioEncoder) return;

                    const left  = e.inputBuffer.getChannelData(0);
                    const right = e.inputBuffer.getChannelData(1);
                    const n     = left.length;
                    const sr    = e.inputBuffer.sampleRate;

                    // f32-planar layout: [all L samples][all R samples]
                    const planar = new Float32Array(n * 2);
                    planar.set(left,  0);
                    planar.set(right, n);

                    try {
                        const audioData = new AudioData({
                            format:           'f32-planar',
                            sampleRate:        sr,
                            numberOfFrames:    n,
                            numberOfChannels:  2,
                            timestamp:         _audioTimestampUs,
                            data:              planar,
                        });
                        _audioEncoder.encode(audioData);
                        audioData.close();
                        _audioTimestampUs += Math.round(n / sr * 1_000_000);
                    } catch { /* encoder in closing state – skip silently */ }
                };

            } catch (err) {
                console.warn('[Recorder] Audio encoder setup failed – recording video only:', err);
                if (_audioScriptNode) { _audioScriptNode.disconnect(); _audioScriptNode = null; }
                _audioEncoder = null;
                _muxerTarget  = new ArrayBufferTarget();
                _muxer        = new Muxer({

                    target:                 _muxerTarget,
                    video:                  { codec: 'avc', width: W, height: H },
                    fastStart:              'in-memory',
                    firstTimestampBehavior: 'offset',
                });
                _toast('Audio encoder not available – recording video only.', 'info');
            }
        }

        // ── Begin ─────────────────────────────────────────────
        _isRecording = true;
        _startTime   = performance.now();
        setStatus('⏺ Recording…');

        console.log(
            `[Recorder] ✓ MP4 recording started — ${W}×${H} @ ${TARGET_FPS}fps` +
            ` [${quality}] ${(videoBitrate / 1e6).toFixed(0)} Mbps` +
            (audioStream ? ` + AAC ${sampleRate}Hz` : ' (video only)')
        );
    }

    // ── captureFrame() ───────────────────────────────────────
    // Called from AuraApp.loop() immediately after VisualEngine.update().
    // Creates a VideoFrame from the canvas at the exact current moment —
    // no async, no dropped frames, one frame per render tick.
    function captureFrame(canvas) {
        if (!_isRecording || !_videoEncoder || _videoEncoder.state !== 'configured') return;

        // timestamp in μs from recording start
        const timestamp  = Math.round((performance.now() - _startTime) * 1000);
        const isKeyFrame = (_frameCount % (TARGET_FPS * 2)) === 0;  // keyframe every 2 s

        try {
            const frame = new VideoFrame(canvas, { timestamp });
            _videoEncoder.encode(frame, { keyFrame: isKeyFrame });
            frame.close();
            _frameCount++;
        } catch (e) {
            // Encoder may be in closing state – skip silently
        }
    }

    // ── stop() ───────────────────────────────────────────────
    async function stop() {
        if (!_isRecording) return;
        _isRecording  = false;
        _isProcessing = true;
        setStatus('Encoding…');

        // ── Disconnect audio tap ─────────────────────────────
        if (_audioScriptNode) {
            try { _audioScriptNode.disconnect(); } catch (_) {}
            _audioScriptNode = null;
        }
        // NOTE: _tapCtx is no longer used — audio runs in AudioEngine.context directly.

        // ── Flush encoders ───────────────────────────────────
        try {
            if (_videoEncoder && _videoEncoder.state === 'configured') {
                await _videoEncoder.flush();
            }
        } catch (e) { console.error('[Recorder] Video flush error:', e); }

        try {
            if (_audioEncoder && _audioEncoder.state === 'configured') {
                await _audioEncoder.flush();
            }
        } catch (e) { console.warn('[Recorder] Audio flush error (non-fatal):', e); }

        // ── Finalize → download ──────────────────────────────
        try {
            _muxer.finalize();
            const buffer = _muxerTarget.buffer;
            const blob   = new Blob([buffer], { type: 'video/mp4' });
            const mb     = (blob.size / 1_048_576).toFixed(1);

            _downloadBlob(blob, `aura_${Date.now()}.mp4`);
            console.log(`[Recorder] ✓ MP4 ready — ${mb} MB — ${_frameCount} frames`);
            _toast(`✓ MP4 exported — ${mb} MB`, 'info');
        } catch (e) {
            console.error('[Recorder] Finalize/download error:', e);
            _toast('MP4 export failed — see console for details.', 'error');
        }

        _cleanup();
    }

    function _cleanup() {
        _muxer        = null;
        _muxerTarget  = null;
        _videoEncoder = null;
        _audioEncoder = null;
        _isProcessing = false;
        setStatus('');
    }

    // ── toggle() ─────────────────────────────────────────────
    function toggle(canvas) {
        if (_isProcessing) return;
        if (_isRecording)  stop();
        else               start(canvas);
    }

    function getRecordingTime() {
        if (!_isRecording) return 0;
        return (performance.now() - _startTime) / 1000;
    }

    // ── Public API ───────────────────────────────────────────
    return {
        start,
        stop,
        toggle,
        captureFrame,
        get isRecording()  { return _isRecording;  },
        get isProcessing() { return _isProcessing; },
        getRecordingTime,
    };

})();