import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  MapPin,
  Clock,
  Smile,
  Meh,
  Frown,
  QrCode,
  X,
  Navigation,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { CustomerQrModal } from "../components/CustomerQrModal";

interface AisleInfo {
  id: string;
  name: string;
  shelves: string[];
  peopleNow: number;
  status: "Available" | "Busy";
}

interface HourlyTrend {
  hour?: string;
  time?: string;
  entries?: number;
  visitors?: number;
  count?: number;
}

interface StoreStatusData {
  storeName: string;
  crowdLevel: "Quiet" | "Moderate" | "Busy";
  currentOccupancy: number;
  aisles: AisleInfo[];
  hourlyTrends: HourlyTrend[];
}

interface ShelfItem {
  id: string;
  label: string;
  sideLabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sampleItems: string;
  keywords: string[];
}

// Matches the store floor plan in StoreHeatmap.tsx
const STORE_SHELVES: ShelfItem[] = [
  {
    id: "Hardware",
    label: "Hardware",
    sideLabel: "Left Side (Front)",
    x: 0.06,
    y: 0.1,
    w: 0.28,
    h: 0.11,
    sampleItems: "Nails, screws, bolts, padlocks, hinges",
    keywords: ["nails", "screws", "bolts", "hinges", "locks", "padlock", "anchor", "bracket", "door"],
  },
  {
    id: "Tools",
    label: "Tools",
    sideLabel: "Left Side (Middle)",
    x: 0.06,
    y: 0.27,
    w: 0.28,
    h: 0.11,
    sampleItems: "Hammers, drills, wrenches, pliers, screwdrivers",
    keywords: ["hammer", "drill", "wrench", "pliers", "screwdriver", "saw", "tape measure", "level"],
  },
  {
    id: "Paint",
    label: "Paint",
    sideLabel: "Left Side (Back)",
    x: 0.06,
    y: 0.44,
    w: 0.28,
    h: 0.11,
    sampleItems: "Paint brushes, rollers, spray paint, sandpaper",
    keywords: ["brush", "roller", "spray paint", "primer", "thinner", "tape", "sandpaper", "varnish"],
  },
  {
    id: "Household",
    label: "Household",
    sideLabel: "Right Side (Front)",
    x: 0.66,
    y: 0.1,
    w: 0.28,
    h: 0.11,
    sampleItems: "Mops, brooms, cleaning supplies, hangers, trash bags",
    keywords: ["mop", "broom", "detergent", "hanger", "trash bag", "sponge", "cleaning", "kitchen"],
  },
  {
    id: "Electrical",
    label: "Electrical",
    sideLabel: "Right Side (Middle)",
    x: 0.66,
    y: 0.27,
    w: 0.28,
    h: 0.11,
    sampleItems: "LED bulbs, extension cords, batteries, plugs, chargers",
    keywords: ["bulb", "led", "light bulb", "extension cord", "wire", "plug", "switch", "socket", "battery", "charger"],
  },
  {
    id: "Storage",
    label: "Storage",
    sideLabel: "Right Side (Back)",
    x: 0.66,
    y: 0.44,
    w: 0.28,
    h: 0.11,
    sampleItems: "Plastic boxes, bins, organizers, racks, baskets",
    keywords: ["box", "storage box", "bin", "container", "organizer", "rack", "crate", "basket", "drawer"],
  },
  {
    id: "Promo island",
    label: "Promo Deals",
    sideLabel: "Center Area",
    x: 0.28,
    y: 0.64,
    w: 0.44,
    h: 0.11,
    sampleItems: "Sale items, seasonal bundles, featured discounts",
    keywords: ["sale", "promo", "discount", "bundle", "seasonal", "featured", "deals"],
  },
];

const QUICK_SEARCH_EXAMPLES = ["Hammer", "Light bulb", "Paint", "Mop", "Storage box"];

function formatHourAmPm(rawLabel: string): { hourNum: number; label: string } {
  const match = rawLabel.match(/^(\d{1,2})/);
  if (!match) return { hourNum: 12, label: rawLabel };
  const h = parseInt(match[1], 10);
  if (h === 0) return { hourNum: h, label: "12 AM" };
  if (h < 12) return { hourNum: h, label: `${h} AM` };
  if (h === 12) return { hourNum: h, label: "12 PM" };
  return { hourNum: h, label: `${h - 12} PM` };
}

