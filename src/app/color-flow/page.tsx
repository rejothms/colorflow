"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.scss";

// ─── Perlin noise ─────────────────────────────────────────────────────────────
const PERM = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const out = new Uint8Array(512);
  for (let i = 0; i < 512; i++) out[i] = p[i & 255];
  return out;
})();

const G2: [number, number][] = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1],  [0, -1],
];

function pnoise(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  const dot = (h: number, dx: number, dy: number) => G2[h & 7][0] * dx + G2[h & 7][1] * dy;
  const aa = PERM[PERM[xi] + yi];
  const ba = PERM[PERM[xi + 1] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const bb = PERM[PERM[xi + 1] + yi + 1];
  return lerp(
    lerp(dot(aa, xf, yf),     dot(ba, xf - 1, yf),     u),
    lerp(dot(ab, xf, yf - 1), dot(bb, xf - 1, yf - 1), u),
    v,
  );
}

/** Fractional Brownian Motion — stacks octaves for turbulent detail */
function fbm(x: number, y: number, oct = 3): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < oct; i++, amp *= 0.5, freq *= 2.1)
    val += pnoise(x * freq, y * freq) * amp;
  return val;
}

/**
 * Curl noise: derives a divergence-free 2-D velocity field from a scalar
 * noise field by taking its rotated gradient — produces swirling, flame-like
 * motion with no sources or sinks.
 */
function curlNoise(x: number, y: number, t: number) {
  const e = 1.0;
  const s = 0.003;
  const tx = t * 0.055;
  const n1 = fbm(x * s,       (y + e) * s + tx);
  const n2 = fbm(x * s,       (y - e) * s + tx);
  const n3 = fbm((x + e) * s, y * s + tx);
  const n4 = fbm((x - e) * s, y * s + tx);
  return {
    x:  (n1 - n2) / (2 * e),
    y: -(n3 - n4) / (2 * e),
  };
}

/** Extract raw 0-255 RGB channels from a CSS hex colour */
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ─── Particle ─────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  baseSize: number;
}

