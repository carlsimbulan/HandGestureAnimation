const vElement = document.getElementById('v_src');
const cElement = document.getElementById('out');
const ctx = cElement.getContext('2d');
const n = document.getElementById('n');
const s = document.getElementById('s');
const eyeL = document.getElementById('eye-l');
const eyeR = document.getElementById('eye-r');
const handDot = document.getElementById('hand-dot');
const handLabel = document.getElementById('hand-label');
const cameraWrap = document.getElementById('camera-wrap');

// ── Indicator ──────────────────────────────────────────────
function setHandIndicator(detected) {
    if (detected) {
        handDot.classList.add('detected');
        handLabel.textContent = 'Hand Detected';
    } else {
        handDot.classList.remove('detected');
        handLabel.textContent = 'No Hand';
    }
}

// ── State ──────────────────────────────────────────────────
let pwr = [0, 0];
let wasOpen = [false, false];
let eyePwr = 0;           // power for eye fire effect
let wasPeace = false;
let eyePositions = null;  // { lx, ly, rx, ry } from face mesh
let latestFaceLandmarks = null; // stored from face mesh, drawn in hand frame

// ── Gesture detectors ──────────────────────────────────────
function checkOpen(pts) {
    let count = 0;
    const wrist = pts[0];
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    for (let i = 0; i < tips.length; i++) {
        const tip = pts[tips[i]];
        const pip = pts[pips[i]];
        if (Math.hypot(tip.x - wrist.x, tip.y - wrist.y) >
            Math.hypot(pip.x - wrist.x, pip.y - wrist.y)) count++;
    }
    return count >= 3;
}

// Peace sign: index (8) and middle (12) up, ring (16) and pinky (20) down, thumb tucked
function checkPeace(pts) {
    const wrist = pts[0];

    const indexTip = pts[8],  indexPip = pts[6];
    const middleTip = pts[12], middlePip = pts[10];
    const ringTip = pts[16],  ringPip = pts[14];
    const pinkyTip = pts[20], pinkyPip = pts[18];

    const indexUp  = Math.hypot(indexTip.x - wrist.x,  indexTip.y - wrist.y)  > Math.hypot(indexPip.x - wrist.x,  indexPip.y - wrist.y);
    const middleUp = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) > Math.hypot(middlePip.x - wrist.x, middlePip.y - wrist.y);
    const ringDown = Math.hypot(ringTip.x - wrist.x,   ringTip.y - wrist.y)   < Math.hypot(ringPip.x - wrist.x,   ringPip.y - wrist.y);
    const pinkyDown= Math.hypot(pinkyTip.x - wrist.x,  pinkyTip.y - wrist.y)  < Math.hypot(pinkyPip.x - wrist.x,  pinkyPip.y - wrist.y);

    return indexUp && middleUp && ringDown && pinkyDown;
}

