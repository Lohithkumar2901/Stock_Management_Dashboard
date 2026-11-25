import { useMsal } from "@azure/msal-react";

const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function formatMonth(val) {
  // Convert "04.2026" → "APR 2026"
  const parts = String(val).split(".");
  if (parts.length === 2) {
    const idx = parseInt(parts[0], 10) - 1;
    if (idx >= 0 && idx < 12) return `${MONTH_NAMES[idx]} ${parts[1]}`;
  }
  return String(val);
}

function firstNameOf(account) {
  if (!account) return "";
  const full = account.name || account.username || "";
  return full.split(/[ .@]/)[0];
}

export default function Navbar({ months = [], month, onMonthChange }) {
  const { accounts } = useMsal();
  const firstName = firstNameOf(accounts[0]);

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/40 px-6 py-3 flex justify-between items-center shadow-sm">
      <div className="flex items-center gap-3">
        <img
          src="/Wheels.png"
          alt="Wheels India"
          className="h-9 w-auto shrink-0"
        />
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent leading-tight">
            Inventory Dashboard
          </h1>
          <p className="text-[11px] text-gray-500 tracking-wide">
            AI Insights &bull; Values in Lakhs
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {firstName && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-sm">
            <span className="text-base">👋</span>
            <span className="font-medium text-slate-700">Hi, {firstName}</span>
          </span>
        )}
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm bg-white/60 backdrop-blur focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
        >
          {months.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-700">Live</span>
        </div>
      </div>
    </nav>
  );
}
