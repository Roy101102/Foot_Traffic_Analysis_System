import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

/**
- Floor-plan coordinates are NORMALIZED: x and y are 0..1,
- (0,0) = top-left of the store, (1,1) = bottom-right (entrance is at the bottom).
- The backend produces them from: foot point of the person's bounding box -> homography.
 */
export interface HeatPoint {
  x: number;
  y: number;
  camera_id?: string;
  track_id?: number;
}

interface StoreHeatmapProps {
  /** Endpoint returning { points: HeatPoint[] } with normalized coords */
  endpoint?: string;
  pollMs?: number;
  /** If the backend isn't ready yet, simulate walking people so you can demo the UI */
  demoMode?: boolean;
}

// Heat grid resolution (kept small on purpose; scaled up + smoothed when drawn)
const COLS = 96;
const ROWS = 64;
const RADIUS = 4.5; // splat radius in grid cells (~ person's footprint + spread)
const COUNTS_PER_UNIT = 1; // heat added per detection at the center of the splat

// Live mode keeps a trail that fades slowly (applied once per poll, NOT per frame).
// 0.998 at 500ms polling ≈ 3-minute half-life.
const TRAIL_DECAY = 0.998;
// Heat needed before a spot reads as "hot" (red). Raise it if the map turns red too fast.
// A single pass stays blue because the color scale never goes below this value.
const HOT_LEVEL = 40;
// <1 lifts faint areas so rarely visited spots still show as blue
const GAMMA = 0.6;

// Static shelving layout (normalized). Adjust to match the real store.
const SHELVES = [
  { x: 0.06, y: 0.1, w: 0.26, h: 0.07, label: "Hardware" },
  { x: 0.06, y: 0.24, w: 0.26, h: 0.07, label: "Tools" },
  { x: 0.06, y: 0.38, w: 0.26, h: 0.07, label: "Paint" },
  { x: 0.68, y: 0.1, w: 0.26, h: 0.07, label: "Household" },
  { x: 0.68, y: 0.24, w: 0.26, h: 0.07, label: "Electrical" },
  { x: 0.68, y: 0.38, w: 0.26, h: 0.07, label: "Storage" },
  { x: 0.3, y: 0.58, w: 0.4, h: 0.07, label: "Promo island" },
];

// Color ramp: t in 0..1 -> [r,g,b,a] (a is 0..255 for ImageData)
// Stops: [t, r, g, b, opacity 0..1]
const RAMP_STOPS: [number, number, number, number, number][] = [
  [0.0, 43, 131, 186, 0], // Zero / baseline  #2B83BA  0%
  [0.2, 43, 131, 186, 0.35], // Low             #2B83BA  35%
  [0.4, 65, 182, 196, 0.5], // Low-Mid          #41B6C4  50%
  [0.6, 166, 217, 106, 0.65], // Medium         #A6D96A  65%
  [0.8, 253, 174, 97, 0.75], // High-Mid        #FDAE61  75%
  [1.0, 215, 25, 28, 0.85], // High             #D7191C  85%
];

function ramp(t: number): [number, number, number, number] {
  if (t <= 0.03) return [0, 0, 0, 0];
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    if (t <= RAMP_STOPS[i][0]) {
      const [t0, r0, g0, b0, a0] = RAMP_STOPS[i - 1];
      const [t1, r1, g1, b1, a1] = RAMP_STOPS[i];
      const k = (t - t0) / (t1 - t0);
      return [
        r0 + (r1 - r0) * k,
        g0 + (g1 - g0) * k,
        b0 + (b1 - b0) * k,
        (a0 + (a1 - a0) * k) * 255,
      ];
    }
  }
  return [215, 25, 28, 0.85 * 255];
}