export function StoreStatusPage() {
  const [data, setData] = useState<StoreStatusData | null>(null);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const res = await fetch("/api/public/store-status");
        if (!res.ok) throw new Error("Failed to load store status");
        const json: StoreStatusData = await res.json();
        if (active) {
          setData(json);
          setOffline(false);
        }
      } catch {
        if (active) setOffline(true);
      }
    };

    loadStatus();
    const timer = setInterval(loadStatus, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const matchedShelves = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return STORE_SHELVES.filter(
      (shelf) =>
        shelf.label.toLowerCase().includes(q) ||
        shelf.keywords.some((kw) => kw.includes(q) || q.includes(kw))
    );
  }, [search]);

  const activeShelfIds = useMemo(() => {
    if (search.trim()) return new Set(matchedShelves.map((s) => s.id));
    if (selectedShelf) return new Set([selectedShelf]);
    return new Set<string>();
  }, [search, matchedShelves, selectedShelf]);

  const highlightedShelfObj = useMemo(() => {
    const firstId = Array.from(activeShelfIds)[0];
    return STORE_SHELVES.find((s) => s.id === firstId) || null;
  }, [activeShelfIds]);

  const crowdInfo = {
    Quiet: {
      headline: "Not Crowded",
      description: "Plenty of space to walk around and little to no wait at the cashier.",
      cardBg: "bg-emerald-50 border-emerald-200",
      badgeBg: "bg-emerald-600 text-white",
      icon: <Smile className="w-7 h-7 text-emerald-600" />,
    },
    Moderate: {
      headline: "A Little Busy",
      description: "Normal number of shoppers inside. Aisles are easy to move through.",
      cardBg: "bg-amber-50 border-amber-200",
      badgeBg: "bg-amber-500 text-slate-950",
      icon: <Meh className="w-7 h-7 text-amber-600" />,
    },
    Busy: {
      headline: "Very Busy",
      description: "Lots of shoppers right now. Expect a short line at the checkout counter.",
      cardBg: "bg-rose-50 border-rose-200",
      badgeBg: "bg-rose-600 text-white",
      icon: <Frown className="w-7 h-7 text-rose-600" />,
    },
  };

  const level = data?.crowdLevel ?? "Quiet";
  const currentCrowd = crowdInfo[level];

  // Show normal store hours (8 AM - 9 PM) so customers aren't confused by midnight bars
  const storeHourTrends = useMemo(() => {
    const parsed = (data?.hourlyTrends || []).map((t) => {
      const raw = t.hour || t.time || "";
      const { hourNum, label } = formatHourAmPm(raw);
      const value = Number(t.entries ?? t.visitors ?? t.count ?? 0);
      return { hourNum, label, value };
    });

    return parsed.filter((item) => (item.hourNum >= 8 && item.hourNum <= 21) || item.value > 0);
  }, [data?.hourlyTrends]);

  const maxTrend = Math.max(1, ...storeHourTrends.map((t) => t.value));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-14">
      {/* Top Store Banner */}
      <header className="sticky top-0 z-20 bg-amber-400 border-b border-amber-500/40 px-4 py-3.5 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md bg-slate-950 text-amber-400 font-black text-xs tracking-wide">
              {data?.storeName || "MR. DIY"}
            </span>
            <div>
              <h1 className="font-extrabold text-base text-slate-950 leading-tight">
                Shopper Store Guide
              </h1>
              <p className="text-[11px] font-medium text-slate-800 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    offline ? "bg-rose-600" : "bg-emerald-600 animate-pulse"
                  }`}
                />
                {offline ? "Updating store info..." : "Updated live"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-slate-900 text-xs font-bold shadow-sm transition-colors"
            title="Show QR code"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR Code
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* 1. Simple Store Crowd Summary */}
        <section className={`rounded-2xl border p-5 shadow-sm ${currentCrowd.cardBg}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            How busy is the store right now?
          </p>

          <div className="flex items-center justify-between gap-3 mt-2">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950">
                {currentCrowd.headline}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold ${currentCrowd.badgeBg}`}
              >
                <Users className="w-3.5 h-3.5" />
                {data
                  ? `${data.currentOccupancy} ${
                      data.currentOccupancy === 1 ? "person" : "people"
                    } inside right now`
                  : "Checking store..."}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white shadow-sm">{currentCrowd.icon}</div>
          </div>

          <p className="text-sm text-slate-700 mt-3 leading-relaxed">
            {currentCrowd.description}
          </p>
        </section>

        {/* 2. Easy Item & Shelf Finder */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="font-extrabold text-base text-slate-900">
                Find Where an Item Is
              </h2>
            </div>
            {(search || selectedShelf) && (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedShelf(null);
                }}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedShelf(null);
              }}
              placeholder="Type what you need (e.g. hammer, bulb, mop)..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* One-tap example items */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Try:</span>
            {QUICK_SEARCH_EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setSearch(example);
                  setSelectedShelf(null);
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 shrink-0 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>

          {/* Clear Direction Banner */}
          {search.trim() && (
            <div className="text-sm px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-slate-800">
              {matchedShelves.length > 0 ? (
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Go to{" "}
                    <strong className="text-blue-700">
                      {matchedShelves.map((s) => s.label).join(" or ")}
                    </strong>{" "}
                    — highlighted in blue on the map below.
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 text-xs">
                  We couldn't find “{search}” automatically. Tap any section on the
                  map below to see what's there.
                </span>
              )}
            </div>
          )}

          {/* Simple Visual Store Map */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500">
              Tap any section on the store map:
            </p>
            <div className="relative w-full aspect-[4/3] rounded-xl bg-slate-50 border-2 border-slate-200 overflow-hidden">
              {/* Left & Right side labels */}
              <div className="absolute inset-y-2 left-2 w-[36%] rounded-lg bg-slate-100/80 border border-dashed border-slate-300 pointer-events-none flex items-end justify-center pb-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Left Side</span>
              </div>
              <div className="absolute inset-y-2 right-2 w-[36%] rounded-lg bg-slate-100/80 border border-dashed border-slate-300 pointer-events-none flex items-end justify-center pb-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Right Side</span>
              </div>

              {STORE_SHELVES.map((shelf) => {
                const isHighlighted = activeShelfIds.has(shelf.id);
                return (
                  <button
                    key={shelf.id}
                    onClick={() => {
                      setSearch("");
                      setSelectedShelf((prev) => (prev === shelf.id ? null : shelf.id));
                    }}
                    style={{
                      left: `${shelf.x * 100}%`,
                      top: `${shelf.y * 100}%`,
                      width: `${shelf.w * 100}%`,
                      height: `${shelf.h * 100}%`,
                    }}
                    className={`absolute rounded-lg border text-xs font-bold flex items-center justify-center transition-all shadow-sm ${
                      isHighlighted
                        ? "bg-blue-600 border-blue-700 text-white scale-105 z-10 ring-4 ring-blue-200"
                        : "bg-white border-slate-300 text-slate-800 hover:border-blue-400"
                    }`}
                  >
                    {shelf.label}
                  </button>
                );
              })}

              {/* Entrance Marker */}
              <div className="absolute bottom-0 left-[34%] w-[32%] text-center">
                <span className="inline-block px-2 py-0.5 rounded-t bg-slate-900 text-amber-400 text-[10px] font-extrabold tracking-wide">
                  ENTRANCE
                </span>
              </div>
            </div>
          </div>

          {/* Selected Shelf Details */}
          {highlightedShelfObj && (
            <div className="rounded-xl bg-slate-900 text-white p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-amber-400">
                  {highlightedShelfObj.label} Section
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10">
                  {highlightedShelfObj.sideLabel}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                <strong>Common items here:</strong> {highlightedShelfObj.sampleItems}
              </p>
            </div>
          )}
        </section>

        {/* 3. Space in Each Aisle */}
        <section className="space-y-2.5">
          <h2 className="font-extrabold text-base text-slate-900 px-1">
            Space in Each Area
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data?.aisles || []).map((aisle) => {
              const isCrowded = aisle.status === "Busy" || aisle.peopleNow >= 4;
              return (
                <div
                  key={aisle.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{aisle.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {aisle.shelves.join(", ")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                        isCrowded
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {isCrowded ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {isCrowded ? "Crowded" : "Open"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
                    {aisle.peopleNow === 0
                      ? "Nobody in this aisle right now"
                      : `${aisle.peopleNow} ${
                          aisle.peopleNow === 1 ? "shopper" : "shoppers"
                        } browsing here`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Best Time to Visit Today */}
        {storeHourTrends.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="font-extrabold text-base text-slate-900">
                  Busiest Hours Today
                </h2>
                <p className="text-xs text-slate-500">
                  Shorter bars mean fewer shoppers and faster checkout
                </p>
              </div>
            </div>

            <div className="flex items-end gap-1.5 h-28 pt-3">
              {storeHourTrends.map((item, idx) => {
                const heightPct = Math.max(10, Math.round((item.value / maxTrend) * 100));
                const isPeak = item.value > 0 && item.value >= maxTrend * 0.75;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all ${
                        isPeak ? "bg-amber-500" : "bg-blue-500"
                      }`}
                      title={`${item.label}: ${item.value} shoppers`}
                    />
                    <span className="text-[9px] font-semibold text-slate-500 truncate max-w-full">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <CustomerQrModal open={showQrModal} onClose={() => setShowQrModal(false)} />
    </div>
  );
}