// Internal State
let points = [];
let bfResult = null;
let dcResult = null;
let animFrames = [];
let currentFrameIdx = 0;
let isPlaying = false;
let animTimer = null;
let hoverPt = null;
let benchmarkData = [];
// DOM Elements
const planeCanvas = document.getElementById("plane");
const pCtx = planeCanvas.getContext("2d");
const chartCanvas = document.getElementById("timeChart");
const cCtx = chartCanvas.getContext("2d");
const inputN = document.getElementById("inputN");
const cornerCaseSelector = document.getElementById("cornerCaseSelector");
const coordRange = document.getElementById("coordRange");
const bfOut = document.getElementById("bfOut");
const dcOut = document.getElementById("dcOut");
const timeOut = document.getElementById("timeOut");
const btnRun = document.getElementById("btnRun");
const btnGenOnly = document.getElementById("btnGenOnly");
const btnStepAnim = document.getElementById("btnStepAnim");
const btnRunBench = document.getElementById("btnRunBench");
const btnPrevStep = document.getElementById("btnPrevStep");
const btnPlayPause = document.getElementById("btnPlayPause");
const btnNextStep = document.getElementById("btnNextStep");
const animScrubber = document.getElementById("animScrubber");
const stepCounter = document.getElementById("stepCounter");
const statusBadge = document.getElementById("statusBadge");
const livePhase = document.getElementById("livePhase");
const liveSubN = document.getElementById("liveSubN");
const liveSplitX = document.getElementById("liveSplitX");
const liveDelta = document.getElementById("liveDelta");
const liveStripRange = document.getElementById("liveStripRange");
const liveStripCount = document.getElementById("liveStripCount");
const livePairTest = document.getElementById("livePairTest");
const liveOpsTotal = document.getElementById("liveOpsTotal");
const liveAgreement = document.getElementById("liveAgreement");
const stepNarrative = document.getElementById("stepNarrative");
const hoverCoordBox = document.getElementById("hoverCoordBox");
// Utility functions
const fmtCoord = (n) => Number.isInteger(n) ? String(n) : n.toFixed(4);
function distSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}
function initDPI(canvas, ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height };
}
// Dataset Generation with all corner cases handled
function generateDataset() {
    stopAnimation();
    const mode = cornerCaseSelector.value;
    let n = parseInt(inputN.value, 10);
    const range = parseFloat(coordRange.value);
    if (mode === "corner-n0") {
        n = 0;
        inputN.value = "0";
    }
    else if (mode === "corner-n1") {
        n = 1;
        inputN.value = "1";
    }
    else if (mode === "corner-n2") {
        n = 2;
        inputN.value = "2";
    }
    else if (isNaN(n) || n < 0) {
        n = 16;
        inputN.value = "16";
    }
    const pts = [];
    if (mode === "corner-duplicates" && n >= 2) {
        const sharedX = Math.round((Math.random() * 2 - 1) * (range * 0.5));
        const sharedY = Math.round((Math.random() * 2 - 1) * (range * 0.5));
        pts.push({ x: sharedX, y: sharedY, id: 0 });
        pts.push({ x: sharedX, y: sharedY, id: 1 });
        for (let i = 2; i < n; i++) {
            pts.push({
                x: Math.round((Math.random() * 2 - 1) * range),
                y: Math.round((Math.random() * 2 - 1) * range),
                id: i
            });
        }
    }
    else if (mode === "corner-collinear-x") {
        const fixedX = 0;
        for (let i = 0; i < n; i++) {
            const y = -range + (2 * range * i) / Math.max(1, n - 1);
            pts.push({ x: fixedX, y: Math.round(y), id: i });
        }
    }
    else if (mode === "corner-collinear-y") {
        const fixedY = 0;
        for (let i = 0; i < n; i++) {
            const x = -range + (2 * range * i) / Math.max(1, n - 1);
            pts.push({ x: Math.round(x), y: fixedY, id: i });
        }
    }
    else if (mode === "random-float") {
        for (let i = 0; i < n; i++) {
            pts.push({
                x: parseFloat(((Math.random() * 2 - 1) * range).toFixed(4)),
                y: parseFloat(((Math.random() * 2 - 1) * range).toFixed(4)),
                id: i
            });
        }
    }
    else {
        for (let i = 0; i < n; i++) {
            pts.push({
                x: Math.round((Math.random() * 2 - 1) * range),
                y: Math.round((Math.random() * 2 - 1) * range),
                id: i
            });
        }
    }
    points = pts;
    bfResult = null;
    dcResult = null;
    animFrames = [];
    currentFrameIdx = 0;
    updateAnimControls();
    resetTelemetryDisplay();
    drawPlane();
}
function resetTelemetryDisplay() {
    bfOut.textContent = "Awaiting execution...";
    dcOut.textContent = "Awaiting execution...";
    timeOut.textContent = "Awaiting execution...";
    livePhase.textContent = "Dataset Loaded";
    liveSubN.textContent = `${points.length} points`;
    liveSplitX.textContent = "—";
    liveDelta.textContent = "—";
    liveStripRange.textContent = "—";
    liveStripCount.textContent = "0 points";
    livePairTest.textContent = "None";
    liveOpsTotal.textContent = "0";
    liveAgreement.textContent = "—";
    stepNarrative.textContent = points.length < 2
        ? `Corner case detected: N = ${points.length}. A minimum of 2 points is required to form a pair.`
        : `Dataset contains ${points.length} points. Click 'Run Comparison' to compute results or 'Play Recursion Animation'.`;
}
// 1. Brute-Force Algorithm O(N^2)
export function runBruteForce(pts) {
    const n = pts.length;
    if (n < 2)
        return { distance: Infinity, p1: null, p2: null, ops: 0 };
    let minD2 = Infinity;
    let bestA = null;
    let bestB = null;
    let ops = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            ops++;
            const d2 = distSq(pts[i], pts[j]);
            if (d2 < minD2) {
                minD2 = d2;
                bestA = pts[i];
                bestB = pts[j];
            }
        }
    }
    return { distance: Math.sqrt(minD2), p1: bestA, p2: bestB, ops };
}
// 2. Divide-and-Conquer Algorithm O(N log N)
export function runDivideAndConquer(pts) {
    if (pts.length < 2)
        return { distance: Infinity, p1: null, p2: null, ops: 0 };
    const sortedX = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y || a.id - b.id);
    const sortedY = pts.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
    let ops = 0;
    function recurse(px, py) {
        const n = px.length;
        if (n <= 3) {
            let best = { d2: Infinity, a: null, b: null };
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    ops++;
                    const d2 = distSq(px[i], px[j]);
                    if (d2 < best.d2)
                        best = { d2, a: px[i], b: px[j] };
                }
            }
            return best;
        }
        const mid = Math.floor(n / 2);
        const midPoint = px[mid];
        const leftX = px.slice(0, mid);
        const rightX = px.slice(mid);
        const leftSet = new Set(leftX.map(p => p.id));
        const leftY = [];
        const rightY = [];
        for (let i = 0; i < py.length; i++) {
            if (leftSet.has(py[i].id))
                leftY.push(py[i]);
            else
                rightY.push(py[i]);
        }
        const resL = recurse(leftX, leftY);
        const resR = recurse(rightX, rightY);
        let best = resL.d2 < resR.d2 ? resL : resR;
        const delta = Math.sqrt(best.d2);
        const strip = [];
        for (let i = 0; i < py.length; i++) {
            if (Math.abs(py[i].x - midPoint.x) < delta) {
                strip.push(py[i]);
            }
        }
        for (let i = 0; i < strip.length; i++) {
            for (let j = i + 1; j < strip.length; j++) {
                if ((strip[j].y - strip[i].y) >= delta)
                    break;
                ops++;
                const d2 = distSq(strip[i], strip[j]);
                if (d2 < best.d2) {
                    best = { d2, a: strip[i], b: strip[j] };
                }
            }
        }
        return best;
    }
    const sol = recurse(sortedX, sortedY);
    return { distance: Math.sqrt(sol.d2), p1: sol.a, p2: sol.b, ops };
}
// Record detailed execution trace for visual animation
function recordExecutionTrace() {
    animFrames = [];
    currentFrameIdx = 0;
    if (points.length < 2) {
        animFrames.push({
            phase: "N < 2 Corner Case",
            subPts: points.slice(),
            splitX: null,
            delta: Infinity,
            stripRange: null,
            testedPair: null,
            currentBest: null,
            opsCount: 0,
            narrative: `Corner case handled: N = ${points.length}. Cannot form a closest pair with fewer than 2 points.`
        });
        updateAnimControls();
        return;
    }
    const sortedX = points.slice().sort((a, b) => a.x - b.x || a.y - b.y || a.id - b.id);
    const sortedY = points.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
    let cumulativeOps = 0;
    let globalBest = {
        d2: Infinity,
        a: sortedX[0],
        b: sortedX[1]
    };
    animFrames.push({
        phase: "Initial Sort",
        subPts: sortedX.slice(),
        splitX: null,
        delta: Infinity,
        stripRange: null,
        testedPair: null,
        currentBest: null,
        opsCount: 0,
        narrative: `Sorted all ${points.length} points by x-coordinate. Starting divide-and-conquer recursion.`
    });
    function traceSubproblem(px, py) {
        const n = px.length;
        const mid = Math.floor(n / 2);
        const midX = px[mid].x;
        if (n <= 3) {
            animFrames.push({
                phase: `Base Case (N = ${n})`,
                subPts: px.slice(),
                splitX: null,
                delta: Math.sqrt(globalBest.d2),
                stripRange: null,
                testedPair: null,
                currentBest: Number.isFinite(globalBest.d2) ? { ...globalBest } : null,
                opsCount: cumulativeOps,
                narrative: `Base case subproblem with ${n} point(s). Evaluating all pairwise combinations directly.`
            });
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    cumulativeOps++;
                    const d2 = distSq(px[i], px[j]);
                    const d = Math.sqrt(d2);
                    let improved = false;
                    if (d2 < globalBest.d2) {
                        globalBest = { d2, a: px[i], b: px[j] };
                        improved = true;
                    }
                    animFrames.push({
                        phase: "Base Pair Evaluation",
                        subPts: px.slice(),
                        splitX: null,
                        delta: Math.sqrt(globalBest.d2),
                        stripRange: null,
                        testedPair: { p1: px[i], p2: px[j], d },
                        currentBest: { ...globalBest },
                        opsCount: cumulativeOps,
                        narrative: `Base test: (${px[i].x}, ${px[i].y}) ↔ (${px[j].x}, ${px[j].y}) = ${d.toFixed(6)}.` +
                            (improved ? ` New minimum δ updated to ${d.toFixed(6)}!` : "")
                    });
                }
            }
            return globalBest;
        }
        animFrames.push({
            phase: `Divide (N = ${n})`,
            subPts: px.slice(),
            splitX: midX,
            delta: Math.sqrt(globalBest.d2),
            stripRange: null,
            testedPair: null,
            currentBest: Number.isFinite(globalBest.d2) ? { ...globalBest } : null,
            opsCount: cumulativeOps,
            narrative: `Bisecting ${n} points around median line x = ${midX}. Left partition: ${mid} pts, Right partition: ${n - mid} pts.`
        });
        const leftX = px.slice(0, mid);
        const rightX = px.slice(mid);
        const leftSet = new Set(leftX.map(p => p.id));
        const leftY = [];
        const rightY = [];
        for (let i = 0; i < py.length; i++) {
            if (leftSet.has(py[i].id))
                leftY.push(py[i]);
            else
                rightY.push(py[i]);
        }
        traceSubproblem(leftX, leftY);
        traceSubproblem(rightX, rightY);
        const delta = Math.sqrt(globalBest.d2);
        const strip = [];
        for (let i = 0; i < py.length; i++) {
            if (Math.abs(py[i].x - midX) < delta) {
                strip.push(py[i]);
            }
        }
        animFrames.push({
            phase: "Strip Creation",
            subPts: px.slice(),
            splitX: midX,
            delta: delta,
            stripRange: { min: midX - delta, max: midX + delta },
            stripPts: strip.slice(),
            testedPair: null,
            currentBest: { ...globalBest },
            opsCount: cumulativeOps,
            narrative: `Forming boundary strip [${(midX - delta).toFixed(2)}, ${(midX + delta).toFixed(2)}] of width 2δ = ${(2 * delta).toFixed(2)}. Filtered ${strip.length} candidate point(s).`
        });
        for (let i = 0; i < strip.length; i++) {
            for (let j = i + 1; j < strip.length; j++) {
                if ((strip[j].y - strip[i].y) >= delta)
                    break;
                cumulativeOps++;
                const d2 = distSq(strip[i], strip[j]);
                const d = Math.sqrt(d2);
                let improved = false;
                if (d2 < globalBest.d2) {
                    globalBest = { d2, a: strip[i], b: strip[j] };
                    improved = true;
                }
                animFrames.push({
                    phase: "Strip Candidate Test",
                    subPts: px.slice(),
                    splitX: midX,
                    delta: Math.sqrt(globalBest.d2),
                    stripRange: { min: midX - delta, max: midX + delta },
                    stripPts: strip.slice(),
                    testedPair: { p1: strip[i], p2: strip[j], d },
                    currentBest: { ...globalBest },
                    opsCount: cumulativeOps,
                    narrative: `Strip check: (${strip[i].x}, ${strip[i].y}) ↔ (${strip[j].x}, ${strip[j].y}) = ${d.toFixed(6)}.` +
                        (improved ? ` Found closer pair crossing the boundary! New δ = ${d.toFixed(6)}.` : "")
                });
            }
        }
        return globalBest;
    }
    traceSubproblem(sortedX, sortedY);
    animFrames.push({
        phase: "Algorithm Finished",
        subPts: points.slice(),
        splitX: null,
        delta: Math.sqrt(globalBest.d2),
        stripRange: null,
        testedPair: null,
        currentBest: { ...globalBest },
        opsCount: cumulativeOps,
        narrative: `Recursion complete. Minimum Euclidean distance is ${Math.sqrt(globalBest.d2).toFixed(6)} between (${globalBest.a.x}, ${globalBest.a.y}) and (${globalBest.b.x}, ${globalBest.b.y}).`
    });
    updateAnimControls();
}
function updateAnimControls() {
    const total = animFrames.length;
    animScrubber.max = String(Math.max(0, total - 1));
    animScrubber.value = String(currentFrameIdx);
    stepCounter.textContent = total > 0 ? `${currentFrameIdx + 1} / ${total}` : `0 / 0`;
    if (total > 0 && animFrames[currentFrameIdx]) {
        const frame = animFrames[currentFrameIdx];
        statusBadge.textContent = frame.phase;
        livePhase.textContent = frame.phase;
        liveSubN.textContent = `${frame.subPts ? frame.subPts.length : 0} points`;
        liveSplitX.textContent = frame.splitX !== null ? `x = ${frame.splitX}` : "—";
        liveDelta.textContent = Number.isFinite(frame.delta) ? frame.delta.toFixed(6) : "Infinity";
        liveStripRange.textContent = frame.stripRange
            ? `[${frame.stripRange.min.toFixed(2)}, ${frame.stripRange.max.toFixed(2)}]`
            : "—";
        liveStripCount.textContent = frame.stripPts ? `${frame.stripPts.length} points` : "0 points";
        livePairTest.textContent = frame.testedPair
            ? `(${frame.testedPair.p1.x}, ${frame.testedPair.p1.y}) ↔ (${frame.testedPair.p2.x}, ${frame.testedPair.p2.y}) = ${frame.testedPair.d.toFixed(4)}`
            : "None";
        liveOpsTotal.textContent = String(frame.opsCount);
        stepNarrative.textContent = frame.narrative;
    }
}
// Execution and Comparison
function executeComparison() {
    stopAnimation();
    if (points.length < 2) {
        bfOut.textContent = "N < 2: No pair exists";
        dcOut.textContent = "N < 2: No pair exists";
        timeOut.textContent = "Brute-Force: 0.0000 ms | Divide-and-Conquer: 0.0000 ms";
        liveAgreement.textContent = "N < 2 (Handled)";
        liveAgreement.style.color = "var(--text-muted)";
        recordExecutionTrace();
        drawPlane();
        return;
    }
    const t0 = performance.now();
    bfResult = runBruteForce(points);
    const t1 = performance.now();
    const bfTime = Math.max(0.0001, t1 - t0);
    const t2 = performance.now();
    dcResult = runDivideAndConquer(points);
    const t3 = performance.now();
    const dcTime = Math.max(0.0001, t3 - t2);
    const p1B = bfResult.p1, p2B = bfResult.p2;
    bfOut.textContent = `${bfResult.distance.toFixed(6)}  (${fmtCoord(p1B.x)}, ${fmtCoord(p1B.y)})  (${fmtCoord(p2B.x)}, ${fmtCoord(p2B.y)})`;
    const p1D = dcResult.p1, p2D = dcResult.p2;
    dcOut.textContent = `${dcResult.distance.toFixed(6)}  (${fmtCoord(p1D.x)}, ${fmtCoord(p1D.y)})  (${fmtCoord(p2D.x)}, ${fmtCoord(p2D.y)})`;
    timeOut.textContent = `Brute-Force: ${bfTime.toFixed(4)} ms | Divide-and-Conquer: ${dcTime.toFixed(4)} ms`;
    const agree = Math.abs(bfResult.distance - dcResult.distance) < 1e-9;
    liveAgreement.textContent = agree ? "Verified Exact Agreement ✓" : "Discrepancy Detected ✗";
    liveAgreement.style.color = agree ? "var(--pair-color)" : "#ef4444";
    recordExecutionTrace();
    currentFrameIdx = animFrames.length - 1;
    updateAnimControls();
    drawPlane();
}
// Draw Plane Visualization with Distinct Point and Pair Highlights
function drawPlane() {
    const { w, h } = initDPI(planeCanvas, pCtx);
    pCtx.clearRect(0, 0, w, h);
    if (points.length === 0) {
        pCtx.fillStyle = "#94a3b8";
        pCtx.font = "14px sans-serif";
        pCtx.textAlign = "center";
        pCtx.fillText("No points on plane (N = 0). Generate points to begin.", w / 2, h / 2);
        return;
    }
    const pad = 40;
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    let minX = Math.min(...xs), maxX = Math.max(...xs);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    if (minX === maxX) {
        minX -= 5;
        maxX += 5;
    }
    if (minY === maxY) {
        minY -= 5;
        maxY += 5;
    }
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const ox = (w - spanX * scale) / 2 - minX * scale;
    const oy = (h - spanY * scale) / 2 + maxY * scale;
    const toScr = (p) => ({ x: ox + p.x * scale, y: oy - p.y * scale });
    // Grid
    pCtx.strokeStyle = "#f1f5f9";
    pCtx.lineWidth = 1;
    for (let x = 0; x <= w; x += 36) {
        pCtx.beginPath();
        pCtx.moveTo(x, 0);
        pCtx.lineTo(x, h);
        pCtx.stroke();
    }
    for (let y = 0; y <= h; y += 36) {
        pCtx.beginPath();
        pCtx.moveTo(0, y);
        pCtx.lineTo(w, y);
        pCtx.stroke();
    }
    // Axes
    if (minX <= 0 && maxX >= 0) {
        const zx = toScr({ x: 0, y: 0 }).x;
        pCtx.strokeStyle = "#cbd5e1";
        pCtx.beginPath();
        pCtx.moveTo(zx, 0);
        pCtx.lineTo(zx, h);
        pCtx.stroke();
    }
    if (minY <= 0 && maxY >= 0) {
        const zy = toScr({ x: 0, y: 0 }).y;
        pCtx.strokeStyle = "#cbd5e1";
        pCtx.beginPath();
        pCtx.moveTo(0, zy);
        pCtx.lineTo(w, zy);
        pCtx.stroke();
    }
    const curFrame = animFrames[currentFrameIdx];
    // Draw D&C Regions and lines
    if (curFrame) {
        if (curFrame.stripRange && Number.isFinite(curFrame.stripRange.min)) {
            const sMinX = toScr({ x: curFrame.stripRange.min, y: 0 }).x;
            const sMaxX = toScr({ x: curFrame.stripRange.max, y: 0 }).x;
            const stripLeft = Math.min(sMinX, sMaxX);
            const stripW = Math.abs(sMaxX - sMinX);
            pCtx.fillStyle = "rgba(245, 158, 11, 0.12)";
            pCtx.fillRect(stripLeft, 0, stripW, h);
            pCtx.strokeStyle = "#f59e0b";
            pCtx.lineWidth = 1.5;
            pCtx.setLineDash([5, 5]);
            pCtx.beginPath();
            pCtx.moveTo(sMinX, 0);
            pCtx.lineTo(sMinX, h);
            pCtx.moveTo(sMaxX, 0);
            pCtx.lineTo(sMaxX, h);
            pCtx.stroke();
            pCtx.setLineDash([]);
        }
        if (curFrame.splitX !== null) {
            const mx = toScr({ x: curFrame.splitX, y: 0 }).x;
            pCtx.strokeStyle = "#d97706";
            pCtx.lineWidth = 2;
            pCtx.beginPath();
            pCtx.moveTo(mx, 0);
            pCtx.lineTo(mx, h);
            pCtx.stroke();
            pCtx.fillStyle = "#d97706";
            pCtx.font = "bold 11px sans-serif";
            pCtx.textAlign = "left";
            pCtx.fillText(`x_mid = ${curFrame.splitX}`, mx + 6, 20);
        }
        if (curFrame.testedPair) {
            const p1 = toScr(curFrame.testedPair.p1);
            const p2 = toScr(curFrame.testedPair.p2);
            pCtx.strokeStyle = "var(--candidate-line)";
            pCtx.lineWidth = 2;
            pCtx.setLineDash([4, 4]);
            pCtx.beginPath();
            pCtx.moveTo(p1.x, p1.y);
            pCtx.lineTo(p2.x, p2.y);
            pCtx.stroke();
            pCtx.setLineDash([]);
        }
    }
    // Draw Final Solution Lines & Pair Highlights
    if (bfResult && bfResult.p1 && bfResult.p2 && dcResult && dcResult.p1 && dcResult.p2) {
        const agree = Math.abs(bfResult.distance - dcResult.distance) < 1e-9;
        if (agree) {
            // Single Emerald Pair with Outer Glow
            const b1 = toScr(dcResult.p1);
            const b2 = toScr(dcResult.p2);
            // Glow halo
            pCtx.strokeStyle = "rgba(5, 150, 105, 0.25)";
            pCtx.lineWidth = 8;
            pCtx.beginPath();
            pCtx.moveTo(b1.x, b1.y);
            pCtx.lineTo(b2.x, b2.y);
            pCtx.stroke();
            // Main line
            pCtx.strokeStyle = "var(--pair-color)";
            pCtx.lineWidth = 3;
            pCtx.beginPath();
            pCtx.moveTo(b1.x, b1.y);
            pCtx.lineTo(b2.x, b2.y);
            pCtx.stroke();
            // Endpoints (Double ring emerald)
            [b1, b2].forEach(pt => {
                pCtx.beginPath();
                pCtx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
                pCtx.fillStyle = "rgba(5, 150, 105, 0.2)";
                pCtx.fill();
                pCtx.beginPath();
                pCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                pCtx.fillStyle = "var(--pair-color)";
                pCtx.fill();
                pCtx.strokeStyle = "#fff";
                pCtx.lineWidth = 2;
                pCtx.stroke();
            });
        }
        else {
            // Disagreement: Draw both distinctly
            const bfA = toScr(bfResult.p1);
            const bfB = toScr(bfResult.p2);
            pCtx.strokeStyle = "var(--bf-color)";
            pCtx.lineWidth = 2.5;
            pCtx.beginPath();
            pCtx.moveTo(bfA.x, bfA.y);
            pCtx.lineTo(bfB.x, bfB.y);
            pCtx.stroke();
            [bfA, bfB].forEach(pt => {
                pCtx.beginPath();
                pCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                pCtx.fillStyle = "var(--bf-color)";
                pCtx.fill();
                pCtx.strokeStyle = "#ffffff";
                pCtx.lineWidth = 1.5;
                pCtx.stroke();
            });
            const dcA = toScr(dcResult.p1);
            const dcB = toScr(dcResult.p2);
            pCtx.strokeStyle = "var(--dc-color)";
            pCtx.lineWidth = 2.5;
            pCtx.beginPath();
            pCtx.moveTo(dcA.x, dcA.y);
            pCtx.lineTo(dcB.x, dcB.y);
            pCtx.stroke();
            [dcA, dcB].forEach(pt => {
                pCtx.fillStyle = "var(--dc-color)";
                pCtx.fillRect(pt.x - 4, pt.y - 4, 8, 8);
                pCtx.strokeStyle = "#ffffff";
                pCtx.lineWidth = 1.5;
                pCtx.strokeRect(pt.x - 4, pt.y - 4, 8, 8);
            });
        }
    }
    // Draw points
    const rad = points.length > 200 ? 2.5 : 4.5;
    points.forEach(p => {
        const sp = toScr(p);
        pCtx.beginPath();
        pCtx.arc(sp.x, sp.y, rad, 0, Math.PI * 2);
        pCtx.fillStyle = "#1e293b";
        pCtx.fill();
        pCtx.strokeStyle = "#ffffff";
        pCtx.lineWidth = 1.2;
        pCtx.stroke();
    });
    // Hovered Point
    if (hoverPt !== null && points[hoverPt]) {
        const hp = points[hoverPt];
        const hScr = toScr(hp);
        pCtx.beginPath();
        pCtx.arc(hScr.x, hScr.y, rad + 4, 0, Math.PI * 2);
        pCtx.strokeStyle = "var(--dc-color)";
        pCtx.lineWidth = 2.5;
        pCtx.stroke();
    }
}
// Running Time vs N Benchmark Plotting
function runBenchmarkScaling() {
    const testSizes = [10, 50, 100, 200, 400, 800, 1500];
    benchmarkData = [];
    btnRunBench.disabled = true;
    btnRunBench.textContent = "Benchmarking...";
    let idx = 0;
    function benchStep() {
        if (idx >= testSizes.length) {
            btnRunBench.disabled = false;
            btnRunBench.textContent = "⚡ Plot Running Time vs N Graph";
            drawChart();
            return;
        }
        const n = testSizes[idx++];
        const sample = Array.from({ length: n }, (_, i) => ({
            x: Math.round((Math.random() * 2 - 1) * 1000),
            y: Math.round((Math.random() * 2 - 1) * 1000),
            id: i
        }));
        const tb0 = performance.now();
        runBruteForce(sample);
        const tb1 = performance.now();
        const bfMs = Math.max(0.001, tb1 - tb0);
        const td0 = performance.now();
        runDivideAndConquer(sample);
        const td1 = performance.now();
        const dcMs = Math.max(0.001, td1 - td0);
        benchmarkData.push({ n, bfMs, dcMs });
        drawChart();
        setTimeout(benchStep, 20);
    }
    benchStep();
}
function drawChart() {
    const { w, h } = initDPI(chartCanvas, cCtx);
    cCtx.clearRect(0, 0, w, h);
    if (benchmarkData.length === 0) {
        cCtx.fillStyle = "#94a3b8";
        cCtx.font = "13px sans-serif";
        cCtx.textAlign = "center";
        cCtx.fillText("Click 'Plot Running Time vs N Graph' to benchmark N up to 1,500.", w / 2, h / 2);
        return;
    }
    const pad = { top: 24, right: 30, bottom: 36, left: 54 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const maxN = Math.max(...benchmarkData.map(d => d.n));
    const maxT = Math.max(...benchmarkData.flatMap(d => [d.bfMs, d.dcMs])) * 1.1;
    const getX = (n) => pad.left + (n / maxN) * cw;
    const getY = (t) => pad.top + ch - (t / maxT) * ch;
    // Horizontal Grid
    cCtx.strokeStyle = "#edf2f9";
    cCtx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const yVal = (maxT * i) / 4;
        const yPos = getY(yVal);
        cCtx.beginPath();
        cCtx.moveTo(pad.left, yPos);
        cCtx.lineTo(w - pad.right, yPos);
        cCtx.stroke();
        cCtx.fillStyle = "#64748b";
        cCtx.font = "10px monospace";
        cCtx.textAlign = "right";
        cCtx.fillText(yVal.toFixed(1) + "ms", pad.left - 6, yPos + 3);
    }
    // X Axis Markers
    benchmarkData.forEach(d => {
        const xPos = getX(d.n);
        cCtx.fillStyle = "#64748b";
        cCtx.font = "11px sans-serif";
        cCtx.textAlign = "center";
        cCtx.fillText(String(d.n), xPos, pad.top + ch + 16);
    });
    // Plot Curve with Gradient Fill & Points
    function plotCurve(prop, strokeColor, fillColor) {
        // Area fill
        cCtx.beginPath();
        benchmarkData.forEach((d, i) => {
            const x = getX(d.n);
            const y = getY(d[prop]);
            if (i === 0)
                cCtx.moveTo(x, y);
            else
                cCtx.lineTo(x, y);
        });
        cCtx.lineTo(getX(benchmarkData[benchmarkData.length - 1].n), pad.top + ch);
        cCtx.lineTo(getX(benchmarkData[0].n), pad.top + ch);
        cCtx.closePath();
        cCtx.fillStyle = fillColor;
        cCtx.fill();
        // Curve Line
        cCtx.strokeStyle = strokeColor;
        cCtx.lineWidth = 2.5;
        cCtx.beginPath();
        benchmarkData.forEach((d, i) => {
            const x = getX(d.n);
            const y = getY(d[prop]);
            if (i === 0)
                cCtx.moveTo(x, y);
            else
                cCtx.lineTo(x, y);
        });
        cCtx.stroke();
        // Curve Vertices
        benchmarkData.forEach(d => {
            const x = getX(d.n);
            const y = getY(d[prop]);
            cCtx.beginPath();
            cCtx.arc(x, y, 4, 0, Math.PI * 2);
            cCtx.fillStyle = strokeColor;
            cCtx.fill();
            cCtx.strokeStyle = "#ffffff";
            cCtx.lineWidth = 1.8;
            cCtx.stroke();
        });
    }
    // Draw Distinct Plots
    plotCurve("bfMs", "#8b5cf6", "rgba(139, 92, 246, 0.08)");
    plotCurve("dcMs", "#0284c7", "rgba(2, 132, 199, 0.08)");
}
// Animation Controls
function stopAnimation() {
    isPlaying = false;
    if (animTimer !== null) {
        clearTimeout(animTimer);
        animTimer = null;
    }
    btnPlayPause.textContent = "Play";
}
function startAnimation() {
    if (animFrames.length === 0)
        recordExecutionTrace();
    if (currentFrameIdx >= animFrames.length - 1)
        currentFrameIdx = 0;
    isPlaying = true;
    btnPlayPause.textContent = "Pause";
    animLoop();
}
function animLoop() {
    if (!isPlaying)
        return;
    if (currentFrameIdx < animFrames.length - 1) {
        currentFrameIdx++;
        updateAnimControls();
        drawPlane();
        animTimer = window.setTimeout(animLoop, 320);
    }
    else {
        stopAnimation();
    }
}
// Event Listeners
btnRun.addEventListener("click", executeComparison);
btnGenOnly.addEventListener("click", generateDataset);
cornerCaseSelector.addEventListener("change", generateDataset);
coordRange.addEventListener("change", generateDataset);
btnRunBench.addEventListener("click", runBenchmarkScaling);
btnStepAnim.addEventListener("click", () => {
    if (animFrames.length === 0)
        executeComparison();
    startAnimation();
});
btnPlayPause.addEventListener("click", () => {
    if (isPlaying)
        stopAnimation();
    else
        startAnimation();
});
btnNextStep.addEventListener("click", () => {
    stopAnimation();
    if (currentFrameIdx < animFrames.length - 1) {
        currentFrameIdx++;
        updateAnimControls();
        drawPlane();
    }
});
btnPrevStep.addEventListener("click", () => {
    stopAnimation();
    if (currentFrameIdx > 0) {
        currentFrameIdx--;
        updateAnimControls();
        drawPlane();
    }
});
animScrubber.addEventListener("input", e => {
    stopAnimation();
    currentFrameIdx = parseInt(e.target.value, 10);
    updateAnimControls();
    drawPlane();
});
planeCanvas.addEventListener("mousemove", e => {
    const rect = planeCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { w, h } = initDPI(planeCanvas, pCtx);
    const pad = 40;
    if (!points.length)
        return;
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    let minX = Math.min(...xs), maxX = Math.max(...xs);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    if (minX === maxX) {
        minX -= 5;
        maxX += 5;
    }
    if (minY === maxY) {
        minY -= 5;
        maxY += 5;
    }
    const spanX = maxX - minX, spanY = maxY - minY;
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const ox = (w - spanX * scale) / 2 - minX * scale;
    const oy = (h - spanY * scale) / 2 + maxY * scale;
    let foundIdx = null;
    let minDist = 12;
    points.forEach((p, i) => {
        const sx = ox + p.x * scale;
        const sy = oy - p.y * scale;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < minDist) {
            minDist = d;
            foundIdx = i;
        }
    });
    if (foundIdx !== hoverPt) {
        hoverPt = foundIdx;
        drawPlane();
        if (hoverPt !== null) {
            const pt = points[hoverPt];
            hoverCoordBox.textContent = `Selected Point ID #${pt.id}: x = ${pt.x}, y = ${pt.y}`;
        }
        else {
            hoverCoordBox.textContent = "Hover over points on the plane to view exact (x, y) coordinates.";
        }
    }
});
window.addEventListener("resize", () => {
    drawPlane();
    drawChart();
});
// Initial boot
generateDataset();
executeComparison();
