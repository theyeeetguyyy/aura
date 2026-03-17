# AURA — Tearout Reactivity & Audio-Visual Pipeline Guide
> Second audit pass. Focused specifically on: why audio doesn't drive visuals properly,
> tearout-specific sound detection, section/marker pipeline gaps, beat-sync, and remaining bugs.
> Files reviewed: all uploaded files in their current (post-overhaul) state.

---

## THE CORE PROBLEM — WHAT'S ACTUALLY BROKEN

Before individual items: here is the structural diagnosis.

AURA computes **exceptional** audio analysis (v4 — 7-band, harmonic, rhythm, spectral dynamics,
micro-dynamics, onset, wobble). But the **pipeline from analysis to visuals has three severed
connections**. Fixing these three things will transform the reactivity overnight:

### Severed Connection 1: MarkerSystem effects never reach modes
`MarkerSystem.getSmoothedEffects()` returns `{ particleScale, displacementScale, speed, bloom, shake, zoom, flash }`.
These are used in `updateEffects()` for camera shake/flash/zoom only.
**Modes themselves never see these values.** When AURA is in a DROP section, `GeometryForgeMode.update()`
has no idea. It doesn't know to max displacement, explode harder, or switch shape.

**Fix location:** `audio.js → updateSectionAwareness()` — add two lines:
```js
audioBus.sectionEffects = MarkerSystem.getSmoothedEffects();
audioBus.colorTemp = section ? section.colorTemp : 'neutral';
```
Modes then read `audio.sectionEffects.displacementScale` naturally.

### Severed Connection 2: v4 analysis is computed but zero modes use it
`audioBus.harmonicRatio`, `audioBus.groove`, `audioBus.wobbleIntensity`, `audioBus.modulationDepth`,
`audioBus.rhythmComplexity`, `audioBus.chordDensity`, `audioBus.zeroCrossingRate` — all computed
every frame, read by nothing. These are exactly the features that distinguish a wobble bass from a
sub thump from a sustained pad.

### Severed Connection 3: beatPhase / barPhase never lock any animation
`audioBus.beatPhase` (0→1 per beat) and `audioBus.barPhase` (0→1 per 4-beat bar) are computed
and live on the bus. But every visual animation runs on `time += dt` with no phase-locking.
On tearout, the kick, snare, and bassline are on an ironclad grid. Visuals that don't lock to
this grid feel "swimming" — reactive but never tight.

---

