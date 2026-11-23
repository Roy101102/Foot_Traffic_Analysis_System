"""
Heatmap history for the MR. DIY foot-traffic system.

traffic_counter.py calls heatmap_store.record(camera_id, points) for every processed
frame; this module keeps about 2 samples per second per camera, counts them into a
40x40 grid laid over the floor plan, and saves the counts per (day, hour, camera) in a
small SQLite file (heatmap_history.db, next to this script).

One "sample" = one person standing or walking in a grid cell for SAMPLE_INTERVAL
seconds, so a cell with many samples is a place where people spent a lot of time.

A manager can then ask for ANY day, week, month, custom range or a list of specific
days (optionally only certain hours, or only one zone/camera):

    GET /api/heatmap_history?start=2026-11-01&end=2026-11-23
    GET /api/heatmap_history?days=2026-11-02,2026-11-09,2026-11-16&hour_from=9&hour_to=20
    GET /api/heatmap_history?start=2026-11-23&camera_id=cam_2
    GET /api/heatmap_history/available
"""

import os
import sqlite3
import threading
import time
from contextlib import closing
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query

DB_PATH = os.getenv(
    "HEATMAP_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "heatmap_history.db"),
)

GRID_W = 40                                                     # cells across the floor plan
GRID_H = 40                                                     # cells down the floor plan
SAMPLE_INTERVAL = float(os.getenv("HEATMAP_SAMPLE_SECONDS", "0.5"))   # seconds between samples
FLUSH_INTERVAL = float(os.getenv("HEATMAP_FLUSH_SECONDS", "10"))      # how often to write to disk
# A detection must have been tracked this many frames to be saved. This keeps one-frame
# false detections out of the history.
MIN_TRACK_FRAMES = int(os.getenv("HEATMAP_MIN_TRACK_FRAMES", "5"))
RETENTION_DAYS = int(os.getenv("HEATMAP_RETENTION_DAYS", "0"))        # 0 = keep forever
MAX_RANGE_DAYS = 366

CellKey = Tuple[str, int, str, int, int]  # (day, hour, camera_id, gx, gy)


class HeatmapStore:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self.ready = False
        self._pending: Dict[CellKey, int] = {}
        self._pending_lock = threading.Lock()
        self._last_sample: Dict[str, float] = {}
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._init_db()

    # ---------------- storage ----------------

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path, timeout=10)

    def _init_db(self) -> None:
        try:
            with closing(self._connect()) as conn:
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS heat_bins (
                        day       TEXT    NOT NULL,
                        hour      INTEGER NOT NULL,
                        camera_id TEXT    NOT NULL,
                        gx        INTEGER NOT NULL,
                        gy        INTEGER NOT NULL,
                        samples   INTEGER NOT NULL,
                        PRIMARY KEY (day, hour, camera_id, gx, gy)
                    ) WITHOUT ROWID
                    """
                )
                conn.commit()
            self.ready = True
        except (sqlite3.Error, OSError) as e:
            print(f"[HEATMAP HISTORY] Disabled - cannot open {self.db_path}: {e}")

    def start(self) -> None:
        """Start the background writer (call once when the streamer starts)."""
        if not self.ready or self._thread is not None:
            return
        if RETENTION_DAYS > 0:
            cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).strftime("%Y-%m-%d")
            try:
                with closing(self._connect()) as conn:
                    conn.execute("DELETE FROM heat_bins WHERE day < ?", (cutoff,))
                    conn.commit()
            except sqlite3.Error as e:
                print(f"[HEATMAP HISTORY] Could not prune old data: {e}")
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        print(f"[HEATMAP HISTORY] Saving heatmap history to {self.db_path}")

    def stop(self) -> None:
        self._stop.set()
        self.flush()

    def _loop(self) -> None:
        while not self._stop.wait(FLUSH_INTERVAL):
            self.flush()

    def flush(self) -> None:
        """Write the samples collected so far to disk."""
        with self._pending_lock:
            if not self._pending:
                return
            batch, self._pending = self._pending, {}
        rows = [(d, h, c, gx, gy, n) for (d, h, c, gx, gy), n in batch.items()]
        try:
            with closing(self._connect()) as conn:
                conn.executemany(
                    """
                    INSERT INTO heat_bins (day, hour, camera_id, gx, gy, samples)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(day, hour, camera_id, gx, gy)
                    DO UPDATE SET samples = samples + excluded.samples
                    """,
                    rows,
                )
                conn.commit()
        except sqlite3.Error as e:
            print(f"[HEATMAP HISTORY] Could not save samples (will retry): {e}")
            with self._pending_lock:
                for key, n in batch.items():
                    self._pending[key] = self._pending.get(key, 0) + n

    # ---------------- recording ----------------

    def record(self, camera_id: str, points: List[dict]) -> None:
        """Called by the camera threads with this frame's person positions (x, y in 0..1)."""
        if not self.ready:
            return
        now = time.time()
        if now - self._last_sample.get(camera_id, 0.0) < SAMPLE_INTERVAL:
            return
        self._last_sample[camera_id] = now
        if not points:
            return

        stamp = datetime.fromtimestamp(now)          # store LOCAL time, like the dashboard
        day, hour = stamp.strftime("%Y-%m-%d"), stamp.hour
        with self._pending_lock:
            for p in points:
                if p.get("frames", MIN_TRACK_FRAMES) < MIN_TRACK_FRAMES:
                    continue
                gx = min(GRID_W - 1, max(0, int(p["x"] * GRID_W)))
                gy = min(GRID_H - 1, max(0, int(p["y"] * GRID_H)))
                key = (day, hour, camera_id, gx, gy)
                self._pending[key] = self._pending.get(key, 0) + 1

    # ---------------- querying ----------------

    def query(
        self,
        start: Optional[str] = None,
        end: Optional[str] = None,
        days: Optional[List[str]] = None,
        hour_from: int = 0,
        hour_to: int = 23,
        camera_id: Optional[str] = None,
    ) -> dict:
        if not self.ready:
            raise RuntimeError("Heatmap history database is not available.")
        self.flush()  # so "today" includes the newest samples

        where: List[str] = []
        params: list = []
        if days:
            where.append("day IN (%s)" % ",".join("?" * len(days)))
            params.extend(days)
        else:
            where.append("day BETWEEN ? AND ?")
            params.extend([start, end])
        where.append("hour BETWEEN ? AND ?")
        params.extend([hour_from, hour_to])
        if camera_id:
            where.append("camera_id = ?")
            params.append(camera_id)
        clause = " AND ".join(where)

        with closing(self._connect()) as conn:
            cell_rows = conn.execute(
                f"SELECT gx, gy, SUM(samples) FROM heat_bins WHERE {clause} GROUP BY gx, gy", params
            ).fetchall()
            hour_rows = conn.execute(
                f"SELECT hour, SUM(samples) FROM heat_bins WHERE {clause} GROUP BY hour", params
            ).fetchall()
            cam_rows = conn.execute(
                f"SELECT camera_id, SUM(samples) FROM heat_bins WHERE {clause} GROUP BY camera_id", params
            ).fetchall()
            day_rows = conn.execute(
                f"SELECT day, SUM(samples) FROM heat_bins WHERE {clause} GROUP BY day ORDER BY day", params
            ).fetchall()

        cells = [{"gx": gx, "gy": gy, "samples": int(n)} for gx, gy, n in cell_rows]
        total = sum(c["samples"] for c in cells)

        by_hour = [{"hour": h, "samples": 0} for h in range(24)]
        for h, n in hour_rows:
            by_hour[int(h)]["samples"] = int(n)
        by_camera = sorted(
            ({"camera_id": c, "samples": int(n)} for c, n in cam_rows),
            key=lambda r: r["samples"],
            reverse=True,
        )
        by_day = [{"day": d, "samples": int(n)} for d, n in day_rows]

        peak_hour = None
        if total > 0:
            peak_hour = max(by_hour, key=lambda r: r["samples"])["hour"]
        busiest_day = max(by_day, key=lambda r: r["samples"])["day"] if by_day else None

        return {
            "grid": {"w": GRID_W, "h": GRID_H},
            "sample_interval": SAMPLE_INTERVAL,
            "range": {
                "start": start,
                "end": end,
                "days": days,
                "hour_from": hour_from,
                "hour_to": hour_to,
                "camera_id": camera_id,
            },
            "cells": cells,
            "max_samples": max((c["samples"] for c in cells), default=0),
            "total_samples": total,
            "total_person_seconds": round(total * SAMPLE_INTERVAL, 1),
            "by_hour": by_hour,
            "by_camera": by_camera,
            "by_day": by_day,
            "peak_hour": peak_hour,
            "busiest_day": busiest_day,
            "peak_camera": by_camera[0]["camera_id"] if by_camera else None,
            "days_with_data": len(by_day),
        }

    def available(self) -> dict:
        if not self.ready:
            raise RuntimeError("Heatmap history database is not available.")
        self.flush()
        with closing(self._connect()) as conn:
            rows = conn.execute("SELECT DISTINCT day FROM heat_bins ORDER BY day").fetchall()
        days = [r[0] for r in rows]
        return {
            "first_day": days[0] if days else None,
            "last_day": days[-1] if days else None,
            "days": days,
        }


