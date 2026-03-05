// ============================================================
// AURA — Audio Engine v4
// Structure-aware + comprehensive analysis: per-band dynamics,
// volume/loudness, transient/onset, harmonic, rhythm, spectral
// dynamics, micro-dynamics
// ============================================================

const AudioEngine = (() => {
    let ctx = null;
    let analyser = null;
    let gainNode = null;
    let sourceNode = null;
    let audioElement = null;
    let mediaStreamDest = null;

    // Analysis arrays
    const DUMMY_SIZE = 1024;
    let freqData = new Uint8Array(DUMMY_SIZE);
    let timeData = new Uint8Array(DUMMY_SIZE);
    let prevFreqData = new Float32Array(DUMMY_SIZE);
    let prevTimeData = new Float32Array(DUMMY_SIZE); // v4: for micro-dynamics
    let prevBassSnapshotBuf = new Float32Array(64); // pre-allocated for detectBeat
    let prevBlobUrl = null; // track blob URL for cleanup

    // Beat detection state
    let lastBeatTime = 0;
    let spectralFluxHistory = [];
    let bassFluxHistory = [];
    const FLUX_HISTORY_SIZE = 30;
    const BASS_FLUX_SIZE = 15;

    // Energy tracking
    let energyHistory = [];
    const ENERGY_WINDOW_SHORT = 30;
    const ENERGY_WINDOW_LONG = 180;
    let dropCooldown = 0;

    // Wobble tracking
    let prevBassVal = 0;
    let wobbleZeroCrossings = 0;
    let wobbleWindowCounter = 0;
    const WOBBLE_WINDOW = 30;
    let _wobblePeakTimes = [];
    let _wobbleRateSmooth = 0;
    let _wobblePeakState = false;

    // Tearout detectors — state
    let _gunPeakSub = 0;
    let _gunPeakHeld = 0;
    const GUN_THRESHOLD = 0.58;
    const GUN_DECAY_FRAMES = 10;
    let _gunDecayCounter = 0;

    let _prevFundamental = 0;
    let _sirenRiseScore = 0;
    let _sirenFallScore = 0;

    let _screechSustain = 0;

    let _subSustainFrames = 0;

    let _tapTimes = [];

    // ── v3: Structure analysis state ──
    let volumeLevel = 1.0;
    let prevSectionType = null;
    let sectionTransitionTime = 0;
    let transitionFade = 0;
    let anticipation = 0;
    let sectionDuration = 0;
    let sectionStartTime = 0;

    // BPM estimation
    let beatTimes = [];
    let estimatedBPM = 140;

    // Spectral analysis
    let spectralFlatness = 0;
    let spectralRolloff = 0;

    // ── v4: Per-band dynamics state ──
    const BAND_NAMES = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
    const bandPeakDecay = {};
    const bandVelocity = {};
    const bandPrevValues = {};
    const bandFluxHistories = {};
    for (const b of BAND_NAMES) {
        bandPeakDecay[b] = 0;
        bandVelocity[b] = 0;
        bandPrevValues[b] = 0;
        bandFluxHistories[b] = [];
    }

    // ── v4: Transient/onset state ──
    let onsetHistory = [];
    const ONSET_HISTORY_SIZE = 60;
    let lastOnsetTime = 0;
    let attackPhaseValue = 0;
    let envelopeValue = 0;
    let prevRMS = 0;
    let rmsVelocity = 0;

    // ── v4: Rhythm state ──
    let onsetTimes = [];
    const ONSET_TIMES_SIZE = 40;

    // ── v4: Loudness state ──
    let loudnessHistory = [];
    const LOUDNESS_HISTORY_SIZE = 120;
    let volumeEnvelopeValue = 0;

    // ── v4: Micro-dynamics state ──
    let modulationHistory = [];
    const MODULATION_HISTORY_SIZE = 30;
    let prevFrameEnergy = 0;

    // 1.6/1.7: Pre-allocated buffers for hot-path analysis
    const _entropyBins = new Uint32Array(32);
    const _windowRMS = new Float32Array(16);
    const _bandValues = new Float32Array(7);

    // 2.3: Frame counter for analysis throttling
    let _analysisFrame = 0;

    // Audio data bus — THE data all modes consume
    const audioBus = {
        frequencyData: freqData,
        timeDomainData: timeData,

        // ── 7-band analysis ──
        bands: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        smoothBands: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        normalizedBands: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        rawBands: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },

        // ── v4: Per-band dynamics ──
        bandPeaks: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        bandVelocity: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        bandFlux: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        // Band ratios
        bassToTreble: 0,
        lowToHigh: 0,
        subWeight: 0,
        midScoopRatio: 0,         // dip in mids vs bass+treble

        // ── Core metrics ──
        rms: 0,
        peak: 0,
        spectralCentroid: 0,
        waveformPoints: new Array(256).fill(0),

        // ── v4: Volume & loudness ──
        loudness: 0,              // A-weighted RMS approximation
        loudnessSmooth: 0,        // smoothed loudness
        dynamicRange: 0,          // peak / rms ratio
        crestFactor: 0,           // peak / rms (punchiness)
        silenceDetected: false,   // true when audio is essentially silent
        volumeEnvelope: 0,        // smoothed volume envelope

        // ── Beat detection ──
        beat: false,
        beatIntensity: 0,
        beatCount: 0,

        // ── Bass beat ──
        bassBeat: false,
        bassBeatIntensity: 0,

        // ── Drop detection ──
        isDrop: false,
        dropIntensity: 0,
        dropDecay: 0,
        isBuildUp: false,

        // ── Energy tracking ──
        energy: 0,
        energySmooth: 0,
        energyDelta: 0,
        energyRatio: 0,

        // ── Wobble detection ──
        wobblePhase: 0,
        wobbleIntensity: 0,
        wobbleRateHz: 0,
        wobbleLFO: 0,

        // ── v4: Transient / onset detection ──
        onsetDetected: false,     // true on every attack/transient
        onsetStrength: 0,         // how strong the onset is (0-1)
        attackPhase: 0,           // 0→1 during attack then decays
        sustainLevel: 0,          // current sustain level
        envelope: 0,              // ADSR-style envelope follower (0-1)

        // ── v4: Harmonic & pitch analysis ──
        harmonicRatio: 0,         // harmonic vs noisy (0=noise, 1=tonal)
        pitchClass: 0,            // estimated dominant pitch bin (0-11)
        chordDensity: 0,          // how many freq peaks are active (0-1)
        fundamentalFreq: 0,       // estimated fundamental frequency in Hz

        // ── v4: Rhythm & groove ──
        rhythmicDensity: 0,       // onsets per second (0-1 normalized)
        groove: 0,                // swing/shuffle detection (0=straight, 1=swung)
        rhythmComplexity: 0,      // entropy of onset pattern (0-1)
        barPhase: 0,              // 0-1 phase within estimated bar

        // ── v4: Spectral dynamics ──
        spectralFluxBands: { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, brilliance: 0 },
        spectralContrast: 0,      // peaks vs valleys in spectrum (0-1)
        spectralTilt: 0,          // negative=bass-heavy, positive=bright (-1 to 1)
        spectralSpread: 0,        // how wide the frequency content is (0-1)

        // ── v4: Micro-dynamics ──
        zeroCrossingRate: 0,      // rate of zero crossings (0-1 normalized)
        signalEntropy: 0,         // unpredictability (0=silence, 1=noise)
        modulationDepth: 0,       // amplitude modulation / tremolo (0-1)
        microVariation: 0,        // frame-to-frame jitter index (0-1)

        // ── v3: Structure-aware data ──
        sectionType: null,
        sectionIntensity: 1.0,
        sectionProgress: 0,
        isHighEnergy: false,
        isCalm: false,
        isBuildingUp: false,
        isBreakdown: false,

        // Anticipation
        anticipation: 0,
        transitionFade: 0,

        // Volume-weighted intensity
        volumeScale: 1.0,
        masterIntensity: 1.0,

        // BPM
        bpm: 140,
        beatPhase: 0,

        // Spectral features
        spectralFlatness: 0,
        spectralRolloff: 0,
        brightness: 0,

        // Playback state
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        loaded: false,

        // Section effects from markers (populated by updateSectionAwareness)
        sectionEffects: { shake: 1, flash: 1, zoom: 1, bloom: 1, speed: 1, particleScale: 1, displacementScale: 1 },
        colorTemp: 'neutral',
        sectionChanged: false,
        prevSectionType: null,

        // Drop chaos state (from markers)
        isDropSection: false,
        dropSectionIntensity: 0,

        // Tearout-specific detectors
        gunShotDetected: false,
        gunShotIntensity: 0,
        gunShotDecay: 0,
        sirenRising: 0,
        sirenFalling: 0,
        sirenIntensity: 0,
        sirenFrequency: 0,
        screechDetected: false,
        screechIntensity: 0,
        screechPitch: 0,
        subSustain: 0,
        hasSustainedBass: false,
        subSustainPeak: 0
    };

    // Band ranges (fftSize=4096, sampleRate=44100, bin ≈ 10.77 Hz)
    const bandRanges = {
        sub: [0, 6],         // 0–65 Hz
        bass: [6, 16],       // 65–172 Hz
        lowMid: [16, 36],    // 172–387 Hz
        mid: [36, 80],       // 387–860 Hz
        highMid: [80, 160],  // 860–1720 Hz
        treble: [160, 360],  // 1720–3870 Hz
        brilliance: [360, 1024]  // 3870–11025 Hz
    };

    // A-weighting approximation curve per band (relative dB correction)
    const aWeightApprox = {
        sub: 0.1,        // heavily attenuated at low freq
        bass: 0.3,
        lowMid: 0.6,
        mid: 1.0,        // reference
        highMid: 1.2,
        treble: 1.0,
        brilliance: 0.7
    };

    function init() {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.82; // was 0.5 — higher = smoother, more graceful motion

        gainNode = ctx.createGain();
        gainNode.connect(analyser);
        analyser.connect(ctx.destination);

        mediaStreamDest = ctx.createMediaStreamDestination();
        analyser.connect(mediaStreamDest);

        const bufLen = analyser.frequencyBinCount;
        freqData = new Uint8Array(bufLen);
        timeData = new Uint8Array(bufLen);
        prevFreqData = new Float32Array(bufLen);
        prevTimeData = new Float32Array(bufLen);

        audioBus.frequencyData = freqData;
        audioBus.timeDomainData = timeData;

        audioElement = document.createElement('audio');
        audioElement.crossOrigin = 'anonymous';
        audioElement.addEventListener('timeupdate', () => {
            audioBus.currentTime = audioElement.currentTime;
            audioBus.duration = audioElement.duration || 0;
        });
        audioElement.addEventListener('ended', () => {
            if (audioElement.loop) {
                audioElement.currentTime = 0;
                audioElement.play();
            } else {
                audioBus.isPlaying = false;
            }
        });
        audioElement.addEventListener('loadedmetadata', () => { audioBus.duration = audioElement.duration; });
    }

    async function loadFile(file) {
        if (!ctx) init();
        if (ctx.state === 'suspended') await ctx.resume();

        // Revoke previous blob URL to prevent memory leak
        if (prevBlobUrl) URL.revokeObjectURL(prevBlobUrl);
        const url = URL.createObjectURL(file);
        prevBlobUrl = url;
        audioElement.src = url;
        audioElement.loop = false; // Reset loop state between tracks

        if (!sourceNode) {
            sourceNode = ctx.createMediaElementSource(audioElement);
            sourceNode.connect(gainNode);
        }

        audioBus.loaded = true;
        audioBus.currentTime = 0;

        // Reset all analysis state
        energyHistory = [];
        spectralFluxHistory = [];
        bassFluxHistory = [];
        beatTimes = [];
        onsetHistory = [];
        onsetTimes = [];
        loudnessHistory = [];
        modulationHistory = [];
        for (const b of BAND_NAMES) {
            bandPeakDecay[b] = 0;
            bandVelocity[b] = 0;
            bandPrevValues[b] = 0;
            bandFluxHistories[b] = [];
        }
        prevRMS = 0;
        rmsVelocity = 0;
        attackPhaseValue = 0;
        envelopeValue = 0;
        volumeEnvelopeValue = 0;
        prevFrameEnergy = 0;

        return new Promise((resolve) => {
            audioElement.addEventListener('canplaythrough', () => {
                audioBus.duration = audioElement.duration;
                resolve();
            }, { once: true });
        });
    }

    function play() {
        if (!audioElement || !audioBus.loaded) return;
        if (ctx.state === 'suspended') ctx.resume();
        audioElement.play();
        audioBus.isPlaying = true;
    }

    function pause() {
        if (!audioElement) return;
        audioElement.pause();
        audioBus.isPlaying = false;
    }

    function togglePlay() {
        if (audioBus.isPlaying) pause();
        else play();
    }

    function seek(time) {
        if (!audioElement || !audioBus.loaded) return;
        audioElement.currentTime = Math.max(0, Math.min(time, audioBus.duration));
        audioBus.currentTime = audioElement.currentTime;
    }

    function seekRelative(delta) {
        seek((audioElement?.currentTime || 0) + delta);
    }

    function setVolume(v) {
        v = Math.max(0, Math.min(v, 1));
        if (gainNode) gainNode.gain.value = v;
        volumeLevel = v;
    }

    function getVolume() {
        return gainNode ? gainNode.gain.value : 1;
    }

    function getAudioStream() {
        return mediaStreamDest ? mediaStreamDest.stream : null;
    }

    // ═══════════════════════════════════════════════════════════
    // ANALYSIS FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    function computeBands() {
        for (const [band, [lo, hi]] of Object.entries(bandRanges)) {
            let sum = 0;
            let max = 0;
            const count = hi - lo;
            for (let i = lo; i < hi && i < freqData.length; i++) {
                const v = freqData[i];
                sum += v;
                if (v > max) max = v;
            }
            const avg = sum / count / 255;

            // Raw (instant) bands
            audioBus.rawBands[band] = avg;

            // Regular bands
            audioBus.bands[band] = avg;

            // Smooth bands — slower attack/decay = graceful, cinematic feel
            const current = audioBus.smoothBands[band];
            const attackRate = audioBus.isHighEnergy ? 0.35 : 0.22; // was 0.65/0.5
            const decayRate = audioBus.isHighEnergy ? 0.10 : 0.07;  // was 0.2/0.12

            if (avg > current) {
                audioBus.smoothBands[band] += (avg - current) * attackRate;
            } else {
                audioBus.smoothBands[band] += (avg - current) * decayRate;
            }
            audioBus.normalizedBands[band] = audioBus.smoothBands[band];
        }
    }

    // ── v4: Per-band dynamics ──
    function computeBandDynamics() {
        for (const band of BAND_NAMES) {
            const val = audioBus.smoothBands[band];

            // Peak tracking with slow decay
            if (val > bandPeakDecay[band]) {
                bandPeakDecay[band] = val;
            } else {
                bandPeakDecay[band] *= 0.995; // slow decay (~3s to halve)
            }
            audioBus.bandPeaks[band] = bandPeakDecay[band];

            // Velocity (rate of change)
            const velocity = val - bandPrevValues[band];
            bandVelocity[band] += (velocity - bandVelocity[band]) * 0.3;
            audioBus.bandVelocity[band] = bandVelocity[band];

            // Per-band spectral flux
            const flux = Math.max(0, velocity);
            bandFluxHistories[band].push(flux);
            if (bandFluxHistories[band].length > 15) bandFluxHistories[band].shift();
            const avgFlux = bandFluxHistories[band].reduce((a, b) => a + b, 0) / bandFluxHistories[band].length;
            audioBus.bandFlux[band] = flux;
            audioBus.spectralFluxBands[band] = avgFlux;

            bandPrevValues[band] = val;
        }

        // Band ratios
        const bassEnergy = audioBus.smoothBands.sub + audioBus.smoothBands.bass;
        const trebleEnergy = audioBus.smoothBands.treble + audioBus.smoothBands.brilliance;
        const lowEnergy = audioBus.smoothBands.sub + audioBus.smoothBands.bass + audioBus.smoothBands.lowMid;
        const highEnergy = audioBus.smoothBands.highMid + audioBus.smoothBands.treble + audioBus.smoothBands.brilliance;
        const midEnergy = audioBus.smoothBands.lowMid + audioBus.smoothBands.mid + audioBus.smoothBands.highMid;
        const totalBands = lowEnergy + midEnergy + highEnergy;

        audioBus.bassToTreble = trebleEnergy > 0.001 ? Math.min(5, bassEnergy / trebleEnergy) : 0;
        audioBus.lowToHigh = highEnergy > 0.001 ? Math.min(5, lowEnergy / highEnergy) : 0;
        audioBus.subWeight = totalBands > 0.001 ? audioBus.smoothBands.sub / totalBands : 0;

        // Mid scoop: (bass+treble) / (mid) — high when mids are scooped
        const flanks = bassEnergy + trebleEnergy;
        const mids = audioBus.smoothBands.lowMid + audioBus.smoothBands.mid + audioBus.smoothBands.highMid;
        audioBus.midScoopRatio = mids > 0.001 ? Math.min(3, flanks / mids) : 0;
    }

    function computeRMS() {
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sum += v * v;
        }
        audioBus.rms = Math.sqrt(sum / timeData.length);
    }

    function computePeak() {
        let max = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = Math.abs(timeData[i] - 128) / 128;
            if (v > max) max = v;
        }
        audioBus.peak = max;
    }

    // ── v4: Volume & loudness metrics ──
    function computeLoudness() {
        // A-weighted loudness approximation
        let weightedEnergy = 0;
        for (const band of BAND_NAMES) {
            weightedEnergy += audioBus.smoothBands[band] * aWeightApprox[band];
        }
        audioBus.loudness = Math.min(1, weightedEnergy / BAND_NAMES.length * 2);

        // Smooth loudness
        audioBus.loudnessSmooth += (audioBus.loudness - audioBus.loudnessSmooth) * 0.08;

        // Loudness history
        loudnessHistory.push(audioBus.loudness);
        if (loudnessHistory.length > LOUDNESS_HISTORY_SIZE) loudnessHistory.shift();

        // Dynamic range (peak / rms) — higher = more dynamic
        audioBus.crestFactor = audioBus.rms > 0.001 ? Math.min(5, audioBus.peak / audioBus.rms) : 0;
        audioBus.dynamicRange = audioBus.crestFactor; // alias for clarity

        // Silence detection
        audioBus.silenceDetected = audioBus.rms < 0.005 && audioBus.peak < 0.02;

        // Volume envelope (slow follower)
        const envelopeTarget = audioBus.rms;
        if (envelopeTarget > volumeEnvelopeValue) {
            volumeEnvelopeValue += (envelopeTarget - volumeEnvelopeValue) * 0.3;
        } else {
            volumeEnvelopeValue += (envelopeTarget - volumeEnvelopeValue) * 0.05;
        }
        audioBus.volumeEnvelope = volumeEnvelopeValue;
    }

    function detectBeat() {
        // === GENERAL BEAT (full spectrum flux) ===
        let flux = 0;
        const bassEnd = Math.min(bandRanges.lowMid[1], freqData.length);
        // Reuse pre-allocated buffer instead of allocating every frame
        if (prevBassSnapshotBuf.length < bassEnd) prevBassSnapshotBuf = new Float32Array(bassEnd);
        for (let i = 0; i < bassEnd; i++) prevBassSnapshotBuf[i] = prevFreqData[i];

        for (let i = 0; i < freqData.length; i++) {
            const diff = freqData[i] / 255 - prevFreqData[i];
            if (diff > 0) flux += diff;
            prevFreqData[i] = freqData[i] / 255;
        }

        spectralFluxHistory.push(flux);
        if (spectralFluxHistory.length > FLUX_HISTORY_SIZE) spectralFluxHistory.shift();

        let avgFlux = spectralFluxHistory.reduce((a, b) => a + b, 0) / spectralFluxHistory.length;

        const now = performance.now();
        const beatThreshold = audioBus.isHighEnergy ? 1.1 : 1.25;
        const beatCooldown = audioBus.isHighEnergy ? 80 : 120;
        const isBeat = flux > avgFlux * beatThreshold &&
            flux > 0.08 &&
            (now - lastBeatTime) > beatCooldown;

        if (isBeat) {
            audioBus.beat = true;
            audioBus.beatIntensity = Math.min(1, (flux - avgFlux) / (avgFlux + 0.001));
            audioBus.beatCount++;
            lastBeatTime = now;

            // BPM estimation
            beatTimes.push(now);
            if (beatTimes.length > 20) beatTimes.shift();
            if (beatTimes.length > 4) {
                let intervals = [];
                for (let i = 1; i < beatTimes.length; i++) {
                    const interval = beatTimes[i] - beatTimes[i - 1];
                    if (interval > 200 && interval < 1500) intervals.push(interval);
                }
                if (intervals.length > 3) {
                    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    estimatedBPM = Math.round(60000 / avgInterval);
                    audioBus.bpm = Math.max(60, Math.min(200, estimatedBPM));
                }
            }
        } else {
            audioBus.beat = false;
            audioBus.beatIntensity *= 0.9;
        }

        // Beat phase (0-1 cycle)
        const beatInterval = 60000 / audioBus.bpm;
        audioBus.beatPhase = ((now - lastBeatTime) % beatInterval) / beatInterval;

        // Bar phase (0-1 within 4-beat bar)
        const barInterval = beatInterval * 4;
        audioBus.barPhase = ((now - lastBeatTime) % barInterval) / barInterval;

        // === BASS BEAT ===
        let bassFlux = 0;
        for (let i = 0; i < bassEnd; i++) {
            const diff = freqData[i] / 255 - prevBassSnapshotBuf[i];
            if (diff > 0) bassFlux += diff * 2;
        }

        bassFluxHistory.push(bassFlux);
        if (bassFluxHistory.length > BASS_FLUX_SIZE) bassFluxHistory.shift();

        let avgBassFlux = bassFluxHistory.reduce((a, b) => a + b, 0) / bassFluxHistory.length;

        const bassThreshold = audioBus.isHighEnergy ? 1.05 : 1.15;
        const isBassBeat = bassFlux > avgBassFlux * bassThreshold &&
            bassFlux > 0.04 &&
            audioBus.rawBands.sub + audioBus.rawBands.bass > 0.2;

        if (isBassBeat) {
            audioBus.bassBeat = true;
            audioBus.bassBeatIntensity = Math.min(1.5, (bassFlux - avgBassFlux) / (avgBassFlux + 0.001));
        } else {
            audioBus.bassBeat = false;
            audioBus.bassBeatIntensity *= 0.85;
        }
    }

    // ── v4: Transient / onset detection ──
    function detectOnsets() {
        const now = performance.now();

        // RMS velocity (rate of change of loudness)
        const currentRMS = audioBus.rms;
        const rmsChange = currentRMS - prevRMS;
        rmsVelocity += (rmsChange - rmsVelocity) * 0.4;

        // Onset = sudden increase in energy across multiple bands
        let onsetScore = 0;
        for (const band of BAND_NAMES) {
            const vel = audioBus.bandVelocity[band];
            if (vel > 0) onsetScore += vel;
        }
        // Weight by RMS velocity for stronger detection
        onsetScore *= (1 + Math.max(0, rmsVelocity) * 10);

        onsetHistory.push(onsetScore);
        if (onsetHistory.length > ONSET_HISTORY_SIZE) onsetHistory.shift();

        const avgOnset = onsetHistory.reduce((a, b) => a + b, 0) / onsetHistory.length;
        const onsetThreshold = 1.3;
        const onsetCooldown = 50; // ms

        const isOnset = onsetScore > avgOnset * onsetThreshold &&
            onsetScore > 0.02 &&
            (now - lastOnsetTime) > onsetCooldown;

        if (isOnset) {
            audioBus.onsetDetected = true;
            audioBus.onsetStrength = Math.min(1, (onsetScore - avgOnset) / (avgOnset + 0.001));
            attackPhaseValue = 1.0;
            lastOnsetTime = now;

            // Track onset times for rhythm analysis
            onsetTimes.push(now);
            if (onsetTimes.length > ONSET_TIMES_SIZE) onsetTimes.shift();
        } else {
            audioBus.onsetDetected = false;
            audioBus.onsetStrength *= 0.85;
        }

        // Attack phase (fast rise, slow decay)
        attackPhaseValue *= 0.92;
        audioBus.attackPhase = attackPhaseValue;

        // Sustain level (current energy relative to peak)
        audioBus.sustainLevel = audioBus.rms > 0.001 ? Math.min(1, audioBus.rms / (audioBus.peak + 0.001)) : 0;

        // Envelope follower (ADSR-style)
        const envelopeTarget = audioBus.rms;
        if (envelopeTarget > envelopeValue) {
            envelopeValue += (envelopeTarget - envelopeValue) * 0.6; // fast attack
        } else {
            envelopeValue += (envelopeTarget - envelopeValue) * 0.04; // slow release
        }
        audioBus.envelope = Math.min(1, envelopeValue * 2);

        prevRMS = currentRMS;
    }

    function detectDrop() {
        const e = audioBus.rawBands.sub * 3 +
            audioBus.rawBands.bass * 2.5 +
            audioBus.rawBands.lowMid * 1.5 +
            audioBus.rms;

        audioBus.energy = e;
        audioBus.energySmooth += (e - audioBus.energySmooth) * 0.1;

        energyHistory.push(e);
        if (energyHistory.length > ENERGY_WINDOW_LONG) energyHistory.shift();

        if (energyHistory.length < ENERGY_WINDOW_SHORT) return;

        const shortWindow = energyHistory.slice(-ENERGY_WINDOW_SHORT);
        const shortAvg = shortWindow.reduce((a, b) => a + b, 0) / shortWindow.length;
        const longAvg = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;

        audioBus.energyRatio = longAvg > 0.01 ? shortAvg / longAvg : 1;
        audioBus.energyDelta = shortAvg - longAvg;

        audioBus.isBuildUp = audioBus.energyRatio < 0.5 && longAvg > 0.1;

        if (dropCooldown > 0) {
            dropCooldown--;
            audioBus.isDrop = false;
        } else {
            const dropThreshRatio = audioBus.isHighEnergy ? 1.5 : 2.0;
            const dropThreshEnergy = audioBus.isHighEnergy ? 0.2 : 0.3;
            const dropThreshDelta = audioBus.isHighEnergy ? 0.1 : 0.15;

            if (audioBus.energyRatio > dropThreshRatio && shortAvg > dropThreshEnergy && audioBus.energyDelta > dropThreshDelta) {
                audioBus.isDrop = true;
                audioBus.dropIntensity = Math.min(1, (audioBus.energyRatio - 1.5) / 2);
                audioBus.dropDecay = 1;
                dropCooldown = 45;
            } else {
                audioBus.isDrop = false;
            }
        }

        audioBus.dropDecay *= 0.97;
    }

    function detectWobble() {
        const now = performance.now();
        const bassVal = audioBus.smoothBands.bass + audioBus.smoothBands.lowMid * 0.7;
        const threshold = 0.3;

        // Peak detection: rising above threshold
        if (bassVal > threshold && !_wobblePeakState) {
            _wobblePeakState = true;
            _wobblePeakTimes.push(now);
            if (_wobblePeakTimes.length > 16) _wobblePeakTimes.shift();
        } else if (bassVal < threshold * 0.7) {
            _wobblePeakState = false;
        }

        // Estimate rate from inter-peak intervals
        if (_wobblePeakTimes.length >= 3) {
            const intervals = [];
            for (let i = 1; i < _wobblePeakTimes.length; i++) {
                const interval = _wobblePeakTimes[i] - _wobblePeakTimes[i - 1];
                if (interval > 40 && interval < 1000) intervals.push(interval);
            }
            if (intervals.length >= 2) {
                const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
                const rawRate = 1000 / avgInterval;
                _wobbleRateSmooth += (rawRate - _wobbleRateSmooth) * 0.08;
            }
        }

        audioBus.wobbleRateHz = _wobbleRateSmooth;

        // Advance wobble phase at detected rate, accumulate
        const wobbleIncrement = (_wobbleRateSmooth > 0.5 ? _wobbleRateSmooth : 4.0) / 60;
        audioBus.wobblePhase = (audioBus.wobblePhase + wobbleIncrement) % 1;
        audioBus.wobbleLFO = Math.sin(audioBus.wobblePhase * Math.PI * 2);

        // Keep intensity from zero-crossing method for compatibility
        const mean = (bassVal + prevBassVal) / 2;
        if ((bassVal - mean) * (prevBassVal - mean) < 0) wobbleZeroCrossings++;
        wobbleWindowCounter++;
        if (wobbleWindowCounter >= WOBBLE_WINDOW) {
            const rate = wobbleZeroCrossings / WOBBLE_WINDOW;
            audioBus.wobbleIntensity = Math.min(1, rate * 5);
            wobbleZeroCrossings = 0;
            wobbleWindowCounter = 0;
        }
        prevBassVal = bassVal;
    }

    // ── Tearout Detector: Gun Shot / 808 Transient ──
    function detectGunShot() {
        const sub = audioBus.rawBands.sub;
        if (sub > _gunPeakSub) {
            _gunPeakSub = sub;
            _gunPeakHeld = 0;
        } else {
            _gunPeakHeld++;
        }
        const collapsed = sub < _gunPeakSub * 0.35;
        const wasLoud = _gunPeakSub > GUN_THRESHOLD;
        const recentOnset = audioBus.onsetStrength > 0.2;
        const notSustained = _gunPeakHeld > 2;
        if (wasLoud && collapsed && recentOnset && notSustained && _gunDecayCounter === 0) {
            audioBus.gunShotDetected = true;
            audioBus.gunShotIntensity = Math.min(1, _gunPeakSub);
            _gunDecayCounter = GUN_DECAY_FRAMES;
            _gunPeakSub = 0;
            _gunPeakHeld = 0;
        } else {
            audioBus.gunShotDetected = false;
        }
        if (_gunDecayCounter > 0) _gunDecayCounter--;
        audioBus.gunShotDecay = _gunDecayCounter / GUN_DECAY_FRAMES;
        if (_gunPeakHeld > 15) _gunPeakSub *= 0.97;
    }

    // ── Tearout Detector: Siren / Pitch Sweep ──
    function detectSiren() {
        const freq = audioBus.fundamentalFreq;
        if (freq < 100 || freq > 8000) {
            _sirenRiseScore *= 0.93;
            _sirenFallScore *= 0.93;
            _prevFundamental = freq;
            audioBus.sirenRising = _sirenRiseScore;
            audioBus.sirenFalling = _sirenFallScore;
            audioBus.sirenIntensity = Math.max(_sirenRiseScore, _sirenFallScore);
            return;
        }
        const delta = freq - _prevFundamental;
        const isTonal = audioBus.harmonicRatio > 0.35;
        const hasMidEnergy = audioBus.smoothBands.mid + audioBus.smoothBands.highMid > 0.3;
        if (isTonal && hasMidEnergy) {
            if (delta > 5) {
                _sirenRiseScore = Math.min(1, _sirenRiseScore + Math.min(0.1, delta / 200));
                _sirenFallScore *= 0.90;
            } else if (delta < -5) {
                _sirenFallScore = Math.min(1, _sirenFallScore + Math.min(0.1, -delta / 200));
                _sirenRiseScore *= 0.90;
            } else {
                _sirenRiseScore *= 0.96;
                _sirenFallScore *= 0.96;
            }
        } else {
            _sirenRiseScore *= 0.92;
            _sirenFallScore *= 0.92;
        }
        audioBus.sirenRising = _sirenRiseScore;
        audioBus.sirenFalling = _sirenFallScore;
        audioBus.sirenIntensity = Math.max(_sirenRiseScore, _sirenFallScore);
        audioBus.sirenFrequency = freq;
        _prevFundamental = freq;
    }

    // ── Tearout Detector: Screech / Scream Bass ──
    function detectScreech() {
        const highBandEnergy = audioBus.smoothBands.highMid * 1.5 + audioBus.smoothBands.treble;
        const isTonal = audioBus.harmonicRatio > 0.3;
        const isSustained = audioBus.sustainLevel > 0.4;
        const notJustNoise = audioBus.spectralFlatness < 0.6;
        if (highBandEnergy > 0.45 && isTonal && isSustained && notJustNoise) {
            _screechSustain = Math.min(1, _screechSustain + 0.04);
        } else {
            _screechSustain = Math.max(0, _screechSustain - 0.025);
        }
        audioBus.screechDetected = _screechSustain > 0.25;
        audioBus.screechIntensity = _screechSustain;
        audioBus.screechPitch = audioBus.fundamentalFreq > 0
            ? Math.min(1, (audioBus.fundamentalFreq - 500) / 3000) : 0;
    }

    // ── Tearout Detector: Sustained Sub / Reese Bass ──
    function detectSubSustain() {
        const subLevel = audioBus.smoothBands.sub + audioBus.smoothBands.bass * 0.5;
        if (subLevel > 0.25 && audioBus.rms > 0.08) {
            _subSustainFrames = Math.min(150, _subSustainFrames + 1);
            audioBus.subSustainPeak = Math.max(audioBus.subSustainPeak, subLevel);
        } else {
            _subSustainFrames = Math.max(0, _subSustainFrames - 4);
            if (_subSustainFrames === 0) audioBus.subSustainPeak = 0;
        }
        audioBus.subSustain = _subSustainFrames / 150;
        audioBus.hasSustainedBass = _subSustainFrames > 15;
    }

    // ── Tap BPM (T key) ──
    function tapBPM() {
        const now = performance.now();
        _tapTimes.push(now);
        if (_tapTimes.length > 8) _tapTimes.shift();
        if (_tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < _tapTimes.length; i++) intervals.push(_tapTimes[i] - _tapTimes[i - 1]);
            const avg = intervals.reduce((a, b) => a + b) / intervals.length;
            audioBus.bpm = Math.max(60, Math.min(220, Math.round(60000 / avg)));
            lastBeatTime = now;
        }
    }

    function computeWaveformPoints() {
        const pts = [];
        const step = Math.max(1, Math.floor(timeData.length / 256));
        for (let i = 0; i < timeData.length; i += step) {
            pts.push((timeData[i] - 128) / 128);
        }
        audioBus.waveformPoints = pts;
    }

    function computeSpectralCentroid() {
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < freqData.length; i++) {
            weightedSum += i * freqData[i];
            totalWeight += freqData[i];
        }
        audioBus.spectralCentroid = totalWeight > 0 ? weightedSum / totalWeight / freqData.length : 0;
    }

    // ── v3: Spectral features ──
    function computeSpectralFeatures() {
        // Spectral flatness (noise vs tone)
        let geoMean = 0;
        let ariMean = 0;
        let count = 0;
        for (let i = 1; i < freqData.length; i++) {
            const v = Math.max(freqData[i], 1) / 255;
            geoMean += Math.log(v);
            ariMean += v;
            count++;
        }
        geoMean = Math.exp(geoMean / count);
        ariMean = ariMean / count;
        audioBus.spectralFlatness = ariMean > 0 ? geoMean / ariMean : 0;

        // Spectral rolloff (frequency where 85% energy lies below)
        let totalEnergy = 0;
        for (let i = 0; i < freqData.length; i++) totalEnergy += freqData[i] * freqData[i];
        let cumEnergy = 0;
        audioBus.spectralRolloff = 1;
        for (let i = 0; i < freqData.length; i++) {
            cumEnergy += freqData[i] * freqData[i];
            if (cumEnergy >= totalEnergy * 0.85) {
                audioBus.spectralRolloff = i / freqData.length;
                break;
            }
        }

        // Brightness (normalized spectral centroid)
        audioBus.brightness = audioBus.spectralCentroid;
    }

    // ── v4: Harmonic & pitch analysis ──
    function computeHarmonicAnalysis() {
        if (!freqData || freqData.length === 0) return;

        // Find dominant peak (fundamental frequency estimation)
        let maxVal = 0;
        let maxBin = 0;
        // Start from bin 2 to avoid DC offset, go up to about 4kHz
        const maxFreqBin = Math.min(freqData.length, 400);
        for (let i = 2; i < maxFreqBin; i++) {
            if (freqData[i] > maxVal) {
                maxVal = freqData[i];
                maxBin = i;
            }
        }

        // Fundamental frequency
        const binHz = (ctx ? ctx.sampleRate : 44100) / (analyser ? analyser.fftSize : 4096);
        audioBus.fundamentalFreq = maxBin * binHz;

        // Pitch class (0-11 mapping to C, C#, D, ... B)
        if (audioBus.fundamentalFreq > 20) {
            // Convert frequency to MIDI note number, then to pitch class
            const midiNote = 12 * Math.log2(audioBus.fundamentalFreq / 440) + 69;
            audioBus.pitchClass = Math.round(midiNote) % 12;
            if (audioBus.pitchClass < 0) audioBus.pitchClass += 12;
        }

        // Harmonic ratio: check if harmonics of the fundamental are present
        let harmonicEnergy = 0;
        let totalSpecEnergy = 0;
        for (let i = 2; i < maxFreqBin; i++) {
            const val = freqData[i] / 255;
            totalSpecEnergy += val;
            // Check if this bin is near a harmonic of the fundamental
            if (maxBin > 0) {
                const ratio = i / maxBin;
                const nearestHarmonic = Math.round(ratio);
                if (nearestHarmonic > 0 && nearestHarmonic <= 8) {
                    const deviation = Math.abs(ratio - nearestHarmonic);
                    if (deviation < 0.08) {
                        harmonicEnergy += val;
                    }
                }
            }
        }
        audioBus.harmonicRatio = totalSpecEnergy > 0.01 ? Math.min(1, harmonicEnergy / totalSpecEnergy * 2) : 0;

        // Chord density: count significant peaks in spectrum
        let peakCount = 0;
        const threshold = maxVal * 0.3; // 30% of max
        for (let i = 3; i < maxFreqBin - 1; i++) {
            if (freqData[i] > threshold &&
                freqData[i] > freqData[i - 1] &&
                freqData[i] > freqData[i + 1]) {
                peakCount++;
            }
        }
        audioBus.chordDensity = Math.min(1, peakCount / 20); // normalize: 20+ peaks = maximal density
    }

    // ── v4: Rhythm & groove analysis ──
    function computeRhythmAnalysis() {
        const now = performance.now();

        // Rhythmic density: onsets per second (normalized 0-1)
        if (onsetTimes.length >= 2) {
            const timeSpan = (onsetTimes[onsetTimes.length - 1] - onsetTimes[0]) / 1000; // seconds
            if (timeSpan > 0.5) {
                const onsetsPerSec = (onsetTimes.length - 1) / timeSpan;
                audioBus.rhythmicDensity = Math.min(1, onsetsPerSec / 12); // 12 onsets/sec = max density
            }
        }

        // Groove / swing detection
        if (onsetTimes.length >= 6) {
            let intervals = [];
            for (let i = 1; i < onsetTimes.length; i++) {
                const interval = onsetTimes[i] - onsetTimes[i - 1];
                if (interval > 50 && interval < 2000) intervals.push(interval);
            }

            if (intervals.length >= 4) {
                // Groove = standard deviation of interval ratios from strict grid
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                let deviationSum = 0;
                for (let i = 0; i < intervals.length - 1; i += 2) {
                    if (i + 1 < intervals.length) {
                        // Compare consecutive pairs — swing creates long-short patterns
                        const ratio = intervals[i] / (intervals[i + 1] + 0.001);
                        // Perfect straight = 1.0, swing ≈ 1.5-2.0
                        deviationSum += Math.abs(ratio - 1);
                    }
                }
                audioBus.groove = Math.min(1, deviationSum / (intervals.length / 2) * 2);

                // Rhythmic complexity (entropy of interval distribution)
                // Quantize intervals into buckets
                const bucketCount = 8;
                const buckets = new Array(bucketCount).fill(0);
                for (const interval of intervals) {
                    const bucket = Math.min(bucketCount - 1, Math.floor((interval / avgInterval) * bucketCount / 3));
                    buckets[bucket]++;
                }
                // Shannon entropy
                let entropy = 0;
                for (const b of buckets) {
                    if (b > 0) {
                        const p = b / intervals.length;
                        entropy -= p * Math.log2(p);
                    }
                }
                audioBus.rhythmComplexity = Math.min(1, entropy / Math.log2(bucketCount));
            }
        }
    }

    // ── v4: Spectral dynamics ──
    function computeSpectralDynamics() {
        // Spectral contrast: difference between peaks and valleys
        // Sample the spectrum in octave-like bands
        let peakSum = 0;
        let valleySum = 0;
        let bandCount = 0;
        for (const [band, [lo, hi]] of Object.entries(bandRanges)) {
            let bandMax = 0;
            let bandMin = 255;
            for (let i = lo; i < hi && i < freqData.length; i++) {
                if (freqData[i] > bandMax) bandMax = freqData[i];
                if (freqData[i] < bandMin) bandMin = freqData[i];
            }
            peakSum += bandMax / 255;
            valleySum += bandMin / 255;
            bandCount++;
        }
        audioBus.spectralContrast = bandCount > 0 ? (peakSum - valleySum) / bandCount : 0;

        // Spectral tilt: linear regression slope of energy across bands
        // 1.7: Use pre-allocated _bandValues instead of allocating every frame
        const n = BAND_NAMES.length;
        for (let i = 0; i < n; i++) _bandValues[i] = audioBus.smoothBands[BAND_NAMES[i]];
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += _bandValues[i];
            sumXY += i * _bandValues[i];
            sumXX += i * i;
        }
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX + 0.001);
        // Normalize: slope of ~±0.1 maps to ±1
        audioBus.spectralTilt = Math.max(-1, Math.min(1, slope * 10));

        // Spectral spread: standard deviation of energy distribution
        const meanBand = sumY / n;
        let variance = 0;
        for (let i = 0; i < n; i++) {
            const diff = _bandValues[i] - meanBand;
            variance += diff * diff;
        }
        audioBus.spectralSpread = Math.min(1, Math.sqrt(variance / n) * 5);
    }

    // ── v4: Micro-dynamics ──
    function computeMicroDynamics() {
        // Zero-crossing rate (high = percussive/noisy, low = tonal)
        let crossings = 0;
        for (let i = 1; i < timeData.length; i++) {
            const prev = timeData[i - 1] - 128;
            const curr = timeData[i] - 128;
            if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
                crossings++;
            }
        }
        audioBus.zeroCrossingRate = Math.min(1, crossings / (timeData.length * 0.5));

        // Signal entropy — 1.6: Use pre-allocated _entropyBins
        _entropyBins.fill(0);
        for (let i = 0; i < timeData.length; i++) {
            const bin = Math.min(31, Math.floor(timeData[i] / 256 * 32));
            _entropyBins[bin]++;
        }
        let entropy = 0;
        for (let b = 0; b < 32; b++) {
            if (_entropyBins[b] > 0) {
                const p = _entropyBins[b] / timeData.length;
                entropy -= p * Math.log2(p);
            }
        }
        // Normalize: max entropy = log2(32) ≈ 5
        audioBus.signalEntropy = Math.min(1, entropy / 5);

        // Modulation depth — 1.6: Use pre-allocated _windowRMS, avoid spread operator
        const windowSize = Math.floor(timeData.length / 16);
        let rmsMax = 0, rmsMin = Infinity;
        for (let w = 0; w < 16; w++) {
            let sum = 0;
            const start = w * windowSize;
            for (let i = start; i < start + windowSize && i < timeData.length; i++) {
                const v = (timeData[i] - 128) / 128;
                sum += v * v;
            }
            _windowRMS[w] = Math.sqrt(sum / windowSize);
            if (_windowRMS[w] > rmsMax) rmsMax = _windowRMS[w];
            if (_windowRMS[w] < rmsMin) rmsMin = _windowRMS[w];
        }
        const rmsRange = rmsMax + rmsMin;
        audioBus.modulationDepth = rmsRange > 0.001 ? Math.min(1, (rmsMax - rmsMin) / rmsRange * 2) : 0;

        modulationHistory.push(audioBus.modulationDepth);
        if (modulationHistory.length > MODULATION_HISTORY_SIZE) modulationHistory.shift();

        // Micro-variation: frame-to-frame energy jitter
        let frameEnergy = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            frameEnergy += v * v;
        }
        frameEnergy = Math.sqrt(frameEnergy / timeData.length);
        const energyDiff = Math.abs(frameEnergy - prevFrameEnergy);
        audioBus.microVariation = Math.min(1, energyDiff * 20);
        prevFrameEnergy = frameEnergy;

        // Store prevTimeData for future use
        for (let i = 0; i < timeData.length; i++) {
            prevTimeData[i] = (timeData[i] - 128) / 128;
        }
    }

    // ── v3: Section-aware analysis ──
    function updateSectionAwareness() {
        if (typeof MarkerSystem === 'undefined') return;

        MarkerSystem.update(audioBus.currentTime);
        const section = MarkerSystem.getCurrentSection();
        const intensity = MarkerSystem.getSectionIntensity();

        // Section state
        audioBus.sectionType = section ? section.type : null;
        audioBus.sectionIntensity = intensity;
        audioBus.isHighEnergy = section ? section.intensity >= 1.0 : false;
        audioBus.isCalm = section ? section.intensity <= 0.5 : false;
        audioBus.isBuildingUp = section ? section.type === 'buildup' : false;
        audioBus.isBreakdown = section ? section.type === 'breakdown' : false;

        // Track section changes + one-shot sectionChanged flag
        const currentType = section ? section.type : null;
        if (currentType !== prevSectionType) {
            audioBus.sectionChanged = true;
            audioBus.prevSectionType = prevSectionType;
            prevSectionType = currentType;
            sectionStartTime = audioBus.currentTime;
            sectionTransitionTime = 0;
            transitionFade = 0;
        } else {
            audioBus.sectionChanged = false;
        }

        // Expose section effects on audioBus so modes can read them directly
        audioBus.sectionEffects = (typeof MarkerSystem !== 'undefined' && MarkerSystem.getSmoothedEffects)
            ? MarkerSystem.getSmoothedEffects()
            : { shake: 1, flash: 1, zoom: 1, bloom: 1, speed: 1, particleScale: 1, displacementScale: 1 };
        audioBus.colorTemp = section ? (section.colorTemp || 'neutral') : 'neutral';

        // Drop chaos state — linked to timeline markers
        audioBus.isDropSection = (typeof MarkerSystem !== 'undefined' && MarkerSystem.isDropActive)
            ? MarkerSystem.isDropActive() : false;
        audioBus.dropSectionIntensity = (typeof MarkerSystem !== 'undefined' && MarkerSystem.getDropIntensity)
            ? MarkerSystem.getDropIntensity() : 0;

        // Transition fade (smooth blend over ~0.5s)
        sectionTransitionTime += 1 / 60;
        transitionFade = Math.min(1, sectionTransitionTime / 0.5);
        audioBus.transitionFade = transitionFade;

        // Section progress (0-1 within current section)
        if (section) {
            const markers = MarkerSystem.getMarkers();
            const idx = markers.findIndex(m => m.id === section.id);
            if (idx >= 0 && idx < markers.length - 1) {
                const sectionEnd = markers[idx + 1].time;
                const sectionLen = sectionEnd - section.time;
                audioBus.sectionProgress = sectionLen > 0 ? (audioBus.currentTime - section.time) / sectionLen : 0;
            } else {
                const elapsed = audioBus.currentTime - section.time;
                audioBus.sectionProgress = Math.min(1, elapsed / 30);
            }
        } else {
            audioBus.sectionProgress = 0;
        }

        // Anticipation: detect if we're approaching a high-energy section
        anticipation = 0;
        if (section && audioBus.sectionProgress > 0.7) {
            const markers = MarkerSystem.getMarkers();
            const idx = markers.findIndex(m => m.id === section.id);
            if (idx >= 0 && idx < markers.length - 1) {
                const nextSection = markers[idx + 1];
                const nextType = MarkerSystem.SECTION_TYPES[nextSection.type];
                if (nextType && nextType.intensity >= 1.0) {
                    anticipation = (audioBus.sectionProgress - 0.7) / 0.3;
                    anticipation = anticipation * anticipation;
                }
            }
        }
        audioBus.anticipation = anticipation;

        // Volume-weighted intensity
        audioBus.volumeScale = volumeLevel;

        // Master intensity: combines section intensity, volume, and energy
        const baseIntensity = intensity;
        const energyBoost = audioBus.isHighEnergy ? (1 + audioBus.energySmooth * 0.5) : 1;
        const anticipationBoost = 1 + anticipation * 0.5;
        const volumeWeight = 0.5 + volumeLevel * 0.5;
        audioBus.masterIntensity = baseIntensity * energyBoost * anticipationBoost * volumeWeight;
    }

    // ═══════════════════════════════════════════════════════════
    // MAIN UPDATE
    // ═══════════════════════════════════════════════════════════

    function update() {
        if (!analyser) return;
        if (!audioBus.loaded) {
            timeData.fill(128);
            computeWaveformPoints();
            return;
        }

        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        // Core analysis (v3) — runs every frame
        computeBands();
        computeRMS();
        computePeak();
        detectBeat();
        detectDrop();
        detectWobble();
        computeWaveformPoints();
        computeSpectralCentroid();
        computeSpectralFeatures();
        updateSectionAwareness();

        // v4: Enhanced analysis — 2.3: Throttled for performance
        _analysisFrame = (_analysisFrame + 1) % 60;
        computeBandDynamics();
        computeLoudness();
        detectOnsets();

        // Tearout detectors — unthrottled (use raw band data)
        detectGunShot();
        detectSubSustain();

        // Throttled with harmonic analysis (depend on fundamentalFreq/harmonicRatio)
        if (_analysisFrame % 3 === 0) {
            computeHarmonicAnalysis();
            detectSiren();
            detectScreech();
        }
        if (_analysisFrame % 5 === 0) computeRhythmAnalysis();
        if (_analysisFrame % 2 === 0) computeSpectralDynamics();
        if (_analysisFrame % 2 === 0) computeMicroDynamics();

        audioBus.currentTime = audioElement ? audioElement.currentTime : 0;
        audioBus.isPlaying = audioElement ? !audioElement.paused : false;
    }

    function toggleLoop() {
        if (!audioElement) return false;
        audioElement.loop = !audioElement.loop;
        return audioElement.loop;
    }

    function isLooping() {
        return audioElement ? audioElement.loop : false;
    }

    return {
        init,
        loadFile,
        play,
        pause,
        togglePlay,
        seek,
        seekRelative,
        setVolume,
        getVolume,
        getAudioStream,
        toggleLoop,
        isLooping,
        update,
        tapBPM,
        audioBus,
        get audioElement() { return audioElement; },
        get context() { return ctx; }
    };
})();
