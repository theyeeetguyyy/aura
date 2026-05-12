// ============================================================
// AURA — ColorLib (v1)
// Shared vertex color computation for all visual modes.
// Extracted from hyperforge/titanforge to eliminate duplicated
// color mode switch blocks (~12 modes × 4 files).
//
// Design: buildColorFn() returns a closure invoked per-vertex.
// The closure writes into a pre-allocated Float32Array(3) to
// avoid per-vertex heap allocation (zero GC pressure).
// ============================================================

const ColorLib = (() => {

    // ── COLOR FUNCTION BUILDER ──
    // Called ONCE per frame in the displacement loop.
    // Returns a closure that writes r,g,b into the provided result array.
    //
    // Signature of returned fn:
    //   (px, py, pz, disp, freq, tNorm) => result (same Float32Array passed in)
    //
    // Parameters:
    //   colorMode  — one of the 12 color mode strings
    //   audio      — audioBus reference (for rms)
    //   amt        — displacement amount (for curvature/void normalization)
    //   time       — current elapsed time
    //   result     — Float32Array(3) to write into (pre-allocated by caller)
    //   scratchColor — THREE.Color instance (pre-allocated by caller)
    function buildColorFn(colorMode, audio, amt, time, result, scratchColor) {
        const t   = time;
        const rms = audio.rms || 0;
        const sc  = scratchColor;

        switch (colorMode) {
            case 'reactionDiffusion':
                return (px, py, pz, disp, freq) => {
                    const rd = (Math.sin(px * 0.2 + t) + Math.cos(py * 0.15 + t * 0.8)) * 0.5 + 0.5;
                    const c  = ParamSystem.getColorThreeHSL(rd * 0.6 + freq * 0.4, sc);
                    result[0] = c.r; result[1] = c.g; result[2] = c.b;
                    return result;
                };
            case 'curvature':
                return (px, py, pz, disp) => {
                    const cv = Math.min(1, Math.abs(disp) / (amt + 0.01));
                    const c  = ParamSystem.getColorThreeHSL(cv, sc);
                    result[0] = c.r; result[1] = c.g; result[2] = c.b;
                    return result;
                };
            case 'audioFreq':
                return (px, py, pz, disp, freq, tNorm) => {
                    const c = ParamSystem.getColorThreeHSL(Math.min(1, freq + tNorm * 0.2), sc);
                    result[0] = c.r; result[1] = c.g; result[2] = c.b;
                    return result;
                };
            case 'height':
                return (px, py) => {
                    const c = ParamSystem.getColorThreeHSL(Math.min(1, py / 30 + 0.5), sc);
                    result[0] = c.r; result[1] = c.g; result[2] = c.b;
                    return result;
                };
            case 'velocity':
                return (px, py, pz, disp) => {
                    const c = ParamSystem.getColorThreeHSL(Math.min(1, Math.abs(disp) * 0.1 + t * 0.05), sc);
                    result[0] = c.r; result[1] = c.g; result[2] = c.b;
                    return result;
                };
            case 'rainbow':
                return (px, py, pz, disp, freq, tNorm) => {
                    sc.setHSL((tNorm + t * 0.1) % 1, 0.9, Math.min(0.7, 0.5 + rms * 0.2));
                    result[0] = sc.r; result[1] = sc.g; result[2] = sc.b;
                    return result;
                };
            case 'fire':
                return (px, py, pz, disp, freq) => {
                    const hf = Math.min(1, freq * 0.6 + rms * 0.3);
                    result[0] = Math.min(1, hf * 2); result[1] = hf * 0.6; result[2] = hf * 0.1;
                    return result;
                };
            case 'ice':
                return (px, py, pz, disp, freq) => {
                    const c2 = Math.min(0.9, freq * 0.5 + 0.3);
                    result[0] = c2 * 0.3; result[1] = c2 * 0.7; result[2] = Math.min(1, c2 * 1.2);
                    return result;
                };
            case 'plasma':
                return (px, py, pz, disp, freq, tNorm) => {
                    result[0] = Math.sin(tNorm * 10 + t) * 0.5 + 0.5;
                    result[1] = Math.sin(tNorm * 10 + t * 1.3 + 2.1) * 0.5 + 0.5;
                    result[2] = Math.sin(tNorm * 10 + t * 0.7 + 4.2) * 0.5 + 0.5;
                    return result;
                };
            case 'thermal':
                return (px, py, pz, disp, freq) => {
                    const th = Math.min(1, freq * 0.7 + rms * 0.2);
                    result[0] = Math.min(1, th * 2.5);
                    result[1] = Math.max(0, th * 2 - 0.5);
                    result[2] = Math.max(0, th - 0.7);
                    return result;
                };
            case 'void':
                return (px, py, pz, disp) => {
                    const edge = Math.min(1, Math.abs(disp) / (amt + 0.01));
                    result[0] = edge * 0.3; result[1] = edge * 0.1; result[2] = edge * 0.5 + 0.05;
                    return result;
                };
            case 'holographic':
                return (px, py, pz, disp, freq, tNorm) => {
                    const angle = Math.atan2(pz, px) / Math.PI;
                    sc.setHSL((angle + tNorm + t * 0.05) % 1, 0.9, Math.min(0.65, 0.3 + freq * 0.3));
                    result[0] = sc.r; result[1] = sc.g; result[2] = sc.b;
                    return result;
                };
            default:
                result[0] = 1; result[1] = 1; result[2] = 1;
                return () => result;
        }
    }

    return {
        buildColorFn,
    };
})();
