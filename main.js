const vElement = document.getElementById('v_src');
const cElement = document.getElementById('out');
const ctx = cElement.getContext('2d');
const n = document.getElementById('n');
const s = document.getElementById('s');

let pwr = [0, 0];
let wasOpen = [false, false];

function checkOpen(pts) {
    let count = 0;
    const wrist = pts[0];
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    for (let i = 0; i < tips.length; i++) {
        const tip = pts[tips[i]];
        const pip = pts[pips[i]];
        if (Math.hypot(tip.x - wrist.x, tip.y - wrist.y) > Math.hypot(pip.x - wrist.x, pip.y - wrist.y)) count++;
    }
    return count >= 3;
}

function onResults(res) {
    cElement.width = vElement.videoWidth;
    cElement.height = vElement.videoHeight;
    ctx.save();
    ctx.clearRect(0, 0, cElement.width, cElement.height);

    let fL = false;
    let fR = false;

    n.style.display = 'none';
    s.style.display = 'none';

    if (res.multiHandLandmarks && res.multiHandedness) {
        res.multiHandLandmarks.forEach((pts, i) => {
            const label = res.multiHandedness[i].label;
            const isR = label === 'Right';
            const idx = isR ? 1 : 0;

            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00fbff';
            drawConnectors(ctx, pts, HAND_CONNECTIONS, { color: '#00d4ff', lineWidth: 3 });
            drawLandmarks(ctx, pts, { color: '#ffffff', lineWidth: 1, radius: 2 });
            ctx.restore();

            const open = checkOpen(pts);
            pwr[idx] += open ? 0.05 : -0.15;
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
                    const tx = (wrist.x + knk.x) / 2;
                    const ty = (wrist.y + knk.y) / 2;
                    s.style.left = `${(1 - tx) * window.innerWidth}px`;
                    s.style.top = `${ty * window.innerHeight}px`;
                    s.style.display = 'block';
                    s.style.opacity = pwr[idx];
                } else {
                    fL = true;
                    const dx = knk.x - wrist.x;
                    const dy = knk.y - wrist.y;
                    const tx = knk.x + (dx * 0.8);
                    const ty = knk.y + (dy * 0.8);
                    n.style.left = `${(1 - tx) * window.innerWidth}px`;
                    n.style.top = `${(ty * window.innerHeight) - 120}px`;
                    n.style.display = 'block';
                    n.style.opacity = pwr[idx];
                }
            }
        });
    }

    if (!fL) {
        pwr[0] = Math.max(0, pwr[0] - 0.15);
        if (pwr[0] > 0.01) { n.style.display = 'block'; n.style.opacity = pwr[0]; }
        wasOpen[0] = false;
    }
    if (!fR) {
        pwr[1] = Math.max(0, pwr[1] - 0.15);
        if (pwr[1] > 0.01) { s.style.display = 'block'; s.style.opacity = pwr[1]; }
        wasOpen[1] = false;
    }
    ctx.restore();
}

const h = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
});

h.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
});

h.onResults(onResults);

const cam = new Camera(vElement, {
    onFrame: async () => { await h.send({ image: vElement }); },
    width: 1280, height: 720
});
cam.start();
