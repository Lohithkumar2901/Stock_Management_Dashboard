import { useState, useMemo } from "react";
import {
  Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart,
} from "recharts";
import Card from "../layout/Card";
import { tickLakhs } from "../../utils/format";

const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const COLOR_POOL = [
  "#6366f1", "#f97316", "#22c55e", "#ef4444",
  "#a855f7", "#eab308", "#14b8a6", "#ec4899",
  "#06b6d4", "#84cc16", "#8b5cf6", "#f43f5e",
];

function formatMonthTick(val) {
  const parts = String(val).split(".");
  if (parts.length === 2) {
    const idx = parseInt(parts[0], 10) - 1;
    if (idx >= 0 && idx < 12) return MONTH_NAMES[idx];
  }
  return String(val);
}

const CustomTooltip = ({ active, payload, label, plantCodes, plantColors, nameMap, mode }) => {
  if (!active || !payload?.length) return null;

  const byPlant = {};
  payload.forEach((p) => {
    const isMRP = p.dataKey.endsWith("_MRP");
    const code = isMRP ? p.dataKey.slice(0, -4) : p.dataKey.slice(0, -7);
    if (!byPlant[code]) byPlant[code] = {};
    if (isMRP) byPlant[code].mrp = p.value;
    else byPlant[code].nonMrp = p.value;
  });

  const valKey = mode === "NONMRP" ? "nonMrp" : "mrp";
  const rows = plantCodes
    .filter((c) => byPlant[c])
    .sort((a, b) => (byPlant[b][valKey] ?? 0) - (byPlant[a][valKey] ?? 0))
    .slice(0, 8);

  const colLabel = mode === "NONMRP" ? "NON-MRP" : "MRP";
  const colColor = mode === "NONMRP" ? "#ec4899" : "#6366f1";

  return (
    <div className="bg-white/95 backdrop-blur-xl shadow-xl border rounded-xl px-4 py-3 min-w-[220px] max-w-[280px]">
      <p className="text-xs font-bold text-gray-500 mb-2">{formatMonthTick(label)}</p>
      <div className="flex text-[10px] font-semibold text-gray-400 mb-1 gap-2">
        <span className="flex-1">Plant</span>
        <span className="w-16 text-right" style={{ color: colColor }}>{colLabel}</span>
      </div>
      {rows.map((code) => (
        <div key={code} className="flex items-center text-xs mb-0.5 gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: plantColors[code] }} />
          <span className="flex-1 text-gray-700 font-medium truncate">{nameMap[code] || code}</span>
          <span className="w-16 text-right font-semibold text-gray-800">
            {byPlant[code][valKey] != null ? tickLakhs(byPlant[code][valKey]) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function PlantTrendChart({ data = [], nameMap = {}, mode = "MRP" }) {
  const [activePlant, setActivePlant] = useState(null);

  const plantCodes = useMemo(() => {
    const keys = new Set();
    data.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "month" && k.endsWith("_MRP")) keys.add(k.slice(0, -4));
      });
    });
    return [...keys];
  }, [data]);

  const plantColors = useMemo(() => {
    const map = {};
    plantCodes.forEach((code, i) => { map[code] = COLOR_POOL[i % COLOR_POOL.length]; });
    return map;
  }, [plantCodes]);

  const isMRP = mode === "MRP";
  const title = isMRP ? "Plant MRP Trend" : "Plant NON-MRP Trend";
  const subtitle = isMRP
    ? "Top plants by MRP stock value · Hover to highlight"
    : "Top plants by unplanned value · Hover to highlight";
  const lineStyle = isMRP ? undefined : "5 4";
  const lineOpacityBase = isMRP ? 1 : 0.85;

  return (
    <Card>
      <div className="mb-1">
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        <p className="text-[11px] text-gray-400">{subtitle}</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {plantCodes.map((code) => (
              <linearGradient key={code} id={`plg-${mode}-${code}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={plantColors[code]} stopOpacity={0.18} />
                <stop offset="100%" stopColor={plantColors[code]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthTick}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={tickLakhs}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip
                plantCodes={plantCodes}
                plantColors={plantColors}
                nameMap={nameMap}
                mode={mode}
              />
            }
          />

          {plantCodes.map((code) => (
            <Area
              key={`area-${code}`}
              type="monotone"
              dataKey={isMRP ? `${code}_MRP` : `${code}_NonMRP`}
              fill={`url(#plg-${mode}-${code})`}
              stroke="none"
              opacity={activePlant && activePlant !== code ? 0 : 1}
            />
          ))}

          {plantCodes.map((code) => (
            <Line
              key={`line-${code}`}
              type="monotone"
              dataKey={isMRP ? `${code}_MRP` : `${code}_NonMRP`}
              stroke={plantColors[code]}
              strokeWidth={activePlant === code ? 3 : 1.8}
              strokeDasharray={lineStyle}
              dot={false}
              activeDot={{ r: 5, fill: plantColors[code], stroke: "#fff", strokeWidth: 2 }}
              opacity={activePlant && activePlant !== code ? 0.15 : lineOpacityBase}
              onMouseEnter={() => setActivePlant(code)}
              onMouseLeave={() => setActivePlant(null)}
              style={{ cursor: "default", transition: "opacity .2s" }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
        {plantCodes.map((code) => (
          <button
            key={code}
            onMouseEnter={() => setActivePlant(code)}
            onMouseLeave={() => setActivePlant(null)}
            className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-900 transition"
          >
            <svg width="22" height="10">
              <line
                x1="0" y1="5" x2="22" y2="5"
                stroke={plantColors[code]}
                strokeWidth="2"
                strokeDasharray={lineStyle}
              />
            </svg>
            <span className="max-w-[120px] truncate">{nameMap[code] || code}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