// ── Hand results ───────────────────────────────────────────
function onHandResults(res) {
    cElement.width = vElement.videoWidth;
    cElement.height = vElement.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, cElement.width, cElement.height);

    const rect = cameraWrap.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;



    let fL = false;
    let fR = false;
    let handDetected = false;
    let peace = false;

    n.style.display = 'none';
    s.style.display = 'none';

    if (res.multiHandLandmarks && res.multiHandedness && res.multiHandLandmarks.length > 0) {
        handDetected = true;

        res.multiHandLandmarks.forEach((pts, i) => {
            const label = res.multiHandedness[i].label;
            const isR = label === 'Right';
            const idx = isR ? 1 : 0;

            // Skeleton — mirrored feed: Right label = blue (appears left), Left label = red (appears right)
            ctx.save();
            ctx.shadowBlur = 14;
            ctx.shadowColor = isR ? '#00aaff' : '#ff2244';
            drawConnectors(ctx, pts, HAND_CONNECTIONS, {
                color: isR ? '#00aaff' : '#ff2244',
                lineWidth: 3
            });
            drawLandmarks(ctx, pts, { color: '#ffffff', lineWidth: 1, radius: 3 });
            ctx.restore();

            // Check peace sign (either hand triggers eye fire)
            if (checkPeace(pts)) peace = true;

            const open = checkOpen(pts);
            pwr[idx] += open ? 0.08 : -0.06;
            pwr[idx] = Math.max(0, Math.min(1, pwr[idx]));

            if (open && !wasOpen[idx]) {
                const vid = isR ? s : n;
                vid.currentTime = 0;
                vid.play();
            }
            wasOpen[idx] = open;

            const wrist = pts[0];
            const knk = pts[9];

            if (pwr[idx] > 0.01) {
                if (isR) {
                    fR = true;
                    const tx = (1 - (wrist.x + knk.x) / 2) * W;
                    const ty = ((wrist.y + knk.y) / 2) * H;
                    s.style.left = `${tx}px`;
                    s.style.top = `${ty}px`;
                    s.style.display = 'block';
                    s.style.opacity = pwr[idx];
                } else {
                    fL = true;
                    const dx = knk.x - wrist.x;
                    const dy = knk.y - wrist.y;
                    const tx = (1 - (knk.x + dx * 0.8)) * W;
                    const ty = (knk.y + dy * 0.8) * H - 80;
                    n.style.left = `${tx}px`;
                    n.style.top = `${ty}px`;
                    n.style.display = 'block';
                    n.style.opacity = pwr[idx];
                }
            }
        });
    }

    if (!fL) {
        pwr[0] = Math.max(0, pwr[0] - 0.06);
        if (pwr[0] > 0.01) { n.style.display = 'block'; n.style.opacity = pwr[0]; }
        wasOpen[0] = false;
    }
    if (!fR) {
        pwr[1] = Math.max(0, pwr[1] - 0.06);
        if (pwr[1] > 0.01) { s.style.display = 'block'; s.style.opacity = pwr[1]; }
        wasOpen[1] = false;
    }

    // ── Eye fire logic ──
    if (peace && !wasPeace) {
        eyeL.currentTime = 0; eyeL.play();
        eyeR.currentTime = 0; eyeR.play();
    }
    wasPeace = peace;

    eyePwr += peace ? 0.1 : -0.08;
    eyePwr = Math.max(0, Math.min(1, eyePwr));

    if (eyePwr > 0.01 && eyePositions) {
        const rect2 = cameraWrap.getBoundingClientRect();
        const W2 = rect2.width;
        const H2 = rect2.height;

        // Mirror x for both eyes
        eyeL.style.left = `${(1 - eyePositions.lx) * W2}px`;
        eyeL.style.top  = `${eyePositions.ly * H2}px`;
        eyeL.style.display = 'block';
        eyeL.style.opacity = eyePwr;

        eyeR.style.left = `${(1 - eyePositions.rx) * W2}px`;
        eyeR.style.top  = `${eyePositions.ry * H2}px`;
        eyeR.style.display = 'block';
        eyeR.style.opacity = eyePwr;
    } else if (eyePwr <= 0.01) {
        eyeL.style.display = 'none';
        eyeR.style.display = 'none';
    }

    ctx.restore();
    setHandIndicator(handDetected);
}

// ── Face Mesh results ──────────────────────────────────────
function onFaceResults(res) {
    if (!res.multiFaceLandmarks || res.multiFaceLandmarks.length === 0) {
        latestFaceLandmarks = null;
        eyePositions = null;
        return;
    }
    const lm = res.multiFaceLandmarks[0];
    latestFaceLandmarks = lm;

    // Only track eye positions — no drawing
    const lEye = lm[468] || lm[33];
    const rEye = lm[473] || lm[263];
    eyePositions = {
        lx: lEye.x,
        ly: lEye.y - 0.04,
        rx: rEye.x,
        ry: rEye.y - 0.04
    };
}

// ── MediaPipe setup ────────────────────────────────────────
const h = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});
h.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
h.onResults(onHandResults);

const faceMesh = new FaceMesh({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,       // enables iris landmarks 468 & 473
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onFaceResults);

// ── Camera — send frame to both pipelines ──────────────────
const cam = new Camera(vElement, {
    onFrame: async () => {
        await h.send({ image: vElement });
        await faceMesh.send({ image: vElement });
    },
    width: 1280, height: 720
});
cam.start();