export function StoreHeatmap({
  endpoint = "/streamer/api/heatmap_points",
  pollMs = 500,
  demoMode = false,
}: StoreHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Float32Array>(new Float32Array(COLS * ROWS));
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const walkersRef = useRef<{ x: number; y: number; tx: number; ty: number }[]>([]);

  const [paused, setPaused] = useState(false);
  const [peopleNow, setPeopleNow] = useState(0);
  const [connected, setConnected] = useState<boolean>(demoMode);

  // ---- add points to the grid as Gaussian splats ----
  const addPoints = (points: HeatPoint[]) => {
    const g = gridRef.current;

    // Slow trail fade, once per poll
    for (let i = 0; i < g.length; i++) g[i] *= TRAIL_DECAY;

    for (const p of points) {
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) continue;
      const cx = p.x * (COLS - 1);
      const cy = p.y * (ROWS - 1);
      const r = Math.ceil(RADIUS * 2);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = Math.round(cx) + dx;
          const gy = Math.round(cy) + dy;
          if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
          const d2 = (gx - cx) ** 2 + (gy - cy) ** 2;
          g[gy * COLS + gx] += COUNTS_PER_UNIT * Math.exp(-d2 / (2 * (RADIUS / 2) ** 2));
        }
      }
    }
    setPeopleNow(points.length);
  };

  // ---- data source: backend polling (or demo walkers) ----
  useEffect(() => {
    if (paused) return;
    let alive = true;

    const tick = async () => {
      if (demoMode) {
        const w = walkersRef.current;
        while (w.length < 14) {
          w.push({ x: 0.5, y: 0.97, tx: Math.random(), ty: 0.1 + Math.random() * 0.6 });
        }
        w.forEach((p, i) => {
          p.x += (p.tx - p.x) * 0.06 + (Math.random() - 0.5) * 0.01;
          p.y += (p.ty - p.y) * 0.06 + (Math.random() - 0.5) * 0.01;
          if (Math.hypot(p.tx - p.x, p.ty - p.y) < 0.03) {
            // favor the walkway and the two wings so a visible hotspot forms
            p.tx = Math.random() < 0.5 ? 0.2 + Math.random() * 0.1 : 0.7 + Math.random() * 0.1;
            p.ty = 0.1 + Math.random() * 0.45;
            if (Math.random() < 0.08) walkersRef.current[i] = { x: 0.5, y: 0.97, tx: p.tx, ty: p.ty };
          }
        });
        addPoints(w.map((p) => ({ x: p.x, y: p.y })));
        return;
      }
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive) {
          setConnected(true);
          addPoints(Array.isArray(data.points) ? data.points : []);
        }
      } catch {
        if (alive) setConnected(false);
      }
    };

    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [endpoint, pollMs, demoMode, paused]);

  // ---- render loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!offRef.current) {
      offRef.current = document.createElement("canvas");
      offRef.current.width = COLS;
      offRef.current.height = ROWS;
    }
    const off = offRef.current;
    const octx = off.getContext("2d")!;
    let raf = 0;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const g = gridRef.current;

      // normalize against a minimum "hot" level, so a single visit stays blue
      let max = HOT_LEVEL;
      for (let i = 0; i < g.length; i++) if (g[i] > max) max = g[i];

      const img = octx.createImageData(COLS, ROWS);
      for (let i = 0; i < g.length; i++) {
        const [r, gg, b, a] = ramp(Math.pow(Math.min(1, g[i] / max), GAMMA));
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = gg;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = a;
      }
      octx.putImageData(img, 0, 0);

      // background + floor plan
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      // heat layer (browser smoothing upscales the small grid into soft gradients)
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(off, 0, 0, W, H);

      // shelves drawn ON TOP so the heat reads as "where people stand around them"
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      SHELVES.forEach((s) => {
        ctx.fillStyle = "rgba(15,23,42,0.85)";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.fillRect(s.x * W, s.y * H, s.w * W, s.h * H);
        ctx.strokeRect(s.x * W, s.y * H, s.w * W, s.h * H);
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(s.label, (s.x + s.w / 2) * W, (s.y + s.h / 2) * H + 4);
      });

      // entrance marker
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(W * 0.42, H - 6, W * 0.16, 6);
      ctx.fillStyle = "#93c5fd";
      ctx.fillText("ENTRANCE / EXIT", W / 2, H - 12);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = () => gridRef.current.fill(0);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        width={960}
        height={640}
        className="w-full block rounded-xl border border-slate-800 bg-slate-950"
      />

      {/* Top-left live detection badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
        <span className="text-slate-300">
          {connected ? `${peopleNow} people detected` : "Waiting for tracking data..."}
        </span>
      </div>

      {/* Top-right pause & reset controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <button
          onClick={() => setPaused((p) => !p)}
          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          title={paused ? "Resume heatmap" : "Pause heatmap"}
        >
          {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
        <button
          onClick={reset}
          className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          title="Clear heatmap"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-right color legend */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-mono text-slate-400">
        Rare
        <span
          className="inline-block w-24 h-2 rounded"
          style={{ background: "linear-gradient(to right,#2B83BA,#41B6C4,#A6D96A,#FDAE61,#D7191C)" }}
        />
        Frequent
      </div>
    </div>
  );
}