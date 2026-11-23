import React, { useEffect, useMemo, useRef, useState } from "react";

const STREAMER_API_BASE = "/streamer/api";
const CANVAS_W = 960;
const CANVAS_H = 640;
const AUTO_REFRESH_MS = 30000;

type RangeMode = "today" | "yesterday" | "week" | "last7" | "month" | "lastMonth" | "custom" | "days";

interface HistoryCell {
  gx: number;
  gy: number;
  samples: number;
}

interface HistoryResponse {
  grid: { w: number; h: number };
  sample_interval: number;
  cells: HistoryCell[];
  max_samples: number;
  total_samples: number;
  total_person_seconds: number;
  by_hour: { hour: number; samples: number }[];
  by_camera: { camera_id: string; samples: number }[];
  by_day: { day: string; samples: number }[];
  peak_hour: number | null;
  busiest_day: string | null;
  peak_camera: string | null;
  days_with_data: number;
}

interface AvailableResponse {
  first_day: string | null;
  last_day: string | null;
  days: string[];
}

interface HistoricalHeatmapProps {
  cameras?: { id: string; name?: string }[];
}

const PRESETS: { id: RangeMode; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This Week" },
  { id: "last7", label: "Last 7 Days" },
  { id: "month", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
  { id: "days", label: "Specific Days" },
];

// Unified store floor-plan shelves (matches StoreHeatmap.tsx)
const SHELVES = [
  { x: 0.06, y: 0.1, w: 0.26, h: 0.07, label: "Hardware" },
  { x: 0.06, y: 0.24, w: 0.26, h: 0.07, label: "Tools" },
  { x: 0.06, y: 0.38, w: 0.26, h: 0.07, label: "Paint" },
  { x: 0.68, y: 0.1, w: 0.26, h: 0.07, label: "Household" },
  { x: 0.68, y: 0.24, w: 0.26, h: 0.07, label: "Electrical" },
  { x: 0.68, y: 0.38, w: 0.26, h: 0.07, label: "Storage" },
  { x: 0.3, y: 0.58, w: 0.4, h: 0.07, label: "Promo island" },
];

const pad = (n: number) => String(n).padStart(2, "0");
// Local-time YYYY-MM-DD (toISOString would shift the day for users ahead of UTC)
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYMD = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const prettyDay = (s: string) =>
  fromYMD(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const hourLabel = (h: number) => `${pad(h)}:00`;

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = seconds / 60;
  if (minutes < 120) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} hrs`;
};

const presetRange = (mode: RangeMode, today: Date): { start: Date; end: Date } => {
  switch (mode) {
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case "week": {
      const sinceMonday = (today.getDay() + 6) % 7; // Monday = 0
      return { start: addDays(today, -sinceMonday), end: today };
    }
    case "last7":
      return { start: addDays(today, -6), end: today };
    case "month":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    case "lastMonth":
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth(), 0),
      };
    case "today":
    default:
      return { start: today, end: today };
  }
};

// ---------- drawing ----------

let paletteCache: Uint8ClampedArray | null = null;
const getPalette = () => {
  if (paletteCache) return paletteCache;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0.0, "#2B83BA");
  g.addColorStop(0.25, "#41B6C4");
  g.addColorStop(0.5, "#A6D96A");
  g.addColorStop(0.75, "#FDAE61");
  g.addColorStop(1.0, "#D7191C");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 1);
  paletteCache = x.getImageData(0, 0, 256, 1).data;
  return paletteCache;
};

const drawPlanBase = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
};

const drawPlanShelves = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  SHELVES.forEach((s) => {
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(s.x * w, s.y * h, s.w * w, s.h * h);
    ctx.strokeRect(s.x * w, s.y * h, s.w * w, s.h * h);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(s.label, (s.x + s.w / 2) * w, (s.y + s.h / 2) * h + 4);
  });

  // Entrance marker
  ctx.fillStyle = "#3b82f6";
  ctx.fillRect(w * 0.42, h - 6, w * 0.16, 6);
  ctx.fillStyle = "#93c5fd";
  ctx.fillText("ENTRANCE / EXIT", w / 2, h - 12);
};

const drawHeat = (ctx: CanvasRenderingContext2D, data: HistoryResponse, w: number, h: number) => {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return;

  const cellW = w / data.grid.w;
  const cellH = h / data.grid.h;
  const radius = Math.max(cellW, cellH) * 2.4;
  const max = Math.max(1, data.max_samples);

  // 1) soft black blobs; overlapping blobs build up alpha where people spent more time
  data.cells.forEach((c) => {
    const norm = Math.pow(c.samples / max, 0.55); // compress, so quiet areas stay visible
    const cx = (c.gx + 0.5) * cellW;
    const cy = (c.gy + 0.5) * cellH;
    const g = octx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const a = Math.min(1, 0.08 + norm * 0.92);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    octx.fillStyle = g;
    octx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  });

  // 2) turn that alpha into the blue -> red colour scale
  const img = octx.getImageData(0, 0, w, h);
  const px = img.data;
  const palette = getPalette();
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0) continue;
    const p = a * 4;
    px[i] = palette[p];
    px[i + 1] = palette[p + 1];
    px[i + 2] = palette[p + 2];
    px[i + 3] = Math.min(235, a * 1.6);
  }
  octx.putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0);
};

// ---------- component ----------

export function HistoricalHeatmap({ cameras = [] }: HistoricalHeatmapProps) {
  const [mode, setMode] = useState<RangeMode>("today");
  const [customFrom, setCustomFrom] = useState<string>(toYMD(new Date()));
  const [customTo, setCustomTo] = useState<string>(toYMD(new Date()));
  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [dayInput, setDayInput] = useState<string>("");
  const [hourFrom, setHourFrom] = useState<number>(0);
  const [hourTo, setHourTo] = useState<number>(23);
  const [cameraId, setCameraId] = useState<string>("all");

  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [available, setAvailable] = useState<AvailableResponse | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [hover, setHover] = useState<{ seconds: number; x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const nameOf = (id: string) => cameras.find((c) => c.id === id)?.name || id;

  // Build the request from the controls
  const { queryString, rangeLabel, includesToday, ready } = useMemo(() => {
    const today = new Date();
    const todayStr = toYMD(today);
    const params = new URLSearchParams();
    let label = "";
    let isReady = true;
    let hasToday = false;

    if (mode === "days") {
      const sorted = [...pickedDays].sort();
      if (sorted.length > 0) params.set("days", sorted.join(","));
      isReady = sorted.length > 0;
      label =
        sorted.length === 0
          ? "No days selected yet"
          : sorted.length === 1
          ? prettyDay(sorted[0])
          : `${sorted.length} specific days`;
      hasToday = sorted.includes(todayStr);
    } else {
      let start: string;
      let end: string;
      if (mode === "custom") {
        start = customFrom;
        end = customTo;
        if (!start || !end) isReady = false;
        else if (start > end) [start, end] = [end, start];
      } else {
        const r = presetRange(mode, today);
        start = toYMD(r.start);
        end = toYMD(r.end);
      }
      if (isReady) {
        params.set("start", start);
        params.set("end", end);
        label = start === end ? prettyDay(start) : `${prettyDay(start)} – ${prettyDay(end)}`;
        hasToday = start <= todayStr && end >= todayStr;
      } else {
        label = "Choose a start and end date";
      }
    }

    const hf = Math.min(hourFrom, hourTo);
    const ht = Math.max(hourFrom, hourTo);
    params.set("hour_from", String(hf));
    params.set("hour_to", String(ht));
    if (cameraId !== "all") params.set("camera_id", cameraId);

    return { queryString: params.toString(), rangeLabel: label, includesToday: hasToday, ready: isReady };
  }, [mode, customFrom, customTo, pickedDays, hourFrom, hourTo, cameraId]);

  // Which days have saved data (once)
  useEffect(() => {
    let alive = true;
    fetch(`${STREAMER_API_BASE}/heatmap_history/available`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setAvailable(j);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  // Load the heatmap whenever the controls change
  useEffect(() => {
    if (!ready) {
      setData(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(`${STREAMER_API_BASE}/heatmap_history?${queryString}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Streamer returned HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: HistoryResponse) => {
        setData(json);
        setError("");
      })
      .catch((err: any) => {
        if (err?.name === "AbortError") return;
        setError(
          err?.message?.startsWith("Streamer") || err?.message?.includes("Invalid")
            ? err.message
            : "Cannot reach the camera streamer. Make sure traffic_counter.py is running on port 8001."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryString, ready, refreshTick]);

  // Keep a range that includes today fresh
  useEffect(() => {
    if (!includesToday) return;
    const t = setInterval(() => setRefreshTick((n) => n + 1), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [includesToday]);

  // Draw unified floor plan + historical heat
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawPlanBase(ctx, CANVAS_W, CANVAS_H);
    if (data && data.cells.length > 0) drawHeat(ctx, data, CANVAS_W, CANVAS_H);
    drawPlanShelves(ctx, CANVAS_W, CANVAS_H);
  }, [data]);

  // Hover read-out: time spent around the pointer (3x3 cells)
  const cellMap = useMemo(() => {
    const m = new Map<number, number>();
    if (data) data.cells.forEach((c) => m.set(c.gy * data.grid.w + c.gx, c.samples));
    return m;
  }, [data]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data || data.cells.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const gx = Math.min(data.grid.w - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * data.grid.w)));
    const gy = Math.min(data.grid.h - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * data.grid.h)));
    let samples = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x < 0 || y < 0 || x >= data.grid.w || y >= data.grid.h) continue;
        samples += cellMap.get(y * data.grid.w + x) ?? 0;
      }
    }
    const clampedX = Math.min(e.clientX - rect.left + 12, Math.max(8, rect.width - 195));
    const clampedY = Math.min(e.clientY - rect.top + 12, Math.max(8, rect.height - 40));
    setHover({ seconds: samples * data.sample_interval, x: clampedX, y: clampedY });
  };

  const addPickedDay = () => {
    if (!dayInput || pickedDays.includes(dayInput)) {
      setDayInput("");
      return;
    }
    setPickedDays((prev) => [...prev, dayInput].sort());
    setDayInput("");
  };

  const maxHour = data ? Math.max(1, ...data.by_hour.map((h) => h.samples)) : 1;
  const totalByCamera = data ? data.by_camera.reduce((s, c) => s + c.samples, 0) : 0;
  const todayStr = toYMD(new Date());
  const isEmpty = !!data && data.total_samples === 0 && !loading && !error;

  const chipBase = "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors";
  const selectClass =
    "bg-slate-900 border border-slate-700 text-white rounded-md h-8 px-2 text-xs focus:outline-none focus:border-blue-500";

  return (
    <div className="space-y-4">
      {/* CONTROLS */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setMode(p.id)}
              className={`${chipBase} ${
                mode === p.id
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-slate-900 text-slate-300 border-slate-700 hover:border-blue-500/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <label className="flex items-center gap-2">
              From
              <input
                type="date"
                value={customFrom}
                max={todayStr}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={selectClass}
              />
            </label>
            <label className="flex items-center gap-2">
              To
              <input
                type="date"
                value={customTo}
                max={todayStr}
                onChange={(e) => setCustomTo(e.target.value)}
                className={selectClass}
              />
            </label>
          </div>
        )}

        {mode === "days" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <input
                type="date"
                value={dayInput}
                max={todayStr}
                onChange={(e) => setDayInput(e.target.value)}
                className={selectClass}
              />
              <button
                type="button"
                onClick={addPickedDay}
                disabled={!dayInput}
                className="px-3 h-8 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold"
              >
                Add day
              </button>
              {pickedDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPickedDays([])}
                  className="px-2 h-8 text-xs text-slate-400 hover:text-white"
                >
                  Clear all
                </button>
              )}
            </div>
            {pickedDays.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pickedDays.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] text-slate-200 font-mono"
                  >
                    {prettyDay(d)}
                    <button
                      type="button"
                      onClick={() => setPickedDays((prev) => prev.filter((x) => x !== d))}
                      title="Remove day"
                      className="w-4 h-4 leading-none rounded-full text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
          <label className="flex items-center gap-2">
            Hours
            <select value={hourFrom} onChange={(e) => setHourFrom(Number(e.target.value))} className={selectClass}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad(h)}:00
                </option>
              ))}
            </select>
            to
            <select value={hourTo} onChange={(e) => setHourTo(Number(e.target.value))} className={selectClass}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad(h)}:59
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            Zone
            <select value={cameraId} onChange={(e) => setCameraId(e.target.value)} className={selectClass}>
              <option value="all">All zones</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.id}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setHourFrom(0);
              setHourTo(23);
              setCameraId("all");
            }}
            className="text-slate-400 hover:text-white"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* RANGE LABEL */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="font-mono text-slate-300">
          Showing: <span className="text-white font-bold">{rangeLabel}</span>
          {(hourFrom !== 0 || hourTo !== 23) && (
            <span className="text-slate-400">
              {" "}
              · {pad(Math.min(hourFrom, hourTo))}:00–{pad(Math.max(hourFrom, hourTo))}:59
            </span>
          )}
          {cameraId !== "all" && <span className="text-slate-400"> · {nameOf(cameraId)}</span>}
          {loading && <span className="ml-2 text-blue-400 animate-pulse">Loading…</span>}
        </div>
        <div className="text-slate-500 font-mono">
          {available?.first_day
            ? `History saved since ${prettyDay(available.first_day)}`
            : "History starts saving while the camera streamer is running"}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg text-xs">{error}</div>
      )}

      {/* UNIFIED FLOOR-PLAN HEATMAP */}
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          className="w-full block rounded-xl border border-slate-800 bg-slate-950"
        />

        {hover && data && data.cells.length > 0 && (
          <div
            className="absolute pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-700 text-[11px] font-mono text-slate-200 shadow-lg"
            style={{ left: hover.x, top: hover.y }}
          >
            {hover.seconds > 0 ? `${formatDuration(hover.seconds)} spent near here` : "No one recorded here"}
          </div>
        )}

        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <p className="text-center text-xs text-slate-400 bg-slate-950/85 border border-slate-800 rounded-lg px-4 py-3 max-w-sm">
              No heatmap data was saved for this selection. Try another date, or widen the hours and zone filters.
            </p>
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <p className="text-center text-xs text-slate-400 bg-slate-950/85 border border-slate-800 rounded-lg px-4 py-3 max-w-sm">
              {mode === "days" ? "Add at least one day to see its heatmap." : "Choose a start and end date."}
            </p>
          </div>
        )}

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

      {/* SUMMARY */}
      {data && data.total_samples > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Total time spent in store</p>
              <p className="text-lg font-bold text-white mt-1">{formatDuration(data.total_person_seconds)}</p>
              <p className="text-[10px] text-slate-500">added up over every person</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Busiest hour</p>
              <p className="text-lg font-bold text-white mt-1">
                {data.peak_hour !== null ? `${hourLabel(data.peak_hour)}–${hourLabel((data.peak_hour + 1) % 24)}` : "—"}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Busiest day</p>
              <p className="text-lg font-bold text-white mt-1">{data.busiest_day ? prettyDay(data.busiest_day) : "—"}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Days with data</p>
              <p className="text-lg font-bold text-white mt-1">{data.days_with_data}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Busiest hours */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Busiest hours</p>
              <div className="flex items-end gap-1 h-28">
                {data.by_hour.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      title={`${hourLabel(h.hour)} · ${formatDuration(h.samples * data.sample_interval)}`}
                      className={`w-full rounded-t ${
                        h.hour === data.peak_hour ? "bg-red-500" : "bg-blue-500/70"
                      }`}
                      style={{ height: `${Math.max(h.samples > 0 ? 4 : 0, (h.samples / maxHour) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {data.by_hour.map((h) => (
                  <span key={h.hour} className="flex-1 text-center text-[9px] font-mono text-slate-500">
                    {h.hour % 3 === 0 ? pad(h.hour) : ""}
                  </span>
                ))}
              </div>
            </div>

            {/* Zone share */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Time spent by zone</p>
              <div className="space-y-2.5">
                {data.by_camera.map((c) => {
                  const pct = totalByCamera > 0 ? Math.round((c.samples / totalByCamera) * 100) : 0;
                  return (
                    <div key={c.camera_id}>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span className="truncate pr-2">{nameOf(c.camera_id)}</span>
                        <span className="shrink-0">
                          {pct}% · {formatDuration(c.samples * data.sample_interval)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}