const MAX_PARTICLES = 5000;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ColorFlowPage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pointerRef   = useRef({ x: 0, y: 0, px: 0, py: 0, pressing: false });
  const timeRef      = useRef(0);
  const animRef      = useRef<number | null>(null);
  const colorRef     = useRef("#ff8800");

  const [color, setColor] = useState("#ff8800");
  useEffect(() => { colorRef.current = color; }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    resize();

    const onMouseDown = (e: MouseEvent) => {
      pointerRef.current.pressing = true;
      pointerRef.current.px = e.clientX;
      pointerRef.current.py = e.clientY;
      pointerRef.current.x  = e.clientX;
      pointerRef.current.y  = e.clientY;
      spawnBurst(e.clientX, e.clientY, 55);
    };
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - pointerRef.current.x;
      const dy = e.clientY - pointerRef.current.y;
      pointerRef.current.px = pointerRef.current.x;
      pointerRef.current.py = pointerRef.current.y;
      pointerRef.current.x  = e.clientX;
      pointerRef.current.y  = e.clientY;
      spawnTrail(e.clientX, e.clientY, dx, dy);
    };
    const onMouseUp = () => { pointerRef.current.pressing = false; };
    const onTouchStart = (e: TouchEvent) => {
      pointerRef.current.pressing = true;
      pointerRef.current.px = e.touches[0].clientX;
      pointerRef.current.py = e.touches[0].clientY;
      pointerRef.current.x  = e.touches[0].clientX;
      pointerRef.current.y  = e.touches[0].clientY;
      spawnBurst(e.touches[0].clientX, e.touches[0].clientY, 55);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const dx = e.touches[0].clientX - pointerRef.current.x;
      const dy = e.touches[0].clientY - pointerRef.current.y;
      pointerRef.current.px = pointerRef.current.x;
      pointerRef.current.py = pointerRef.current.y;
      pointerRef.current.x  = e.touches[0].clientX;
      pointerRef.current.y  = e.touches[0].clientY;
      spawnTrail(e.touches[0].clientX, e.touches[0].clientY, dx, dy);
    };
    const onTouchEnd = () => { pointerRef.current.pressing = false; };

    window.addEventListener("resize",     resize);
    window.addEventListener("mousedown",  onMouseDown);
    window.addEventListener("mousemove",  onMouseMove);
    window.addEventListener("mouseup",    onMouseUp);
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove",  onTouchMove,  { passive: false });
    window.addEventListener("touchend",   onTouchEnd);

    function spawnBurst(x: number, y: number, count: number) {
      for (let i = 0; i < count; i++) {
        if (particlesRef.current.length >= MAX_PARTICLES) break;
        const side   = i % 2 === 0 ? 1 : -1;
        const spread = (Math.random() - 0.5) * (Math.PI * 0.78);
        const speed  = 4 + Math.random() * 7;
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: side * speed * Math.cos(spread),
          vy: speed * Math.sin(spread),
          life:     0,
          maxLife:  45 + Math.random() * 45,
          baseSize: 18 + Math.random() * 28,
        });
      }
    }

    // Directional trail: particles flow along mouse movement direction.
    // Count scales with speed so fast moves leave a denser stream.
    function spawnTrail(x: number, y: number, dx: number, dy: number) {
      const speed = Math.sqrt(dx * dx + dy * dy);
      if (speed < 1) return;
      const angle = Math.atan2(dy, dx);
      const count = Math.min(12, Math.ceil(speed * 0.6));
      for (let i = 0; i < count; i++) {
        if (particlesRef.current.length >= MAX_PARTICLES) break;
        // Narrow spread (±25°) so particles stream along the movement path
        const spread = (Math.random() - 0.5) * (Math.PI * 0.28);
        const spd    = 4 + Math.random() * 7;
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 16,
          vx: spd * Math.cos(angle + spread),
          vy: spd * Math.sin(angle + spread),
          life:     0,
          maxLife:  45 + Math.random() * 45,
          baseSize: 18 + Math.random() * 28,
        });
      }
    }

    function frame() {
      timeRef.current++;
      const t = timeRef.current;
      const W = canvas.width;
      const H = canvas.height;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, W, H);

      if (particlesRef.current.length > MAX_PARTICLES)
        particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);

      const [cr, cg, cb] = hexToRgb(colorRef.current);

      ctx.globalCompositeOperation = "source-over";

      particlesRef.current = particlesRef.current.filter(p => {
        p.life++;
        if (p.life >= p.maxLife) return false;

        const ratio = p.life / p.maxLife;

        const curl = curlNoise(p.x, p.y, t);
        p.vx += curl.x * 0.09;
        p.vy += curl.y * 0.09;
        p.vx *= 0.965;
        p.vy *= 0.965;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 7) { p.vx *= 7 / spd; p.vy *= 7 / spd; }
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -120 || p.x > W + 120 || p.y < -160 || p.y > H + 120) return false;

        const radius = p.baseSize * (1 + ratio * 2.2);
        const envelope =
          ratio < 0.08  ? ratio / 0.08
          : ratio > 0.55 ? 1 - (ratio - 0.55) / 0.45
          : 1.0;
        // Filled gaussian: full colour at centre, transparent at edge
        const pa   = envelope * 0.07;
        const fade = 1 - ratio * 0.85;
        const pr   = Math.round(cr * fade);
        const pg   = Math.round(cg * fade);
        const pb   = Math.round(cb * fade);

        // Stretch along velocity so the blob looks like a flowing smear
        const spd2    = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const angle   = Math.atan2(p.vy, p.vx);
        const stretch = 1 + Math.min(spd2 * 0.18, 2.2); // elongate up to 3.2×

        // Gradient is drawn in local space (radius × 1 circle), then
        // stretched by ctx transform into an ellipse
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        grad.addColorStop(0,    `rgba(${pr}, ${pg}, ${pb}, ${pa})`);
        grad.addColorStop(0.45, `rgba(${pr}, ${pg}, ${pb}, ${pa * 0.6})`);
        grad.addColorStop(1,    `rgba(${pr}, ${pg}, ${pb}, 0)`);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.scale(stretch, 1);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        return true;
      });

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize",     resize);
      window.removeEventListener("mousedown",  onMouseDown);
      window.removeEventListener("mousemove",  onMouseMove);
      window.removeEventListener("mouseup",    onMouseUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove",  onTouchMove);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  }, []);

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.controls}>
        <span className={styles.label}>Color</span>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className={styles.colorPicker}
          title="Pick fume colour"
        />
      </div>

      <p className={styles.hint}>Click or drag &mdash; touch works too</p>
    </div>
  );
}
