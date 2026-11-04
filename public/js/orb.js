import { createParticles } from "./particles.js";

const TWO_PI = Math.PI * 2;

export const STATE_ORDER = [
  "boot",
  "standby",
  "listening",
  "thinking",
  "analysing",
  "speaking",
  "error",
];

export const STATE_COLORS = {
  boot: [61, 90, 94],
  standby: [25, 211, 196],
  listening: [25, 211, 196],
  thinking: [143, 107, 255],
  analysing: [255, 177, 59],
  speaking: [127, 243, 255],
  error: [255, 77, 94],
};

const REST_WOBBLE = 0.026;
const WILD_WOBBLE = 0.34;
const RING_SEGMENTS = 168;
const THIN_RINGS = 7;
const EASE_SECONDS = 0.6;

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function lighten(rgb, amount) {
  return mix(rgb, [235, 255, 255], amount);
}

function deepen(rgb, amount) {
  return mix(rgb, [3, 26, 34], amount);
}

function rgba(rgb, alpha) {
  return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${alpha})`;
}

export function colorCss(state) {
  const c = STATE_COLORS[state];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function createOrb(canvas) {
  const ctx = canvas.getContext("2d");
  const particles = createParticles(300);
  const wobblePhases = [0.7, 2.1, 4.4].map(() => Math.random() * TWO_PI);
  const ringSeeds = Array.from({ length: THIN_RINGS + 2 }, () => Math.random() * TWO_PI);
  const canConic = typeof ctx.createConicGradient === "function";

  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let radius = 0;

  let state = "boot";
  let colorFrom = STATE_COLORS.boot.slice();
  let colorTo = STATE_COLORS.boot.slice();
  let colorT = 1;
  let color = colorFrom.slice();

  let boot = { phase: 1, t: 0 };
  let level = null;
  let running = false;
  let rafId = 0;
  let last = 0;
  let clock = 0;
  let flicker = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
    radius = Math.min(width, height) * 0.22;
    particles.resize(width, height);
  }

  function setState(next) {
    if (next === state || !STATE_COLORS[next]) return;
    state = next;
    colorFrom = color.slice();
    colorTo = STATE_COLORS[next].slice();
    colorT = 0;
  }

  /** phase 1..5 with progress t while booting; pass null when online. */
  function setBootPhase(phase, t) {
    boot = phase === null ? null : { phase, t };
  }

  function setLevel(value) {
    level = value;
  }

  function idleLevel(time) {
    if (state === "listening") {
      return 0.35 + 0.25 * Math.sin(time * 3.1) + 0.15 * Math.sin(time * 7.3);
    }
    if (state === "speaking") return 0.4 + 0.35 * Math.abs(Math.sin(time * 6.2));
    return 0;
  }

  function wobble(theta, time, amp) {
    return (
      amp *
      (0.55 * Math.sin(3 * theta + time * 0.7 + wobblePhases[0]) +
        0.3 * Math.sin(5 * theta - time * 1.1 + wobblePhases[1]) +
        0.15 * Math.sin(8 * theta + time * 1.7 + wobblePhases[2]))
    );
  }

  function outerPath(time, scale, amp, ripple) {
    const path = new Path2D();
    for (let i = 0; i <= RING_SEGMENTS; i += 1) {
      const theta = (i / RING_SEGMENTS) * TWO_PI;
      const rr =
        radius *
        scale *
        (1 + wobble(theta, time, amp) + ripple * Math.sin(theta * 9 - time * 6));
      const x = cx + rr * Math.cos(theta);
      const y = cy + rr * Math.sin(theta);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    return path;
  }

  /** Bright at the bottom-left and bottom, deeper teal toward the top. */
  function rimStyle(bright, mid, deep) {
    if (canConic) {
      const g = ctx.createConicGradient(0, cx, cy);
      g.addColorStop(0.0, rgba(mid, 0.8));
      g.addColorStop(0.16, rgba(bright, 0.95));
      g.addColorStop(0.32, rgba(bright, 1));
      g.addColorStop(0.46, rgba(mid, 0.78));
      g.addColorStop(0.62, rgba(deep, 0.5));
      g.addColorStop(0.75, rgba(deep, 0.34));
      g.addColorStop(0.9, rgba(deep, 0.55));
      g.addColorStop(1.0, rgba(mid, 0.8));
      return g;
    }
    const g = ctx.createLinearGradient(cx - radius, cy + radius, cx, cy - radius);
    g.addColorStop(0, rgba(bright, 1));
    g.addColorStop(0.55, rgba(mid, 0.8));
    g.addColorStop(1, rgba(deep, 0.6));
    return g;
  }

  function drawOuterRing(time, alpha, amp, ripple, broken) {
    const bright = lighten(color, 0.68);
    const mid = deepen(color, 0.05);
    const deep = deepen(color, 0.55);
    const path = outerPath(time, 1, amp, ripple);
    ctx.globalAlpha = alpha * flicker;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (broken) ctx.setLineDash([radius * 0.26, radius * 0.13]);
    for (const [w, a] of [
      [radius * 0.3, 0.045],
      [radius * 0.17, 0.09],
      [radius * 0.09, 0.18],
      [radius * 0.045, 0.34],
    ]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = rgba(bright, a);
      ctx.stroke(path);
    }
    ctx.lineWidth = Math.max(2, radius * 0.036);
    ctx.strokeStyle = rimStyle(bright, mid, deep);
    ctx.stroke(path);
    if (broken) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** Bloom hugging the rim: brightest at the lower-left, thinning outward. */
  function drawBloom(alpha) {
    const bright = lighten(color, 0.5);
    const reach = radius * 1.45;
    const g = ctx.createRadialGradient(
      cx - radius * 0.34,
      cy + radius * 0.34,
      radius * 0.55,
      cx,
      cy,
      reach,
    );
    g.addColorStop(0.55, rgba(bright, 0.02 * alpha));
    g.addColorStop(0.76, rgba(bright, 0.22 * alpha));
    g.addColorStop(0.88, rgba(bright, 0.09 * alpha));
    g.addColorStop(1, rgba(bright, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, reach, 0, TWO_PI);
    ctx.fill();
  }

  function drawHalo(alpha, scale) {
    const soft = lighten(color, 0.2);
    const reach = radius * 1.5 * scale;
    const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, reach);
    g.addColorStop(0, rgba(soft, 0.07 * alpha));
    g.addColorStop(0.55, rgba(soft, 0.05 * alpha));
    g.addColorStop(1, rgba(soft, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, reach, 0, TWO_PI);
    ctx.fill();
  }

  /** Fine radial hatch at the centre, dark teal with a faint glow. */
  function drawCore(reveal, time) {
    if (reveal <= 0.001) return;
    const coreR = radius * 0.3;
    const inner = radius * 0.045;
    const spokes = 216;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.05);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(color, 0.075 * reveal);
    for (let i = 0; i < spokes; i += 1) {
      const theta = (i / spokes) * TWO_PI;
      const end = inner + (coreR - inner) * reveal * (0.82 + 0.18 * Math.sin(i * 3.9 + time));
      ctx.beginPath();
      ctx.moveTo(Math.cos(theta) * inner, Math.sin(theta) * inner);
      ctx.lineTo(Math.cos(theta) * end, Math.sin(theta) * end);
      ctx.stroke();
    }
    ctx.restore();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * reveal);
    g.addColorStop(0, rgba(lighten(color, 0.15), 0.1 * reveal));
    g.addColorStop(0.55, rgba(color, 0.05 * reveal));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * reveal, 0, TWO_PI);
    ctx.fill();
  }

  function drawThinRings(count, time, spin, boost) {
    for (let i = 0; i < count; i += 1) {
      const f = count === 1 ? 0.5 : i / (count - 1);
      const rr = radius * (0.34 + 0.52 * f);
      const dir = i % 2 === 0 ? 1 : -1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(lighten(color, 0.1), 0.1 * flicker);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, TWO_PI);
      ctx.stroke();
      const a = time * (0.06 + 0.02 * i) * dir * spin + ringSeeds[i];
      const span = 0.55 + 0.25 * Math.sin(time * 0.6 + i);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rgba(lighten(color, 0.4), (0.2 + 0.1 * boost) * flicker);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a, a + span);
      ctx.stroke();
    }
  }

  function drawInnerRings(time, spin, alpha) {
    const rings = [
      { r: 0.66, w: 2.2, gap: 0.5, glow: true },
      { r: 0.52, w: 1.6, gap: 0.34, glow: false },
    ];
    for (const ring of rings) {
      const rr = radius * ring.r;
      const a = time * 0.12 * spin;
      if (ring.glow) {
        ctx.lineWidth = ring.w * 4;
        ctx.strokeStyle = rgba(lighten(color, 0.3), 0.1 * alpha);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, a + ring.gap, a + TWO_PI);
        ctx.stroke();
      }
      ctx.lineWidth = ring.w;
      ctx.strokeStyle = rgba(lighten(color, 0.25), 0.42 * alpha * flicker);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a + ring.gap, a + TWO_PI);
      ctx.stroke();
    }
  }

  function drawScanArcs(time) {
    for (const [i, f] of [0.42, 0.58, 0.74, 0.9].entries()) {
      const a = time * (1.6 + i * 0.5);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = rgba(lighten(color, 0.45), 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * f, a, a + 0.7);
      ctx.stroke();
    }
  }

  function drawIgnitionPoint(t) {
    const r = 1 + t * radius * 0.05;
    const reach = r * 6;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
    g.addColorStop(0, rgba(lighten(color, 0.7), 0.9));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, reach, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = rgba([230, 255, 255], 0.95);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fill();
  }

  function updateColor(dt) {
    if (colorT < 1) {
      colorT = Math.min(1, colorT + dt / EASE_SECONDS);
      color = mix(colorFrom, colorTo, easeInOut(colorT));
    }
    // The stabilising phase carries the boot color up to full teal.
    if (boot && boot.phase === 4) {
      color = mix(STATE_COLORS.boot, STATE_COLORS.standby, easeInOut(Math.min(1, boot.t)));
    }
  }

  function drawBody(time, spin, boost, ripple, broken, outerAlpha, amp, scale) {
    drawHalo(outerAlpha, scale);
    drawBloom(outerAlpha);
    drawOuterRing(time, outerAlpha, amp, ripple, broken);
    drawCore(1, time);
    drawThinRings(THIN_RINGS, time, spin, boost);
    drawInnerRings(time, spin, 1);
    if (state === "analysing") drawScanArcs(time);
  }

  function drawBootBody(time) {
    const { phase, t } = boot;
    particles.draw(ctx, phase === 1 ? t : 1, color);
    if (phase === 1) {
      drawIgnitionPoint(t);
      return;
    }
    if (phase === 2) {
      drawCore(t, time);
      return;
    }
    if (phase === 3) {
      drawCore(1, time);
      drawThinRings(Math.max(1, Math.floor(1 + t * (THIN_RINGS - 1))), time, 1, 0);
      if (t > 0.55) drawInnerRings(time, 1, (t - 0.55) / 0.45);
      return;
    }
    // Phase 4 wild distortion settling with overshoot, phase 5 at rest.
    const settled =
      phase === 4
        ? Math.max(
            REST_WOBBLE * 0.4,
            REST_WOBBLE + (WILD_WOBBLE - REST_WOBBLE) * Math.exp(-4.2 * t) * Math.cos(5.4 * t),
          )
        : REST_WOBBLE;
    const alpha = phase === 4 ? 0.3 + 0.7 * t : 1;
    drawCore(1, time);
    drawThinRings(THIN_RINGS, time, 1, 0);
    drawInnerRings(time, 1, 1);
    drawHalo(alpha, 1);
    drawBloom(alpha);
    drawOuterRing(time, alpha, settled, 0, false);
  }

  function drawOnline(time) {
    const value = level === null ? idleLevel(time) : level;
    let spin = 1;
    let boost = 0;
    let ripple = 0;
    let amp = REST_WOBBLE;
    let scale = 1;
    let broken = false;
    if (state === "thinking") spin = 2.4;
    if (state === "analysing") boost = 1;
    if (state === "speaking") scale = 1 + 0.045 * value;
    if (state === "listening") ripple = 0.006 + 0.02 * value;
    if (state === "error") {
      broken = true;
      amp = REST_WOBBLE * (1 + Math.random() * 2.2);
    }
    particles.draw(ctx, 1, color);
    drawBody(time, spin, boost, ripple, broken, 1, amp, scale);
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    if (state === "error") {
      flicker = Math.random() < 0.22 ? 0.25 + Math.random() * 0.4 : 1;
    } else {
      flicker = 1;
    }
    if (boot) drawBootBody(time);
    else drawOnline(time);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    clock += dt;
    updateColor(dt);
    particles.update(dt, state, cx, cy);
    draw(clock);
    rafId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  return {
    resize,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    setState,
    setBootPhase,
    setLevel,
    getState: () => state,
    cssColor() {
      const c = color.map((v) => Math.round(v));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    },
  };
}
