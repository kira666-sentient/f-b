"use client";

import { useEffect, useRef } from "react";

export default function LandingWaterfallScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* ── Mobile detection & performance tuning ─────── */
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const FPS_CAP = isMobile ? 30 : 60;
    const FRAME_MS = 1000 / FPS_CAP;

    let W = 0, H = 0;
    let dirty = true;

    /* ── Offscreen cache for static layers ──────────── */
    const bgCache = document.createElement("canvas");
    const bgCtx = bgCache.getContext("2d")!;

    let lastMobileWidth = 0;
    const resize = () => {
      // Prevent mobile address bar from thrashing canvas height
      if (isMobile && lastMobileWidth === window.innerWidth) return;
      lastMobileWidth = window.innerWidth;

      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgCache.width = W * dpr;
      bgCache.height = H * dpr;
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Bezier helpers ──────────────────────────────────
    const B = (a: number, b: number, c: number, d: number, t: number) =>
      (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
    const Bd = (a: number, b: number, c: number, d: number, t: number) =>
      3 * (1 - t) ** 2 * (b - a) + 6 * (1 - t) * t * (c - b) + 3 * t ** 2 * (d - c);

    const shift = isMobile ? -0.15 : 0;
    const SEGS = [
      { p0: [0.97 + shift, 0.01], p1: [0.84 + shift, 0.03], p2: [0.78 + shift, 0.30], p3: [0.74 + shift, 0.38] },
      { p0: [0.74 + shift, 0.38], p1: [0.68 + shift, 0.44], p2: [0.57 + shift, 0.56], p3: [0.52 + shift, 0.63] },
      { p0: [0.52 + shift, 0.63], p1: [0.44 + shift, 0.70], p2: [0.33 + shift, 0.80], p3: [0.28 + shift, 0.87] },
    ];

    const sampleArc = (seg: typeof SEGS[0], N = 90) => {
      const [x0, y0] = seg.p0, [bx1, by1] = seg.p1, [cx1, cy1] = seg.p2, [x3, y3] = seg.p3;
      return Array.from({ length: N + 1 }, (_, i) => {
        const t = i / N;
        const px = B(x0, bx1, cx1, x3, t) * W;
        const py = B(y0, by1, cy1, y3, t) * H;
        const dx = Bd(x0, bx1, cx1, x3, t);
        const dy = Bd(y0, by1, cy1, y3, t);
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = Math.abs(dy) / len;
        return { x: px, y: py, nx: -dy / len, ny: dx / len, speed };
      });
    };

    // ── Dynamic particles (reduced on mobile) ───────────
    const MIST_COUNT = isMobile ? 15 : 50;
    const FIREFLY_COUNT = isMobile ? 5 : 14;
    const POOL_SPARKLE_COUNT = isMobile ? 8 : 22;

    const MIST = Array.from({ length: MIST_COUNT }, () => ({
      bx: 0.10 + Math.random() * 0.72, by: 0.52 + Math.random() * 0.42,
      r: 22 + Math.random() * 42, sp: 0.009 + Math.random() * 0.016,
      ph: Math.random() * Math.PI * 2, a: 0.06 + Math.random() * 0.12,
    }));

    const FIREFLIES = Array.from({ length: FIREFLY_COUNT }, () => ({
      bx: 0.58 + Math.random() * 0.38, by: 0.55 + Math.random() * 0.38,
      r: 1.2 + Math.random() * 2, sp: 0.25 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2, drift: 0.008 + Math.random() * 0.014,
    }));

    interface Drop { x: number; y: number; vx: number; vy: number; life: number; ml: number; r: number; b: boolean }
    const drops: Drop[] = [];
    const spawnDrops = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) drops.push({
        x, y, vx: (Math.random() - 0.5) * 180, vy: -80 - Math.random() * 200,
        life: 0, ml: 0.35 + Math.random() * 0.5, r: 1.5 + Math.random() * 4, b: Math.random() > 0.45
      });
    };

    /* ══ STATIC LAYER drawing (cached) ════════════════ */
    const renderStaticLayers = (target: CanvasRenderingContext2D) => {
      // Sky
      const g = target.createLinearGradient(0, 0, W * 0.4, H * 0.65);
      g.addColorStop(0, "#c0d8ec"); g.addColorStop(0.5, "#d4e8f4"); g.addColorStop(1, "#e2f0f8");
      target.fillStyle = g; target.fillRect(0, 0, W, H);
      const warm = target.createRadialGradient(W * 0.92, H * 0.08, 0, W * 0.85, H * 0.20, W * 0.45);
      warm.addColorStop(0, "rgba(255,220,180,0.16)"); warm.addColorStop(0.4, "rgba(255,200,150,0.06)"); warm.addColorStop(1, "rgba(255,200,150,0)");
      target.fillStyle = warm; target.fillRect(0, 0, W, H);

      // Mountains
      const layers = [
        { c: "rgba(162,192,216,0.42)", p: [[0.38, 0.68], [0.52, 0.22], [0.66, 0.50], [0.80, 0.06], [0.94, 0.40], [1.08, 0.14], [1.28, 0.58]] },
        { c: "rgba(122,162,194,0.52)", p: [[0.44, 0.73], [0.57, 0.30], [0.71, 0.55], [0.84, 0.14], [0.97, 0.46], [1.11, 0.21], [1.30, 0.63]] },
        { c: "rgba(88,135,172,0.58)", p: [[0.50, 0.78], [0.62, 0.37], [0.76, 0.60], [0.88, 0.20], [1.01, 0.50], [1.14, 0.26], [1.32, 0.68]] },
      ];
      layers.forEach(({ c, p }) => { target.beginPath(); target.moveTo(p[0][0] * W, p[0][1] * H); for (let i = 1; i < p.length; i++) target.lineTo(p[i][0] * W, p[i][1] * H); target.lineTo(W * 1.4, H); target.lineTo(0, H); target.closePath(); target.fillStyle = c; target.fill(); });
      [[0.80, 0.06], [1.08, 0.14]].forEach(([mx, my]) => { target.beginPath(); target.moveTo(mx * W, my * H); target.lineTo((mx + 0.04) * W, (my + 0.16) * H); target.lineTo((mx - 0.04) * W, (my + 0.16) * H); target.closePath(); target.fillStyle = "rgba(255,255,255,0.60)"; target.fill(); });

      // Cliff
      const cg = target.createLinearGradient(W * 0.70, 0, W, H * 0.62);
      cg.addColorStop(0, "#7e6e5a"); cg.addColorStop(0.5, "#615040"); cg.addColorStop(1, "#3e3028");
      target.beginPath(); target.moveTo(W * 0.72, 0); target.lineTo(W, 0); target.lineTo(W, H * 0.62); target.lineTo(W * 0.92, H * 0.58); target.lineTo(W * 0.85, H * 0.50); target.lineTo(W * 0.80, H * 0.44); target.lineTo(W * 0.76, H * 0.38); target.lineTo(W * 0.74, H * 0.16); target.closePath(); target.fillStyle = cg; target.fill();
      const ovg = target.createLinearGradient(W * 0.72, 0, W * 0.78, H * 0.12);
      ovg.addColorStop(0, "#6a5a48"); ovg.addColorStop(1, "#4e3e2e");
      target.beginPath(); target.moveTo(W * 0.71, 0); target.lineTo(W * 0.76, 0); target.lineTo(W * 0.73, H * 0.10); target.lineTo(W * 0.70, H * 0.06); target.closePath(); target.fillStyle = ovg; target.fill();
      target.beginPath(); target.moveTo(W * 0.74, 0); target.lineTo(W * 0.72, H * 0.16); target.lineTo(W * 0.76, H * 0.38); target.lineTo(W * 0.78, H * 0.38); target.lineTo(W * 0.76, H * 0.14); target.lineTo(W * 0.76, 0); target.closePath(); target.fillStyle = "rgba(25,18,10,0.38)"; target.fill();
      target.save(); target.globalAlpha = 0.15; target.strokeStyle = "#3a2a1a"; target.lineWidth = 1.5;
      [[0.82, 0.08, 0.84, 0.22], [0.88, 0.04, 0.90, 0.18], [0.94, 0.10, 0.95, 0.28], [0.86, 0.28, 0.88, 0.42]].forEach(([x1, y1, x2, y2]) => { target.beginPath(); target.moveTo(x1 * W, y1 * H); target.lineTo(x2 * W, y2 * H); target.stroke(); });
      target.restore();
      [[0.74, 0.38, 0.14, 0.038], [0.52, 0.63, 0.12, 0.032]].forEach(([lx, ly, lw, lh]) => {
        const lg = target.createLinearGradient(lx * W, (ly - lh) * H, (lx + lw) * W, (ly + lh) * H);
        lg.addColorStop(0, "#907a62"); lg.addColorStop(1, "#5a4838");
        target.beginPath(); target.ellipse((lx + lw / 2) * W, ly * H, lw / 2 * W, lh * 1.4 * H, -0.1, 0, Math.PI * 2); target.fillStyle = lg; target.fill();
        target.beginPath(); target.ellipse((lx + lw / 2) * W, (ly - lh * 0.5) * H, lw / 2 * W * 0.88, lh * 0.55 * H, -0.1, 0, Math.PI * 2); target.fillStyle = "rgba(55,90,38,0.42)"; target.fill();
      });
      [[0.14, 0.82, 0.065, 0.044], [0.20, 0.86, 0.048, 0.035], [0.34, 0.88, 0.056, 0.038], [0.60, 0.80, 0.060, 0.042]].forEach(([bx, by, rr, ry]) => {
        const bg = target.createRadialGradient(bx * W - rr * W * 0.3, by * H - ry * H * 0.4, 1, bx * W, by * H, rr * W);
        bg.addColorStop(0, "#9a8870"); bg.addColorStop(1, "#47382a");
        target.beginPath(); target.ellipse(bx * W, by * H, rr * W, ry * H, -0.15, 0, Math.PI * 2); target.fillStyle = bg; target.fill();
      });
    };

    /* ══ DYNAMIC LAYERS (drawn every frame) ═══════════ */
    const drawForest = (t: number) => {
      const hillG = ctx.createLinearGradient(W * 0.55, H * 0.62, W, H);
      hillG.addColorStop(0, "rgba(58,100,48,0.50)"); hillG.addColorStop(0.5, "rgba(42,82,34,0.58)"); hillG.addColorStop(1, "rgba(28,58,22,0.65)");
      ctx.beginPath(); ctx.moveTo(W * 0.52, H); ctx.quadraticCurveTo(W * 0.60, H * 0.70, W * 0.76, H * 0.62); ctx.quadraticCurveTo(W * 0.90, H * 0.56, W, H * 0.62); ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = hillG; ctx.fill();
      const hill2 = ctx.createLinearGradient(W * 0.60, H * 0.75, W, H);
      hill2.addColorStop(0, "rgba(65,112,52,0.45)"); hill2.addColorStop(1, "rgba(48,88,38,0.55)");
      ctx.beginPath(); ctx.moveTo(W * 0.58, H); ctx.quadraticCurveTo(W * 0.68, H * 0.76, W * 0.84, H * 0.70); ctx.quadraticCurveTo(W * 0.94, H * 0.66, W, H * 0.72); ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = hill2; ctx.fill();

      const drawGhibliTree = (cx: number, cy: number, size: number, hue: number, sway: number) => {
        const sw = Math.sin(t * 0.35 + cx * 8) * size * 0.012 * sway;
        ctx.fillStyle = `rgba(${62 + hue * 3},${42 + hue * 2},${25 + hue},0.50)`;
        ctx.beginPath(); ctx.moveTo(cx + sw - 3, cy + size * 0.35); ctx.quadraticCurveTo(cx + sw - 4, cy + size * 0.7, cx + sw - 2, cy + size * 0.9); ctx.lineTo(cx + sw + 2, cy + size * 0.9); ctx.quadraticCurveTo(cx + sw + 4, cy + size * 0.7, cx + sw + 3, cy + size * 0.35); ctx.closePath(); ctx.fill();
        const layers: [number, number, number, number, string][] = [
          [-size * 0.28, -size * 0.08, size * 0.42, size * 0.52, `rgba(${40 + hue * 8},${72 + hue * 10},${30 + hue * 5},0.72)`],
          [size * 0.12, -size * 0.15, size * 0.38, size * 0.50, `rgba(${48 + hue * 8},${85 + hue * 10},${35 + hue * 5},0.68)`],
          [-size * 0.06, -size * 0.32, size * 0.34, size * 0.46, `rgba(${55 + hue * 8},${95 + hue * 10},${42 + hue * 5},0.65)`],
        ];
        layers.forEach(([ox, oy, rx, ry, col]) => { ctx.beginPath(); ctx.ellipse(cx + ox + sw, cy + oy, rx, ry, -0.08, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
        ctx.beginPath(); ctx.ellipse(cx - size * 0.15 + sw, cy - size * 0.28, size * 0.18, size * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${90 + hue * 12},${148 + hue * 10},${68 + hue * 8},0.28)`; ctx.fill();
      };

      // Reduce tree count on mobile
      if (!isMobile) {
        drawGhibliTree(W * 0.68, H * 0.56, W * 0.052, 2, 1); drawGhibliTree(W * 0.74, H * 0.52, W * 0.060, 3, 1.2);
        drawGhibliTree(W * 0.80, H * 0.50, W * 0.068, 1, 0.8); drawGhibliTree(W * 0.86, H * 0.48, W * 0.062, 4, 1);
        drawGhibliTree(W * 0.92, H * 0.52, W * 0.055, 2, 1.1); drawGhibliTree(W * 0.98, H * 0.56, W * 0.065, 3, 0.9);
        drawGhibliTree(W * 0.71, H * 0.62, W * 0.044, 5, 1.3); drawGhibliTree(W * 0.83, H * 0.58, W * 0.048, 2, 1);
        drawGhibliTree(W * 0.90, H * 0.60, W * 0.042, 4, 1.1); drawGhibliTree(W * 0.96, H * 0.63, W * 0.050, 1, 0.7);
      } else {
        drawGhibliTree(W * 0.74, H * 0.52, W * 0.060, 3, 1.2); drawGhibliTree(W * 0.86, H * 0.48, W * 0.062, 4, 1);
        drawGhibliTree(W * 0.92, H * 0.52, W * 0.055, 2, 1.1); drawGhibliTree(W * 0.83, H * 0.58, W * 0.048, 2, 1);
      }

      if (!isMobile) {
        const drawShrub = (sx: number, sy: number, sr: number) => {
          const sw = Math.sin(t * 0.45 + sx * 15) * sr * 0.03;
          for (let j = 0; j < 3; j++) {
            const ox = (j - 1) * sr * 0.6, oy = -j * sr * 0.15, rr = sr * (0.7 + j * 0.15);
            const bg = ctx.createRadialGradient(sx + ox + sw, sy + oy, rr * 0.1, sx + ox + sw, sy + oy, rr);
            bg.addColorStop(0, "rgba(72,120,55,0.60)"); bg.addColorStop(0.6, "rgba(48,92,38,0.50)"); bg.addColorStop(1, "rgba(32,65,25,0.20)");
            ctx.beginPath(); ctx.ellipse(sx + ox + sw, sy + oy, rr * 1.2, rr * 0.65, 0, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
          }
        };
        drawShrub(W * 0.64, H * 0.88, W * 0.025); drawShrub(W * 0.72, H * 0.90, W * 0.028); drawShrub(W * 0.80, H * 0.86, W * 0.024);
        drawShrub(W * 0.87, H * 0.91, W * 0.030); drawShrub(W * 0.93, H * 0.88, W * 0.026); drawShrub(W * 0.98, H * 0.90, W * 0.032);

        ctx.save(); ctx.globalAlpha = 0.35;
        [[0.92, 0.56, 0.055], [0.96, 0.59, 0.045], [0.88, 0.53, 0.06], [0.99, 0.63, 0.035]].forEach(([vx, vy, vl], i) => {
          const swing = Math.sin(t * 0.4 + i * 1.5) * 0.006;
          ctx.strokeStyle = "rgba(55,90,38,0.55)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(vx * W, vy * H); ctx.quadraticCurveTo((vx + swing) * W, (vy + vl * 0.5) * H, (vx + swing - 0.004) * W, (vy + vl) * H); ctx.stroke();
          for (let k = 0; k < 3; k++) {
            const vt = (k + 1) / 4, lx_ = vx + (swing * vt), ly_ = vy + vl * vt;
            ctx.beginPath(); ctx.ellipse(lx_ * W, ly_ * H, 4, 2.5, swing * 10, 0, Math.PI * 2); ctx.fillStyle = "rgba(68,115,45,0.50)"; ctx.fill();
          }
        });
        ctx.restore();
      }
    };

    const drawWaterfallGlow = (t: number) => {
      const centers: [number, number, number, number][] = [[0.86, 0.18, W * 0.18, 0.15], [0.78, 0.36, W * 0.16, 0.20], [0.64, 0.52, W * 0.14, 0.18], [0.42, 0.72, W * 0.16, 0.20], [0.28, 0.85, W * 0.20, 0.22]];
      centers.forEach(([gx, gy, gr, ga], i) => {
        const pulse = 0.85 + 0.15 * Math.sin(t * 0.6 + i * 1.2);
        const gg = ctx.createRadialGradient(gx * W, gy * H, 0, gx * W, gy * H, gr * pulse);
        gg.addColorStop(0, `rgba(140,200,240,${(ga * pulse).toFixed(3)})`); gg.addColorStop(0.3, `rgba(100,175,230,${(ga * 0.55 * pulse).toFixed(3)})`);
        gg.addColorStop(0.6, `rgba(70,150,215,${(ga * 0.22 * pulse).toFixed(3)})`); gg.addColorStop(1, "rgba(70,150,215,0)");
        ctx.beginPath(); ctx.arc(gx * W, gy * H, gr * pulse, 0, Math.PI * 2); ctx.fillStyle = gg; ctx.fill();
      });
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const streakA = 0.10 + 0.05 * Math.sin(t * 0.8);
      const sg = ctx.createLinearGradient(W * 0.97, H * 0.01, W * 0.28, H * 0.87);
      sg.addColorStop(0, `rgba(170,220,255,${streakA * 0.3})`); sg.addColorStop(0.15, `rgba(140,200,250,${streakA})`);
      sg.addColorStop(0.5, `rgba(110,180,240,${streakA * 0.8})`); sg.addColorStop(0.85, `rgba(90,165,235,${streakA})`); sg.addColorStop(1, `rgba(70,150,230,${streakA * 0.2})`);
      ctx.lineWidth = W * 0.030; ctx.strokeStyle = sg;
      ctx.beginPath(); ctx.moveTo(W * 0.95, H * 0.02); ctx.quadraticCurveTo(W * 0.80, H * 0.30, W * 0.74, H * 0.38); ctx.quadraticCurveTo(W * 0.62, H * 0.52, W * 0.52, H * 0.63); ctx.quadraticCurveTo(W * 0.38, H * 0.78, W * 0.28, H * 0.87); ctx.stroke();
      ctx.restore();
    };

    const drawLedgeBreaks = (t: number) => {
      const ledges: [number, number][] = [[SEGS[0].p3[0], SEGS[0].p3[1]], [SEGS[1].p3[0], SEGS[1].p3[1]]];
      ledges.forEach(([lx, ly], li) => {
        const cx_ = lx * W, cy_ = ly * H, foamW = W * 0.06, foamH = H * 0.018;
        for (let i = 0; i < 5; i++) {
          const phase = t * 1.2 + li * 2 + i * 1.3, spread = 0.4 + 0.6 * Math.abs(Math.sin(phase));
          const ox = (i - 2) * foamW * 0.25 * spread, oy = Math.sin(phase) * foamH * 0.3;
          const fr = 3 + 3 * Math.abs(Math.sin(phase * 0.8 + i)), fa = 0.5 + 0.3 * Math.abs(Math.sin(phase));
          ctx.beginPath(); ctx.arc(cx_ + ox, cy_ + oy, fr, 0, Math.PI * 2); ctx.fillStyle = `rgba(220,245,255,${fa})`; ctx.fill();
        }
        ctx.save(); ctx.globalAlpha = 0.35;
        for (let i = 0; i < 4; i++) {
          const ang = -0.6 + i * 0.4 + Math.sin(t * 0.9 + li + i) * 0.2, len = 8 + 6 * Math.abs(Math.sin(t * 1.1 + i * 1.7));
          ctx.strokeStyle = "rgba(200,240,255,0.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx_, cy_); ctx.lineTo(cx_ + Math.cos(ang) * len, cy_ + Math.sin(ang) * len); ctx.stroke();
        }
        ctx.restore();
        const mg = ctx.createRadialGradient(cx_, cy_ - foamH, 0, cx_, cy_ - foamH, foamW * 0.6);
        mg.addColorStop(0, `rgba(210,240,255,${0.20 + 0.10 * Math.sin(t * 0.7 + li)})`); mg.addColorStop(1, "rgba(210,240,255,0)");
        ctx.beginPath(); ctx.arc(cx_, cy_ - foamH, foamW * 0.6, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill();
      });
    };

    // Reduced passes on mobile
    const PASSES = isMobile ? [
      { col: [10, 60, 140], a: 0.35 }, { col: [30, 110, 195], a: 0.48 }, { col: [110, 200, 240], a: 0.56 }, { col: [220, 248, 255], a: 0.80 },
    ] : [
      { col: [10, 60, 140], a: 0.35 }, { col: [18, 85, 170], a: 0.42 }, { col: [30, 110, 195], a: 0.48 }, { col: [50, 145, 215], a: 0.50 },
      { col: [75, 175, 230], a: 0.52 }, { col: [110, 200, 240], a: 0.56 }, { col: [160, 225, 248], a: 0.65 }, { col: [220, 248, 255], a: 0.80 },
    ];

    const drawSegment = (pts: ReturnType<typeof sampleArc>, t: number, pi: number) => {
      const n = pts.length - 1;
      const getHW = (i: number) => W * (0.028 + 0.044 * (1 - pts[i].speed));
      PASSES.forEach(({ col, a }, pass) => {
        const scale = 0.5 + pass * 0.066, wob = Math.sin(t * 1.4 + pi * 1.6 + pass * 0.5) * 0.06;
        const L: number[] = [], R: number[] = [];
        pts.forEach((p, i) => { const hw = getHW(i) * scale * (1 + wob); L.push(p.x + p.nx * hw, p.y + p.ny * hw); R.push(p.x - p.nx * hw, p.y - p.ny * hw); });
        ctx.beginPath(); ctx.moveTo(L[0], L[1]);
        for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
        for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
        ctx.closePath();
        const p0 = pts[0], pN = pts[n];
        const gr = ctx.createLinearGradient(p0.x, p0.y, pN.x, pN.y);
        const [r, g, b] = col;
        gr.addColorStop(0, `rgba(${r},${g},${b},${(a * 0.22).toFixed(3)})`); gr.addColorStop(0.1, `rgba(${r},${g},${b},${a.toFixed(3)})`);
        gr.addColorStop(0.85, `rgba(${r},${g},${b},${(a * 0.88).toFixed(3)})`); gr.addColorStop(1, `rgba(${r},${g},${b},${(a * 0.18).toFixed(3)})`);
        ctx.fillStyle = gr; ctx.fill();
      });
    };

    const drawPool = (t: number) => {
      const px = SEGS[2].p3[0] * W, py = SEGS[2].p3[1] * H, prx = W * 0.21, pry = H * 0.046;
      const pg = ctx.createRadialGradient(px, py - pry * 0.55, pry * 0.05, px, py + pry * 0.2, prx);
      pg.addColorStop(0, "rgba(45,142,210,0.82)"); pg.addColorStop(0.45, "rgba(22,95,168,0.68)"); pg.addColorStop(1, "rgba(8,48,105,0.35)");
      ctx.beginPath(); ctx.ellipse(px, py, prx, pry, 0, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill();
      const poolGlow = ctx.createRadialGradient(px, py, prx * 0.5, px, py, prx * 1.3);
      poolGlow.addColorStop(0, "rgba(90,190,240,0)"); poolGlow.addColorStop(0.6, `rgba(90,190,240,${0.08 + 0.04 * Math.sin(t * 0.5)})`); poolGlow.addColorStop(1, "rgba(90,190,240,0)");
      ctx.beginPath(); ctx.ellipse(px, py, prx * 1.3, pry * 2.2, 0, 0, Math.PI * 2); ctx.fillStyle = poolGlow; ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a2 = t * 0.36 + i * 1.57, cx_ = px + Math.cos(a2) * prx * 0.28, cy_ = py + Math.sin(a2 * 0.68) * pry * 0.38;
        const cg = ctx.createRadialGradient(cx_, cy_, 0, cx_, cy_, prx * 0.24);
        cg.addColorStop(0, `rgba(180,240,255,${0.55 + 0.2 * Math.sin(t * 0.9 + i)})`); cg.addColorStop(1, "rgba(180,240,255,0)");
        ctx.beginPath(); ctx.ellipse(cx_, cy_, prx * 0.26, pry * 0.52, 0, 0, Math.PI * 2); ctx.fillStyle = cg; ctx.fill();
      }
      for (let i = 0; i < 6; i++) {
        const prog = ((t * 0.26 + i / 6) % 1);
        ctx.beginPath(); ctx.ellipse(px, py, prx * (0.04 + prog * 0.96), pry * (0.05 + prog * 0.95), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180,240,255,${(1 - prog) * 0.58})`; ctx.lineWidth = 1.8 * (1 - prog * 0.65); ctx.stroke();
      }
      for (let i = 0; i < POOL_SPARKLE_COUNT; i++) {
        const ang = (i / POOL_SPARKLE_COUNT) * Math.PI * 2 + t * 0.17, d = prx * (0.05 + 0.26 * Math.abs(Math.sin(t * 0.52 + i)));
        ctx.beginPath(); ctx.arc(px + Math.cos(ang) * d, py + Math.sin(ang) * pry * 0.58, 2 + 4 * Math.abs(Math.sin(t * 0.42 + i * 1.2)), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,248,255,${0.22 + 0.48 * Math.abs(Math.sin(t * 0.32 + i))})`; ctx.fill();
      }
      // River
      ctx.save(); ctx.globalAlpha = 0.30;
      const riverG = ctx.createLinearGradient(px + prx * 0.5, py, W * 0.65, H);
      riverG.addColorStop(0, "rgba(35,120,190,0.50)"); riverG.addColorStop(0.5, "rgba(28,100,170,0.30)"); riverG.addColorStop(1, "rgba(20,80,150,0.08)");
      ctx.beginPath(); ctx.moveTo(px + prx * 0.6, py + pry * 0.3); ctx.quadraticCurveTo(W * 0.42, H * 0.92, W * 0.55, H * 0.97); ctx.quadraticCurveTo(W * 0.58, H, W * 0.62, H);
      ctx.lineTo(W * 0.48, H); ctx.quadraticCurveTo(W * 0.38, H * 0.96, px + prx * 0.3, py + pry * 0.6); ctx.closePath(); ctx.fillStyle = riverG; ctx.fill();
      if (!isMobile) {
        for (let i = 0; i < 8; i++) {
          const rp = i / 8, rx_ = px + prx * 0.4 + (W * 0.55 - px - prx * 0.4) * rp, ry_ = py + pry + (H - py - pry) * rp * rp, shimmer = 0.12 + 0.10 * Math.sin(t * 0.8 + i * 1.1);
          ctx.beginPath(); ctx.ellipse(rx_, ry_, 10 + 5 * rp, 2.5 + 1.5 * rp, 0.3, 0, Math.PI * 2); ctx.fillStyle = `rgba(180,235,255,${shimmer})`; ctx.fill();
        }
      }
      ctx.restore();
    };

    const drawDrops = (dt: number) => {
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life += dt;
        if (d.life >= d.ml) { drops.splice(i, 1); continue; } d.vy += 1600 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        const f = d.life / d.ml, a = Math.sin(Math.PI * f) * 0.80;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (1 - f * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = d.b ? `rgba(255,255,255,${a})` : `rgba(150,220,250,${a})`; ctx.fill();
      }
    };

    const drawMist = (t: number) => {
      MIST.forEach(m => {
        const y = ((m.by - t * m.sp) % 0.52) + 0.44, x = m.bx + Math.sin(t * 0.22 + m.ph) * 0.018, a = m.a * (0.65 + 0.35 * Math.sin(t * 0.36 + m.ph));
        const mg = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, m.r); mg.addColorStop(0, `rgba(200,235,248,${a})`); mg.addColorStop(1, "rgba(200,235,248,0)");
        ctx.beginPath(); ctx.arc(x * W, y * H, m.r, 0, Math.PI * 2); ctx.fillStyle = mg; ctx.fill();
      });
    };

    const drawFireflies = (t: number) => {
      FIREFLIES.forEach((f) => {
        const x = f.bx + Math.sin(t * f.sp + f.ph) * f.drift, y = f.by + Math.cos(t * f.sp * 0.7 + f.ph) * f.drift * 0.6, pulse = 0.3 + 0.7 * Math.abs(Math.sin(t * f.sp * 1.5 + f.ph));
        const fg = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, f.r * 3.5); fg.addColorStop(0, `rgba(255,240,180,${0.18 * pulse})`); fg.addColorStop(0.4, `rgba(255,230,150,${0.06 * pulse})`); fg.addColorStop(1, "rgba(255,230,150,0)");
        ctx.beginPath(); ctx.arc(x * W, y * H, f.r * 3.5, 0, Math.PI * 2); ctx.fillStyle = fg; ctx.fill();
        ctx.beginPath(); ctx.arc(x * W, y * H, f.r * pulse, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,245,200,${0.55 * pulse})`; ctx.fill();
      });
    };

    const drawGrass = (t: number) => {
      [[0.05, 0.91], [0.09, 0.89], [0.15, 0.92], [0.22, 0.90], [0.58, 0.87], [0.65, 0.89], [0.80, 0.85], [0.88, 0.87]].forEach(([bx, by], i) => {
        const sw = Math.sin(t * 0.52 + i * 0.95) * 0.007;
        ctx.beginPath(); ctx.moveTo(bx * W, by * H + H * 0.06); ctx.quadraticCurveTo((bx + sw) * W, (by - 0.04) * H, (bx + 0.005 + sw) * W, (by - 0.078) * H);
        ctx.quadraticCurveTo((bx + 0.012 + sw) * W, (by - 0.04) * H, (bx + 0.014) * W, by * H + H * 0.06); ctx.fillStyle = "rgba(55,88,40,0.50)"; ctx.fill();
      });
    };

    // ── Main loop ──────────────────────────────────────
    let prev = 0, spawnAcc = 0, lastFrameTime = 0, accumulatedTime = 0;
    let pts0: ReturnType<typeof sampleArc>, pts1: ReturnType<typeof sampleArc>, pts2: ReturnType<typeof sampleArc>;
    
    // SMART THROTTLE: Detect scrolling to free up GPU for UI
    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;
    const viewport = document.querySelector('.landing-scroll-viewport');
    
    const onScroll = () => {
      isScrolling = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { isScrolling = false; }, 100);
    };
    if (viewport) viewport.addEventListener('scroll', onScroll, { passive: true });

    let frameCount = 0;
    const draw = (ts: number) => {
      // During active scroll/swipe, we only render 1 out of every 5 frames (~12fps)
      // This gives the phone 80% more 'breathing room' to handle the scroll movement perfectly.
      frameCount++;
      if (isScrolling && frameCount % 5 !== 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      
      lastFrameTime = ts;

      if (!prev) prev = ts;
      const rawDt = (ts - prev) * 0.001;
      const dt = Math.min(rawDt, 0.05);
      prev = ts;
      accumulatedTime += dt;
      const t = accumulatedTime;

      if (dirty) {
        pts0 = sampleArc(SEGS[0]); pts1 = sampleArc(SEGS[1]); pts2 = sampleArc(SEGS[2]);
        // Re-render static layers to cache
        bgCtx.clearRect(0, 0, W, H);
        renderStaticLayers(bgCtx);
        dirty = false;
      }

      ctx.clearRect(0, 0, W, H);
      // Stamp cached static background (sky+mountains+cliff)
      ctx.drawImage(bgCache, 0, 0, W, H);

      drawForest(t);
      drawWaterfallGlow(t);
      drawSegment(pts0, t, 0); drawSegment(pts1, t, 1); drawSegment(pts2, t, 2);
      drawLedgeBreaks(t);

      spawnAcc += dt;
      if (spawnAcc > 0.07) {
        spawnAcc = 0;
        const spawnCount = isMobile ? 2 : 4;
        const j0 = pts0[pts0.length - 1], j1 = pts1[pts1.length - 1];
        spawnDrops(j0.x, j0.y, spawnCount + Math.floor(Math.random() * spawnCount));
        spawnDrops(j1.x, j1.y, spawnCount + Math.floor(Math.random() * spawnCount));
        spawnDrops(SEGS[2].p3[0] * W, SEGS[2].p3[1] * H, spawnCount + Math.floor(Math.random() * spawnCount));
      }
      drawDrops(dt); drawPool(t); drawMist(t); drawGrass(t);
      drawFireflies(t);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => { 
      cancelAnimationFrame(rafRef.current); 
      window.removeEventListener("resize", resize);
      if (viewport) viewport.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed", top: 0, left: 0, bottom: 0, right: 0,
        width: "100dvw", height: "100dvh",
        pointerEvents: "none", zIndex: -1,
        display: "block", opacity: 0.88,
      }}
    />
  );
}
