const TWO_PI = Math.PI * 2;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Slow-drifting teal dust at several depths, drawn behind the orb.
 * In "analysing" mode the field streams inward toward the core.
 */
export function createParticles(count = 300) {
  let width = 0;
  let height = 0;
  const dots = [];

  function seed() {
    dots.length = 0;
    for (let i = 0; i < count; i += 1) {
      const depth = rand(0.18, 1);
      const angle = rand(0, TWO_PI);
      const speed = rand(2, 9) * depth;
      dots.push({
        x: Math.random(),
        y: Math.random(),
        depth,
        size: rand(0.4, 1.5) * depth,
        alpha: rand(0.2, 0.72) * depth,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        twinkle: rand(0, TWO_PI),
        twinkleSpeed: rand(0.3, 1.4),
      });
    }
  }

  seed();

  return {
    resize(w, h) {
      width = w;
      height = h;
    },
    update(dt, mode, cx, cy) {
      const streaming = mode === "analysing";
      for (const d of dots) {
        if (streaming) {
          const px = d.x * width;
          const py = d.y * height;
          const dx = cx - px;
          const dy = cy - py;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = 150 * d.depth;
          d.x += ((dx / dist) * pull * dt) / width;
          d.y += ((dy / dist) * pull * dt) / height;
          if (dist < 40) {
            d.x = Math.random();
            d.y = Math.random();
          }
          continue;
        }
        d.x += (d.vx * dt) / (width || 1);
        d.y += (d.vy * dt) / (height || 1);
        if (d.x < -0.02) d.x = 1.02;
        if (d.x > 1.02) d.x = -0.02;
        if (d.y < -0.02) d.y = 1.02;
        if (d.y > 1.02) d.y = -0.02;
      }
    },
    draw(ctx, fade, color) {
      const r = Math.round(color[0]);
      const g = Math.round(color[1]);
      const b = Math.round(color[2]);
      for (const d of dots) {
        d.twinkle += 0.016 * d.twinkleSpeed;
        const a = d.alpha * fade * (0.65 + 0.35 * Math.sin(d.twinkle));
        if (a <= 0.004) continue;
        ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        const s = d.size;
        ctx.fillRect(d.x * width - s / 2, d.y * height - s / 2, s, s);
      }
    },
  };
}
