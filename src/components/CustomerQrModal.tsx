import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Copy, Check, ExternalLink, Printer, X } from "lucide-react";

interface CustomerQrModalProps {
  open: boolean;
  onClose: () => void;
}

export function CustomerQrModal({ open, onClose }: CustomerQrModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const customerUrl = `${window.location.origin}/store-status`;
  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  const copyUrl = async () => {
    await navigator.clipboard.writeText(customerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-white text-base">Customer Store QR</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable / Scannable QR Card */}
        <div className="bg-white rounded-2xl p-5 flex flex-col items-center text-center shadow-inner">
          <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-xs mb-2">
            MR. DIY
          </span>
          <p className="text-slate-900 font-bold text-sm mb-3">
            Scan for Live Crowd & Aisle Finder
          </p>
          <QRCodeSVG value={customerUrl} size={190} level="M" includeMargin />
          <p className="text-[11px] text-slate-500 mt-3">
            No app required • Works on mobile data
          </p>
        </div>

        {isLocalhost && (
          <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            You are currently viewing on <strong>localhost</strong>. Open your{" "}
            <strong>trycloudflare.com</strong> link in this browser before scanning from mobile
            data.
          </p>
        )}

        {/* URL + Actions */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300">
            <span className="truncate flex-1">{customerUrl}</span>
            <button
              onClick={copyUrl}
              className="text-blue-400 hover:text-blue-300 shrink-0"
              title="Copy link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="/store-status"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open View
            </a>
            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Sign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}