heatmap_store = HeatmapStore()

# ============================================================
# API ROUTES  (added to the streamer app with app.include_router)
# ============================================================

history_router = APIRouter(prefix="/api/heatmap_history", tags=["heatmap-history"])


def _parse_day(value: str) -> str:
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date '{value}'. Use YYYY-MM-DD.")


@history_router.get("")
def get_heatmap_history(
    start: Optional[str] = None,
    end: Optional[str] = None,
    days: Optional[str] = None,
    hour_from: int = Query(0, ge=0, le=23),
    hour_to: int = Query(23, ge=0, le=23),
    camera_id: Optional[str] = None,
):
    """Heatmap for a date range (start..end) or a list of specific days (days=a,b,c)."""
    if hour_from > hour_to:
        hour_from, hour_to = hour_to, hour_from

    day_list: Optional[List[str]] = None
    if days:
        day_list = sorted({_parse_day(d) for d in days.split(",") if d.strip()})
        if not day_list:
            raise HTTPException(status_code=400, detail="No valid days given.")
        if len(day_list) > MAX_RANGE_DAYS:
            raise HTTPException(status_code=400, detail=f"Pick at most {MAX_RANGE_DAYS} days.")
        first, last = day_list[0], day_list[-1]
    else:
        today = datetime.now().strftime("%Y-%m-%d")
        first = _parse_day(start) if start else today
        last = _parse_day(end) if end else first
        if first > last:
            first, last = last, first
        span = (datetime.strptime(last, "%Y-%m-%d") - datetime.strptime(first, "%Y-%m-%d")).days + 1
        if span > MAX_RANGE_DAYS:
            raise HTTPException(status_code=400, detail=f"Date range is too long (max {MAX_RANGE_DAYS} days).")

    try:
        return heatmap_store.query(
            start=first,
            end=last,
            days=day_list,
            hour_from=hour_from,
            hour_to=hour_to,
            camera_id=camera_id or None,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"History database error: {e}")


@history_router.get("/available")
def get_available_days():
    """Which days have saved heatmap data."""
    try:
        return heatmap_store.available()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"History database error: {e}")