## TABLE OF CONTENTS
1. [Tearout-Specific Sound Detectors](#1-tearout-specific-sound-detectors--audiojs)
2. [Section Pipeline Fixes](#2-section-pipeline-fixes)
3. [Beat-Grid Sync System](#3-beat-grid-sync-system)
4. [Section-to-Visual Behavior Contract](#4-section-to-visual-behavior-contract)
5. [Mode-Specific Reactivity Fixes](#5-mode-specific-reactivity-fixes)
6. [colorTemp Application](#6-colortemp-application)
7. [New Bugs Found in Updated Files](#7-new-bugs-found-in-updated-files)
8. [Debug HUD Enhancements for Tearout](#8-debug-hud-enhancements-for-tearout)
9. [BPM Detection Fixes for Tearout Tempo](#9-bpm-detection-fixes-for-tearout-tempo)
10. [Implementation Order](#10-implementation-order)

---

## 1. TEAROUT-SPECIFIC SOUND DETECTORS — `audio.js`

All of these should be added to `audio.js`. Add their output properties to `audioBus` in the
bus definition block, and call each detector from the main `update()` function.

---

### 1.1 Gun Shot / 808 Transient Detector

**What it sounds like in tearout:** A single violent punch in sub bass — hits instantly and
decays within 50–120ms. It is NOT a sustained note. The sub band spikes above 0.6, then
collapses to near-zero within 6–8 frames.

**Add to audioBus definition:**
```js
gunShotDetected: false,     // true on the single frame of detection
gunShotIntensity: 0,        // 0-1 strength of the hit
gunShotDecay: 0,            // 0-1 decaying after hit (for sustained visual reaction)
```

**Add state variables at module scope:**
```js
let _gunPeakSub = 0;
let _gunPeakHeld = 0;        // how many frames we've held the peak without a new one
const GUN_THRESHOLD = 0.58;  // sub must spike above this
const GUN_DECAY_FRAMES = 10; // frames for decay signal

let _gunDecayCounter = 0;
```

**Add function:**
```js
function detectGunShot() {
    const sub = audioBus.rawBands.sub;

    // Track rising peak
    if (sub > _gunPeakSub) {
        _gunPeakSub = sub;
        _gunPeakHeld = 0;
    } else {
        _gunPeakHeld++;
    }

    // Detection: peak was high, now sub has collapsed by 60%, and there was an onset
    const collapsed = sub < _gunPeakSub * 0.35;
    const wasLoud = _gunPeakSub > GUN_THRESHOLD;
    const recentOnset = audioBus.onsetStrength > 0.2;
    const notSustained = _gunPeakHeld > 2; // peaked at least 2 frames ago

    if (wasLoud && collapsed && recentOnset && notSustained && _gunDecayCounter === 0) {
        audioBus.gunShotDetected = true;
        audioBus.gunShotIntensity = Math.min(1, _gunPeakSub);
        _gunDecayCounter = GUN_DECAY_FRAMES;
        _gunPeakSub = 0;
        _gunPeakHeld = 0;
    } else {
        audioBus.gunShotDetected = false;
    }

    // Decay counter and signal
    if (_gunDecayCounter > 0) _gunDecayCounter--;
    audioBus.gunShotDecay = _gunDecayCounter / GUN_DECAY_FRAMES;

    // Slowly forget old peaks so the detector stays sensitive
    if (_gunPeakHeld > 15) _gunPeakSub *= 0.97;
}
```

**Call in `update()`, after `detectOnsets()`:**
```js
detectGunShot();
```

**Visual use:** On `gunShotDetected`, instantly spike geometry displacement/explode.
During `gunShotDecay > 0`, hold a brief after-glow or radial distortion.

---

### 1.2 Siren / Pitch Sweep Detector

**What it sounds like in tearout:** A synth tone that sweeps upward (200Hz → 2kHz+) over
0.5–2 seconds, sometimes downward. High `harmonicRatio` (it's tonal). Energy in mid/highMid.

**Add to audioBus definition:**
```js
sirenRising: 0,        // 0-1 strength of rising pitch sweep
sirenFalling: 0,       // 0-1 strength of falling pitch sweep
sirenIntensity: 0,     // max of rising/falling
sirenFrequency: 0,     // current estimated frequency in Hz
```

**Add state:**
```js
let _prevFundamental = 0;
let _sirenRiseScore = 0;
let _sirenFallScore = 0;
```

**Add function:**
```js
function detectSiren() {
    const freq = audioBus.fundamentalFreq;
    if (freq < 100 || freq > 8000) {
        // Out of siren range — decay
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
            // Rising: weight by how fast and how far
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
```

**Call every frame** (not throttled — pitch changes fast):
```js
detectSiren();
```

**Visual use:**
- `sirenRising` → drive geometry stretching upward, or camera drift upward
- `sirenFalling` → downward compression
- `sirenFrequency` → map to hue (200Hz=blue → 2kHz=red) for color response

---

### 1.3 Screech / Scream Bass Detector

**What it sounds like:** A distorted, sustained high-pitched sound (scream synth, growl bass
pitched up, or a heavily distorted lead). Characteristics: energy in `highMid` + `treble`,
high `harmonicRatio` (it IS a pitched tone underneath the grit), sustained (not a transient),
and high `zeroCrossingRate` (the grit/distortion).

**Add to audioBus:**
```js
screechDetected: false,
screechIntensity: 0,    // 0-1, builds with sustain duration
screechPitch: 0,        // normalized pitch (0-1)
```

**Add state:**
```js
let _screechSustain = 0;
```

**Add function:**
```js
function detectScreech() {
    const highBandEnergy = audioBus.smoothBands.highMid * 1.5 + audioBus.smoothBands.treble;
    const isTonal = audioBus.harmonicRatio > 0.3;
    const isGritty = audioBus.zeroCrossingRate > 0.25; // distorted = lots of zero crossings
    const isSustained = audioBus.sustainLevel > 0.4;
    const notJustNoise = audioBus.spectralFlatness < 0.6; // tonal noise, not pure noise

    if (highBandEnergy > 0.45 && isTonal && isSustained && notJustNoise) {
        _screechSustain = Math.min(1, _screechSustain + 0.04);
    } else {
        _screechSustain = Math.max(0, _screechSustain - 0.025);
    }

    audioBus.screechDetected = _screechSustain > 0.25;
    audioBus.screechIntensity = _screechSustain;
    // Map fundamental to 0-1 for color
    audioBus.screechPitch = audioBus.fundamentalFreq > 0
        ? Math.min(1, (audioBus.fundamentalFreq - 500) / 3000)
        : 0;
}
```

**Call every frame:**
```js
detectScreech();
```

**Visual use:**
- `screechIntensity` → drive chromatic aberration, particle color shift to harsh whites/yellows
- `screechDetected` → enable streak/trail effects while active

---

### 1.4 Sustained Sub / Reese Bass Detector

**What it sounds like:** A held bass note (reese bass, wobble bass holding a low note, or a
sustained sub pad). Unlike a gun shot it does NOT immediately decay. Unlike wobble it may not
oscillate. It just holds energy in `sub` + `bass` over many frames.

**Add to audioBus:**
```js
subSustain: 0,            // 0-1, builds over ~2 seconds of sustained sub
hasSustainedBass: false,  // true when confirmed (> 0.25s)
subSustainPeak: 0,        // peak sub level during current sustain
```

**Add state:**
```js
let _subSustainFrames = 0;
```

**Add function:**
```js
function detectSubSustain() {
    const subLevel = audioBus.smoothBands.sub + audioBus.smoothBands.bass * 0.5;

    if (subLevel > 0.25 && audioBus.rms > 0.08) {
        _subSustainFrames = Math.min(150, _subSustainFrames + 1);
        audioBus.subSustainPeak = Math.max(audioBus.subSustainPeak, subLevel);
    } else {
        _subSustainFrames = Math.max(0, _subSustainFrames - 4); // faster decay
        if (_subSustainFrames === 0) audioBus.subSustainPeak = 0;
    }

    audioBus.subSustain = _subSustainFrames / 150;
    audioBus.hasSustainedBass = _subSustainFrames > 15;
}
```

**Visual use:**
- `subSustain` → constant low-frequency pulse in geometry, floor rumble in terrain modes
- `hasSustainedBass` → activate wobble visual effect (since real wobble = sustained bass + modulation)

---

### 1.5 Improved Wobble Rate Detector

The current `detectWobble()` counts zero-crossings but the result is a noisy, BPM-unaware
intensity value. For tearout, wobble basses run at subdivisions of the BPM (1/4, 1/8, 1/16
of the bar). What we need is the **rate in Hz** so we can drive a synchronized visual LFO.

**Add to audioBus:**
```js
wobbleRateHz: 0,   // detected oscillation rate in Hz (typically 2-8 Hz for tearout)
wobbleLFO: 0,      // synthesized LFO value (-1 to 1) locked to wobble rate
wobblePhaseAcc: 0, // accumulated wobble phase (add to existing wobblePhase)
```

**Replace `detectWobble()` with the improved version:**
```js
// State — keep existing variables, add:
let _wobblePeakTimes = [];    // times of bass energy peaks (ms)
let _wobbleRateSmooth = 0;    // smoothed wobble rate Hz
let _wobblePeakState = false; // are we currently above the peak threshold?

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
            if (interval > 40 && interval < 1000) intervals.push(interval); // 1Hz to 25Hz range
        }
        if (intervals.length >= 2) {
            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const rawRate = 1000 / avgInterval; // Hz
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
```

**Visual use:**
- `audioBus.wobbleLFO` (-1 to 1) → multiply geometry displacement at the wobble rate
- `audioBus.wobbleRateHz` → scale visual oscillation period
- This creates displacement that literally oscillates in sync with the wobble bass

---

### 1.6 Section Changed One-Shot Flag

**Add to audioBus:**
```js
sectionChanged: false,   // true for EXACTLY 1 frame when section type changes
prevSectionType: null,   // previous section type (for transition logic)
```

**In `updateSectionAwareness()`, at the section-change tracking block:**
```js
if (currentType !== prevSectionType) {
    audioBus.sectionChanged = true;   // ← ADD THIS
    audioBus.prevSectionType = prevSectionType; // ← AND THIS
    prevSectionType = currentType;
    sectionStartTime = audioBus.currentTime;
    sectionTransitionTime = 0;
    transitionFade = 0;
} else {
    audioBus.sectionChanged = false;   // ← must clear it every other frame
}
```

**Visual use:** Modes can react to `sectionChanged` to trigger a one-time morph, shape change,
or color palette swap at the exact moment a new section begins.

---

## 2. SECTION PIPELINE FIXES

### 2.1 Expose sectionEffects and colorTemp on audioBus — `audio.js`

**This is the most critical fix in the entire document.**

In `updateSectionAwareness()`, after the section state block, add:

```js
// ── MARKER EFFECTS — exposed on audioBus so modes can read them directly ──
audioBus.sectionEffects = (typeof MarkerSystem !== 'undefined' && MarkerSystem.getSmoothedEffects)
    ? MarkerSystem.getSmoothedEffects()
    : { shake: 1, flash: 1, zoom: 1, bloom: 1, speed: 1, particleScale: 1, displacementScale: 1 };

// Color temperature from marker section definition
audioBus.colorTemp = section ? (section.colorTemp || 'neutral') : 'neutral';
```

Now modes can write:
```js
const dispScale = audio.sectionEffects.displacementScale ?? 1;
const speedScale = audio.sectionEffects.speed ?? 1;
const partScale = audio.sectionEffects.particleScale ?? 1;
```

Without this, the entire marker system is cosmetic — it affects shake/flash/zoom only.

---

### 2.2 sectionEffects into mode params — `visuals.js`

In the `activeMode.update()` call, inject effects alongside params:

```js
// CURRENT — modes have no idea about marker section effects:
activeMode.update(audioBus, { ...ParamSystem.getAllGlobal(), ...ParamSystem.getAllMode() }, dt);

// FIXED — effects are now readable directly from audioBus.sectionEffects,
// but also inject into params for backward-compat with older modes:
const sectionEffects = audioBus.sectionEffects || {};
activeMode.update(audioBus, {
    ...ParamSystem.getAllGlobal(),
    ...ParamSystem.getAllMode(),
    _displacementScale: sectionEffects.displacementScale ?? 1,
    _particleScale: sectionEffects.particleScale ?? 1,
    _speedScale: sectionEffects.speed ?? 1,
}, dt);
```

The `_` prefix signals these are injected, not user-set.

---

### 2.3 audioBus needs `sectionEffects` in its initial definition — `audio.js`

In the `audioBus` literal object definition (around line 105), add the missing fields:
```js
// Section effects from markers (populated by updateSectionAwareness)
sectionEffects: { shake: 1, flash: 1, zoom: 1, bloom: 1, speed: 1, particleScale: 1, displacementScale: 1 },
colorTemp: 'neutral',
sectionChanged: false,
prevSectionType: null,

// Tearout-specific detectors (populated by new detect functions)
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
subSustainPeak: 0,
wobbleRateHz: 0,
wobbleLFO: 0,
```

---

## 3. BEAT-GRID SYNC SYSTEM

### 3.1 Add beat-sync utilities to `visuals.js`

Add these as module-level functions, and expose them on the `VisualEngine` return object:

```js
// ── BEAT-SYNC UTILITIES ────────────────────────────────────────

/**
 * beatPulse — returns 1.0 on the beat, fading to 0 over `width` fraction of beat.
 * @param {number} phase   - audioBus.beatPhase (0-1)
 * @param {number} width   - 0-1, how much of the beat the pulse occupies (default 0.12)
 * @returns {number} 0-1 pulse value, highest at phase=0
 */
function beatPulse(phase, width = 0.12) {
    if (phase < width) return 1 - (phase / width);
    const trailing = 1 - width;
    if (phase > trailing) return (phase - trailing) / width;
    return 0;
}

/**
 * barPulse — fires on beat 1 of the bar only (every 4 beats).
 * @param {number} barPhase  - audioBus.barPhase (0-1)
 * @param {number} width
 */
function barPulse(barPhase, width = 0.06) {
    return beatPulse(barPhase, width);
}

/**
 * halfTimePulse — fires on beats 1 and 3 (every 2 beats).
 * Useful for half-time drops common in tearout.
 * @param {number} barPhase  - audioBus.barPhase (0-1)
 */
function halfTimePulse(barPhase, width = 0.10) {
    const phase2 = (barPhase * 2) % 1;
    return beatPulse(phase2, width);
}

/**
 * beatSaw — sawtooth wave locked to the beat. Rises 0→1 over each beat.
 * Use for rotation that resets each beat.
 */
function beatSaw(phase) {
    return phase; // 0-1 rising over one beat
}

/**
 * beatSine — sine wave locked to beat cycle.
 */
function beatSine(phase) {
    return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
}
```

**Expose on VisualEngine:**
```js
return {
    // ... existing exports ...
    beatPulse,
    barPulse,
    halfTimePulse,
    beatSaw,
    beatSine,
};
```

**How modes use them:**
```js
// In GeometryForgeMode.update():
const pulse = VisualEngine.beatPulse(audio.beatPhase, 0.15);
const rotBoost = 1 + pulse * params.beatSpinBurst * audio.sectionEffects.speed;
this.group.rotation.y += rotSpeedY * rotBoost * dt;

// Displacement locked to half-time (tearout half-step feel):
const htPulse = VisualEngine.halfTimePulse(audio.barPhase);
const displaceBase = params.displaceAmount * audio.sectionEffects.displacementScale;
const displaceActual = displaceBase * (0.6 + 0.4 * htPulse);
```

---

### 3.2 BPM phase sync on section entry — modes

When `audio.sectionChanged` is true, modes should optionally re-align their internal phase
accumulators to `audio.beatPhase` so they don't drift across sections:

```js
// At the top of mode.update():
if (audio.sectionChanged) {
    // Snap rotation phase to bar grid
    this.phaseOffset = audio.barPhase; // (if mode has a phase accumulator)
}
```

---

## 4. SECTION-TO-VISUAL BEHAVIOR CONTRACT

This is the complete specification of how each section type should change visual behavior.
This is what you wanted — visuals that respect the music structure.

Add a `SECTION_BEHAVIORS` lookup in `visuals.js` (or each mode can read `audioBus.sectionType`):

```js
// In visuals.js — section behavior constants
const SECTION_BEHAVIORS = {
    intro: {
        displaceModeHint: 'noise',       // gentle noise displacement
        rotationMultiplier: 0.4,         // slow rotation
        particleEmissionRate: 0.2,       // few particles
        colorSaturationMult: 0.7,        // muted colors
        beatReactivity: 0.2,             // barely reacts to beats
        bloomGlowMult: 0.5,
        cameraZoomBias: 0,               // neutral zoom
        halfTimeMode: false,
        trailLength: 'short',
    },
    verse: {
        displaceModeHint: 'frequency',
        rotationMultiplier: 0.6,
        particleEmissionRate: 0.5,
        colorSaturationMult: 0.85,
        beatReactivity: 0.5,
        bloomGlowMult: 0.7,
        halfTimeMode: false,
        trailLength: 'short',
    },
    buildup: {
        displaceModeHint: 'spike',       // increasingly spiky
        rotationMultiplier: 1.0,         // speeds up over sectionProgress
        particleEmissionRate: 0.8,       // building particle burst
        colorSaturationMult: 1.1,
        beatReactivity: 0.8,
        bloomGlowMult: 1.0,
        halfTimeMode: false,
        trailLength: 'medium',
        // Note: multiply all values by (0.5 + 0.5 * audio.sectionProgress) for ramp
        useSectionProgressRamp: true,
    },
    fakeout: {
        displaceModeHint: 'breathe',     // calm, breathing
        rotationMultiplier: 0.1,         // nearly stopped
        particleEmissionRate: 0.05,      // almost no particles
        colorSaturationMult: 0.4,        // nearly desaturated
        beatReactivity: 0.0,             // doesn't react to beat
        bloomGlowMult: 0.2,
        halfTimeMode: false,
        trailLength: 'none',
        // On section entry: hard cut to minimal state
        onEnter: 'hard-cut-to-minimal',
    },
    drop: {
        displaceModeHint: 'shatter',     // violent, fragmented
        rotationMultiplier: 1.8,
        particleEmissionRate: 1.5,       // burst
        colorSaturationMult: 1.5,
        beatReactivity: 1.4,
        bloomGlowMult: 1.8,
        halfTimeMode: true,              // lock to half-time feel
        trailLength: 'long',
        onEnter: 'morph-explode',
        gunShotReaction: 'spike-max',    // gun shots → max displacement spike
        screechReaction: 'chromatic',    // screeches → chromatic aberration
        sirenReaction: 'stretch-up',     // siren rising → geometry stretch upward
    },
    drop2: {
        displaceModeHint: 'glitch',      // glitch/chaos
        rotationMultiplier: 2.2,
        particleEmissionRate: 2.0,
        colorSaturationMult: 1.8,
        beatReactivity: 1.8,
        bloomGlowMult: 2.5,
        halfTimeMode: true,
        trailLength: 'long',
        onEnter: 'morph-explode',
        gunShotReaction: 'spike-max',
    },
    breakdown: {
        displaceModeHint: 'melt',        // slow organic melt
        rotationMultiplier: 0.5,
        particleEmissionRate: 0.4,
        colorSaturationMult: 1.0,
        beatReactivity: 0.3,
        bloomGlowMult: 1.4,              // heavy glow during breakdown
        halfTimeMode: false,
        trailLength: 'long',             // long trails for dreamlike feel
        wobbleReaction: 'displace-lfo',  // wobble → LFO displacement
    },
    bridge: {
        displaceModeHint: 'ripple',
        rotationMultiplier: 0.5,
        particleEmissionRate: 0.4,
        beatReactivity: 0.4,
        bloomGlowMult: 0.8,
        halfTimeMode: false,
        trailLength: 'medium',
    },
    climax: {
        displaceModeHint: 'harmonics',   // resonant harmonics
        rotationMultiplier: 2.5,
        particleEmissionRate: 2.5,
        colorSaturationMult: 2.0,
        beatReactivity: 2.0,
        bloomGlowMult: 3.0,
        halfTimeMode: false,             // full speed at climax
        trailLength: 'long',
        onEnter: 'morph-explode',
        screechReaction: 'chromatic',
        sirenReaction: 'stretch-up',
    },
    outro: {
        displaceModeHint: 'breathe',
        rotationMultiplier: 0.2,
        particleEmissionRate: 0.1,
        colorSaturationMult: 0.5,
        beatReactivity: 0.1,
        bloomGlowMult: 0.3,
        halfTimeMode: false,
        trailLength: 'long',             // fade-out trails
        // On entry: slow fade-down of everything
    },
};
```

**How modes use this:**
```js
// In any mode's update():
const behavior = SECTION_BEHAVIORS[audio.sectionType] || SECTION_BEHAVIORS.verse;
const progRamp = behavior.useSectionProgressRamp ? (0.5 + 0.5 * audio.sectionProgress) : 1.0;

const effectiveDisplace = params.displaceAmount
    * audio.sectionEffects.displacementScale    // from MarkerSystem smoothed
    * behavior.beatReactivity                   // from section behavior
    * progRamp;                                 // buildup ramp

const effectiveRotSpeed = params.rotSpeedY
    * behavior.rotationMultiplier
    * audio.sectionEffects.speed
    * progRamp;
```

**Store `SECTION_BEHAVIORS` in a shared location** — either in `visuals.js` as a `VisualEngine` export,
or in a new file `js/sectionBehaviors.js` loaded before any modes.

---

## 5. MODE-SPECIFIC REACTIVITY FIXES

### 5.1 GeometryForge — tearout integration points — `geometryShapes.js`

Find these patterns in `GeometryForgeMode.update()` and add the tearout reactions:

**A) Gun shot reaction — override beat explode:**
```js
// Current pattern looks like: if (audio.beat) { this.explodePhase = ... }
// ADD BEFORE the existing beat explode logic:
if (audio.gunShotDetected) {
    // Override beat explode with full-force spike on gun shot
    this.explodePhase = Math.max(this.explodePhase, audio.gunShotIntensity * (params.beatExplode || 1) * 1.5);
}
// Gun shot decay keeps the explode active briefly:
if (audio.gunShotDecay > 0) {
    this.explodePhase = Math.max(this.explodePhase, audio.gunShotDecay * 0.5);
}
```

**B) Wobble LFO → displacement oscillation:**
```js
// In the displacement calculation, ADD this modulation:
if (audio.hasSustainedBass && audio.wobbleIntensity > 0.2) {
    // Wobble LFO modulates displacement amplitude at the wobble rate
    const wobbleMod = 0.5 + 0.5 * audio.wobbleLFO;
    dispAmount *= 0.4 + 0.6 * wobbleMod; // displacement breathes with wobble
}
```

**C) Siren rising → upward geometry stretch:**
```js
// In the vertex displacement section, add a Y-axis bias:
if (audio.sirenRising > 0.3) {
    const stretch = audio.sirenRising * params.displaceAmount * 0.5;
    // Pull vertices upward proportional to their Y position
    displacement_y += ny * stretch * audio.sirenRising;
}
```

**D) Screech → chromatic split override:**
```js
// Find where chromaticSplit param is used, ADD:
const effectiveChromaticSplit = (params.chromaticSplit || 0)
    + audio.screechIntensity * 3.0; // screeches push chromatic up to 3 units
```

**E) Section entry → auto-select displaceMode:**
```js
// At the start of update():
if (audio.sectionChanged && !params._userOverrideDisplace) {
    const modeMap = {
        drop: 'shatter', drop2: 'glitch', climax: 'harmonics',
        breakdown: 'melt', buildup: 'spike', intro: 'noise',
        verse: 'frequency', fakeout: 'breathe', bridge: 'ripple', outro: 'breathe'
    };
    if (modeMap[audio.sectionType]) {
        // Temporarily override displaceMode for this section
        this._sectionDisplaceMode = modeMap[audio.sectionType];
    }
}
const activeDisplaceMode = this._sectionDisplaceMode || params.displaceMode;
```

Note: Set `params._userOverrideDisplace = true` when the user manually changes displaceMode
in the params panel, so manual selection takes precedence.

**F) Fakeout — hard cut:**
```js
if (audio.sectionChanged && audio.sectionType === 'fakeout') {
    // Instantly collapse everything
    this.explodePhase = 0;
    // Trigger shape morph to simplest form
    this._sectionDisplaceMode = 'breathe';
    // Set rotation to near-zero for this section
    this._fakeoutLock = true;
}
if (audio.sectionType !== 'fakeout') {
    this._fakeoutLock = false;
}
```

---

### 5.2 Hyperforge — tearout integration points — `hyperforge.js`

**A) Gun shot → attractor particle burst:**
```js
// Find attractor update loop, ADD:
if (audio.gunShotDetected) {
    // Burst all attractor particles outward
    for (let i = 0; i < this.attractorVelocities.length; i++) {
        this.attractorVelocities[i].multiplyScalar(1 + audio.gunShotIntensity * 8);
    }
}
```

**B) Siren → attractor speed ramp:**
```js
// Find where attractorSpeed param is used:
const effectiveAttractorSpeed = params.attractorSpeed
    * audio.sectionEffects.speed
    * (1 + audio.sirenRising * 2); // siren rising → attractor speeds up
```

**C) Screech → flow particle color shift:**
```js
// In flow particle color update:
if (audio.screechDetected) {
    // Force colors toward harsh yellow-white during screech
    color.lerp(new THREE.Color(1, 0.95, 0.6), audio.screechIntensity * 0.4);
}
```

**D) Sub sustain → surface displacement pulse:**
```js
// In displacement calculation:
if (audio.hasSustainedBass) {
    const subPulse = audio.subSustain * audio.wobbleLFO * params.displaceAmt * 0.4;
    // Add low-frequency rumble to surface
    pos.y += subPulse;
}
```

---

### 5.3 All modes — universal fixes

Every mode's `update()` should apply `audio.sectionEffects.displacementScale` to its primary
displacement amount. Here is the standard pattern that should be in every mode:

```js
// At the top of every mode's update(), before any displacement:
const SE = audio.sectionEffects || { displacementScale: 1, particleScale: 1, speed: 1 };
// Effective scales — combine user param × section marker × audio reactivity
const _displaceScale = SE.displacementScale * (params.reactivity || 1);
const _particleScale = SE.particleScale;
const _speedScale = SE.speed;
```

Then replace hardcoded uses of `params.displaceAmount` with `params.displaceAmount * _displaceScale`.

---

## 6. COLORTEMP APPLICATION

### 6.1 colorTemp → flash color — `visuals.js`

In `updateEffects()`, after the existing flash color lerp block, add:

```js
// === COLOR TEMPERATURE — apply section hue shift to flash overlay ===
const colorTempHue = {
    cool:     240,  // blue
    neutral:  280,  // purple (default)
    warm:      30,  // orange
    hot:        5,  // red-orange
    ethereal: 300,  // magenta-purple
    extreme:    0,  // pure red
}[audio.colorTemp] ?? 280;

if (flashOverlay && flashEnabled) {
    // Target flash color from colorTemp
    const targetColor = new THREE.Color().setHSL(colorTempHue / 360, 0.9, 0.6);
    flashOverlay.material.color.lerp(targetColor, 0.05); // slow blend
}
```

### 6.2 colorTemp → fog color — `visuals.js`

Three.js `FogExp2` only has a `color` property. Add color lerping:

```js
// After fog density update in updateEffects():
const fogColorMap = {
    cool: new THREE.Color(0x000520),
    neutral: new THREE.Color(0x000000),
    warm: new THREE.Color(0x150500),
    hot: new THREE.Color(0x1a0000),
    ethereal: new THREE.Color(0x0a0015),
    extreme: new THREE.Color(0x200000),
};
const targetFogColor = fogColorMap[audio.colorTemp] || fogColorMap.neutral;
scene.fog.color.lerp(targetFogColor, 0.03);
```

(Initialize `scene.fog` with a `THREE.Fog` that has a color property instead of `FogExp2`,
or use `THREE.Fog` for this color-aware version.)

### 6.3 colorTemp → background color — `visuals.js`

In the main `update()`, replace the plain `scene.background.set(bg)` with color-temperature-aware version:

```js
// Current:
const bg = ParamSystem.get('backgroundColor') || '#000000';
scene.background.set(bg);

// Improved: tint background toward colorTemp when section is active
if (audioBus.sectionType && audioBus.colorTemp !== 'neutral') {
    const tempTint = fogColorMap[audioBus.colorTemp] || new THREE.Color(0x000000);
    const userBg = new THREE.Color(ParamSystem.get('backgroundColor') || '#000000');
    scene.background.copy(userBg).lerp(tempTint, 0.15 * audioBus.transitionFade);
} else {
    scene.background.set(ParamSystem.get('backgroundColor') || '#000000');
}
```

---

## 7. NEW BUGS FOUND IN UPDATED FILES

### 7.1 `app.js` — potential double RAF loop on visibility restore

**Severity: MEDIUM**

```js
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        running = false;
    } else {
        if (canvas) {
            running = true;
            loop(); // ← This always starts a new loop() call
        }
    }
});
```

**Race condition:** If `visibilitychange` fires rapidly (hide then show before the current frame
processes), `loop()` could be called while a stale RAF callback is still queued.
That stale callback will see `running = true` (restored) and register another `requestAnimationFrame(loop)`.
Now two RAF loops are running simultaneously.

**Fix:** Use an RAF handle to detect whether a loop is already running:
```js
let _rafId = null;

function loop() {
    if (!running) { _rafId = null; return; }
    _rafId = requestAnimationFrame(loop);
    AudioEngine.update();
    VisualEngine.update();
    UI.update();
}

// In visibilitychange:
} else {
    if (canvas && !_rafId) { // only start if not already running
        running = true;
        loop();
    } else if (canvas) {
        running = true; // loop already running, just un-pause it
    }
}
```

---

### 7.2 `app.js` — `clock.getDelta()` is called inside `VisualEngine.update()`, not app.js

The `THREE.Clock.getDelta()` call happens inside `VisualEngine.update()`. When the tab restores
after being hidden, the FIRST call to `clock.getDelta()` returns the full elapsed hidden time
(could be minutes). Although the dt is now clamped to `0.05s` in `visuals.js`, the **clock
is not reset** before the first post-restore frame.

**Fix:** In `visuals.js`, when resuming (or just ensure the clamp already there handles it):
The existing `Math.min(clock.getDelta(), 0.05)` clamp should handle this. ✓ Already fixed.
But: verify the `clock.getDelta()` call happens BEFORE the clamped assignment.

Actually checking: `const dt = Math.min(clock.getDelta(), 0.05);` — this is correct.

---

### 7.3 `ui.js` — `refreshParamValues()` doesn't update the `.param-value` sibling span

**Severity: MEDIUM**

`refreshParamValues()` updates the input element's `.value` but doesn't update the
`<span class="param-value">` text that shows the numeric value next to sliders.
After clicking Randomize, the slider handles move but the text readouts stay at old values.

**Fix:** In `refreshParamValues()`, find the sibling span and update it:
```js
document.querySelectorAll('[data-param-key]').forEach(el => {
    const key = el.dataset.paramKey;
    const val = ParamSystem.get(key);
    if (val === undefined) return;

    if (el.type === 'range') {
        el.value = val;
        // Update sibling value display
        const valueSpan = el.closest('.param-row')?.querySelector('.param-value');
        if (valueSpan) valueSpan.textContent = parseFloat(val).toFixed(2);
    } else if (el.type === 'checkbox') {
        el.checked = val;
    } else if (el.tagName === 'SELECT') {
        el.value = val;
    } else if (el.type === 'color') {
        // Only set if val is a valid hex color
        if (typeof val === 'string' && val.startsWith('#')) el.value = val;
    }
});
```

---

### 7.4 `ui.js` — Preset save uses `localStorage` but `localStorage` is scoped per-origin

**Severity: LOW — informational**

Presets saved to `localStorage` will be lost if:
- User clears browser storage
- User opens AURA from a different file path or server origin
- Multiple AURA instances share the same origin

The preset key is `aura_presets` — no namespacing. If a user runs multiple AURA versions,
they'll share the same preset list.

**Fix:** Namespace the key: `aura_presets_v1` and include a version field in each preset.
Also add a "Export All Presets" button that downloads the full `aura_presets` JSON.

---

### 7.5 `ui.js` — Debug HUD missing tearout-specific fields

The current debug HUD shows:
```
FPS: 60  Mode: geometryForge
BPM: 140  RMS: 0.234  Section: drop
Draws: 12  Triangles: 18432  Drop: 0.73
```

Missing critical tearout diagnostic fields. **Fix by expanding `updateDebugHUD()`:**
```js
_debugHUD.textContent =
    `FPS: ${avgFps}  Mode: ${VisualEngine.activeModeKey || '—'}\n` +
    `BPM: ${bus.bpm}  Section: ${bus.sectionType || '—'}  → ${bus.sectionProgress?.toFixed(2) || '0'}\n` +
    `RMS: ${bus.rms.toFixed(3)}  Sub: ${bus.smoothBands?.sub?.toFixed(2)||'0'}  Bass: ${bus.smoothBands?.bass?.toFixed(2)||'0'}\n` +
    `Drop↓: ${bus.dropDecay?.toFixed(2)}  Wobble: ${bus.wobbleIntensity?.toFixed(2)} @ ${bus.wobbleRateHz?.toFixed(1)}Hz\n` +
    `Gun: ${bus.gunShotDetected ? '💥 ' + bus.gunShotIntensity.toFixed(2) : '—'}  Siren: ${bus.sirenIntensity?.toFixed(2)}↑${bus.sirenRising?.toFixed(2)}\n` +
    `Screech: ${bus.screechIntensity?.toFixed(2)}  SubSust: ${bus.subSustain?.toFixed(2)}\n` +
    `Harmonic: ${bus.harmonicRatio?.toFixed(2)}  Groove: ${bus.groove?.toFixed(2)}  ZCR: ${bus.zeroCrossingRate?.toFixed(2)}\n` +
    `Draws: ${info.calls||0}  Tris: ${info.triangles||0}  dispScale: ${bus.sectionEffects?.displacementScale?.toFixed(2)||'—'}`;
```

---

### 7.6 `markers.js` — `timeToNextSection` returns `Infinity` — still unpatched

From the previous guide, this was flagged but not fixed in the new files:

```js
function timeToNextSection(currentTime) {
    const next = getNextSection(currentTime);
    return next ? next.time - currentTime : Infinity; // ← Infinity not fixed
}
```

Callers that do math with this will produce `0` or `NaN`. Fix:
```js
return next ? next.time - currentTime : 9999;
```

---

### 7.7 `visuals.js` — `colorTemp` map objects recreated every frame

In the proposed Fix 6.2 and 6.3 above (and in the existing `updateEffects()` if you add colorTemp
maps), do NOT define the color map objects inside the function. They will be garbage-collected
and recreated 60 times per second.

**Always define color/fog maps at module scope:**
```js
// Module scope — created ONCE:
const _fogColorMap = {
    cool:     new THREE.Color(0x000520),
    neutral:  new THREE.Color(0x000000),
    warm:     new THREE.Color(0x150500),
    hot:      new THREE.Color(0x1a0000),
    ethereal: new THREE.Color(0x0a0015),
    extreme:  new THREE.Color(0x200000),
};
const _tempColor = new THREE.Color(); // reusable scratch color
```

---

### 7.8 `visuals.js` — scene textures not disposed on mode switch — still unpatched

From previous doc, this was flagged but not addressed in new files. Confirmed still present:
```js
if (child.material) {
    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
    else child.material.dispose();
    // ← NO texture disposal here — VRAM leak accumulates over mode switches
}
```

**Fix:**
```js
function disposeMaterial(mat) {
    // Dispose all texture slots
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
     'aoMap', 'envMap', 'alphaMap', 'lightMap'].forEach(slot => {
        if (mat[slot]) mat[slot].dispose();
    });
    mat.dispose();
}

// In setMode():
if (child.material) {
    if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
    else disposeMaterial(child.material);
}
```

---

### 7.9 `audio.js` — `detectSiren` runs on throttled harmonic analysis

`detectSiren()` depends on `audioBus.fundamentalFreq` and `audioBus.harmonicRatio`.
Both are set by `computeHarmonicAnalysis()` which is throttled to every 3 frames:
```js
if (_analysisFrame % 3 === 0) computeHarmonicAnalysis();
```

If `detectSiren()` also runs every frame, it reads stale data for 2 out of 3 frames.
The siren detector's EMA will be miscalibrated.

**Fix:** Move `detectSiren()` and `detectScreech()` into the throttled block:
```js
if (_analysisFrame % 3 === 0) {
    computeHarmonicAnalysis();
    detectSiren();    // runs on fresh harmonic data
    detectScreech();  // same
}
```
All other new detectors (`detectGunShot`, `detectSubSustain`, `detectWobble`) should stay
unthrottled since they work on raw band data that updates every frame.

---

### 7.10 `audio.js` — `detectWobble` phase wrap causes visual jump

`audioBus.wobblePhase` accumulates without wrapping:
```js
audioBus.wobblePhase += rate * 0.3;
```
This value grows unbounded. If any mode uses it in `Math.sin(audio.wobblePhase * ...)`,
the value will eventually overflow floating-point precision and produce NaN.

**Fix:** Wrap to [0, 1] or [0, 2π]:
```js
audioBus.wobblePhase = (audioBus.wobblePhase + wobbleIncrement) % 1.0;
```
(In the improved wobble detector from section 1.5 above, this is already addressed.)

---

## 8. DEBUG HUD ENHANCEMENTS FOR TEAROUT

Already addressed in Bug 7.5. Additional recommendation: Add a **spectrum mini-display** to
the debug HUD using ASCII blocks, so you can see at a glance where energy is:

```js
const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
const blocks = '▁▂▃▄▅▆▇█';
const specBar = bands.map(b => {
    const v = bus.smoothBands?.[b] ?? 0;
    return blocks[Math.min(7, Math.floor(v * 8))];
}).join('');
// Add to HUD: `Spectrum: ${specBar}  [sub→brilliance]`
```

---

## 9. BPM DETECTION FIXES FOR TEAROUT TEMPO

### 9.1 Current BPM detector struggles with tearout

Tearout is 150–175 BPM with heavy sub kicks, half-time snares, and complex wobble patterns.
The current detector averages inter-beat intervals from all beat events. Problems:

- **Half-time confusion:** In tearout the kick is often on beats 1 and 3 (half-time feel).
  The detector might latch to 75–87 BPM instead of 150–175.
- **Wobble interference:** Dense wobble bass creates many beat events that aren't the kick.
- **No BPM range prior:** The detector allows 60–200 BPM equally. Tearout is always 150–180.

### 9.2 Improved BPM detector — `audio.js`

**Replace the BPM estimation block inside `detectBeat()`:**

```js
// After beatTimes.push(now) and the shift:
if (beatTimes.length > 4) {
    const intervals = [];
    for (let i = 1; i < beatTimes.length; i++) {
        const interval = beatTimes[i] - beatTimes[i - 1];
        if (interval > 200 && interval < 800) intervals.push(interval); // Narrowed: 75-300 BPM
    }
    if (intervals.length >= 3) {
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        let rawBPM = Math.round(60000 / avgInterval);

        // Harmonic correction: check if double-time is more consistent
        // (tearout commonly detected at half the real BPM)
        const doubleBPM = rawBPM * 2;
        const halfBPM = rawBPM / 2;

        // Prefer the value closest to 155 BPM (center of tearout range)
        const tearoutCenter = 155;
        const candidates = [rawBPM, doubleBPM, halfBPM].filter(b => b >= 100 && b <= 200);
        if (candidates.length > 0) {
            rawBPM = candidates.reduce((best, c) =>
                Math.abs(c - tearoutCenter) < Math.abs(best - tearoutCenter) ? c : best
            );
        }

        // Smooth BPM changes (don't jump wildly frame-to-frame)
        const bpmDelta = rawBPM - audioBus.bpm;
        if (Math.abs(bpmDelta) < 20) {
            // Small correction: smooth it
            audioBus.bpm = Math.round(audioBus.bpm + bpmDelta * 0.1);
        } else if (Math.abs(bpmDelta) > 30) {
            // Large jump: accept it (probably a genuine BPM change or new track)
            audioBus.bpm = rawBPM;
        }
        audioBus.bpm = Math.max(100, Math.min(200, audioBus.bpm));
    }
}
```

### 9.3 Manual BPM tap — `ui.js` + `audio.js`

Add to `AudioEngine`:
```js
// State:
let _tapTimes = [];

function tapBPM() {
    const now = performance.now();
    _tapTimes.push(now);
    if (_tapTimes.length > 8) _tapTimes.shift();
    if (_tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < _tapTimes.length; i++) intervals.push(_tapTimes[i] - _tapTimes[i-1]);
        const avg = intervals.reduce((a, b) => a + b) / intervals.length;
        audioBus.bpm = Math.max(60, Math.min(220, Math.round(60000 / avg)));
        // Reset beat phase to now
        lastBeatTime = now;
    }
}
```

Add to `AudioEngine` return: `tapBPM`

In `ui.js → setupKeyboard()`:
```js
case 'KeyT':
    AudioEngine.tapBPM();
    break;
```

Add `T` to the shortcuts modal and hint bar.

---

## 10. IMPLEMENTATION ORDER

Do these in order. Each level unlocks the next.

### Level 1 — Foundation (do today)
These are blockers for everything else.

| # | Change | File | Lines |
|---|--------|------|-------|
| L1-A | Add all new audioBus properties to bus definition | `audio.js` | ~30 lines |
| L1-B | `audioBus.sectionEffects = MarkerSystem.getSmoothedEffects()` | `audio.js` | 4 lines |
| L1-C | `audioBus.colorTemp = section?.colorTemp` | `audio.js` | 1 line |
| L1-D | `audioBus.sectionChanged` flag (one-shot on section change) | `audio.js` | 5 lines |
| L1-E | Inject `_displacementScale`, `_particleScale`, `_speedScale` into mode params | `visuals.js` | 6 lines |
| L1-F | Fix RAF double-loop bug | `app.js` | 8 lines |

### Level 2 — Beat Sync (do second)
Without this, even perfect audio detection will feel loose.

| # | Change | File | Lines |
|---|--------|------|-------|
| L2-A | Add `beatPulse`, `barPulse`, `halfTimePulse`, `beatSaw`, `beatSine` | `visuals.js` | 25 lines |
| L2-B | GeometryForge: multiply rotation speed by `beatPulse` | `geometryShapes.js` | 5 lines |
| L2-C | GeometryForge: multiply displacement by `halfTimePulse` when in drop | `geometryShapes.js` | 8 lines |
| L2-D | All modes: apply `audio.sectionEffects.displacementScale` | all mode files | ~3 lines each |

### Level 3 — Tearout Detectors
Sound detection without pipeline = no value. Do Level 1+2 first.

| # | Change | File | Lines |
|---|--------|------|-------|
| L3-A | `detectGunShot()` + state vars | `audio.js` | ~50 lines |
| L3-B | `detectSubSustain()` + state vars | `audio.js` | ~20 lines |
| L3-C | Improved `detectWobble()` with rate + LFO | `audio.js` | ~50 lines |
| L3-D | `detectSiren()` + state vars (throttled with harmonic) | `audio.js` | ~40 lines |
| L3-E | `detectScreech()` + state vars (throttled) | `audio.js` | ~25 lines |

### Level 4 — Mode Reactions
Wire detectors to visible effects.

| # | Change | File | Lines |
|---|--------|------|-------|
| L4-A | GeometryForge: gun shot → instant explode spike | `geometryShapes.js` | 10 lines |
| L4-B | GeometryForge: wobble LFO → displacement modulation | `geometryShapes.js` | 8 lines |
| L4-C | GeometryForge: siren → Y-axis stretch | `geometryShapes.js` | 8 lines |
| L4-D | GeometryForge: screech → chromatic split boost | `geometryShapes.js` | 4 lines |
| L4-E | GeometryForge: section entry → auto displaceMode | `geometryShapes.js` | 15 lines |
| L4-F | GeometryForge: fakeout → hard cut visual | `geometryShapes.js` | 10 lines |
| L4-G | Hyperforge: gun shot → particle burst | `hyperforge.js` | 8 lines |
| L4-H | Hyperforge: siren → attractor speed | `hyperforge.js` | 4 lines |

### Level 5 — colorTemp + Polish

| # | Change | File | Lines |
|---|--------|------|-------|
| L5-A | Define `_fogColorMap` at module scope | `visuals.js` | 10 lines |
| L5-B | Flash overlay color lerp to colorTemp | `visuals.js` | 8 lines |
| L5-C | Fog color lerp to colorTemp | `visuals.js` | 5 lines |
| L5-D | Background tint to colorTemp | `visuals.js` | 8 lines |
| L5-E | BPM tearout harmonic correction | `audio.js` | 20 lines |
| L5-F | Tap BPM (`T` key) | `audio.js` + `ui.js` | 20 lines |
| L5-G | Enhanced debug HUD (tearout fields + spectrum bar) | `ui.js` | 15 lines |
| L5-H | `refreshParamValues()` sibling span fix | `ui.js` | 5 lines |
| L5-I | Dispose textures on mode switch | `visuals.js` | 15 lines |

---

## SUMMARY: THE MINIMUM TO MAKE TEAROUT REACT PROPERLY

If you only do 5 things, do these:

1. **`audio.js`:** `audioBus.sectionEffects = MarkerSystem.getSmoothedEffects()` in `updateSectionAwareness()` — so modes know what section they're in.

2. **`audio.js`:** `detectGunShot()` — so gun shots create instant visual impacts.

3. **`audio.js`:** Improved `detectWobble()` with `wobbleLFO` — so wobble bass drives synchronized displacement.

4. **`geometryShapes.js`:** Multiply `displaceAmount` by `audio.sectionEffects.displacementScale` everywhere — so the drop actually hits harder than the intro.

5. **`visuals.js`:** Add `beatPulse()` and use it in geometry rotation — so visuals lock to the beat grid instead of swimming.

Everything else builds on top of these five.

---

*End of AURA Tearout Sync Guide — v2.0*  
*Issues found: 10 bugs · 5 severed pipeline connections · 5 new audio detectors · 1 beat-sync framework · full section behavior contract · BPM fixes*