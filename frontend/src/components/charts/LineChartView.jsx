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

function getColor(index) {
  return COLOR_POOL[index % COLOR_POOL.length];
}

const CustomTooltip = ({ active, payload, label, bizNames, bizColors, mode }) => {
  if (!active || !payload?.length) return null;

  const byBiz = {};
  payload.forEach((p) => {
    const isMRP = p.dataKey.endsWith("_MRP");
    const biz = isMRP ? p.dataKey.slice(0, -4) : p.dataKey.slice(0, -7);
    if (!byBiz[biz]) byBiz[biz] = {};
    if (isMRP) byBiz[biz].mrp = p.value;
    else byBiz[biz].nonMrp = p.value;
  });

  const valKey = mode === "NONMRP" ? "nonMrp" : "mrp";
  const rows = bizNames
    .filter((b) => byBiz[b])
    .sort((a, b) => (byBiz[b][valKey] ?? 0) - (byBiz[a][valKey] ?? 0))
    .slice(0, 8);

  const colLabel = mode === "NONMRP" ? "NON-MRP" : "MRP";
  const colColor = mode === "NONMRP" ? "#ec4899" : "#6366f1";

  return (
    <div className="bg-white/95 backdrop-blur-xl shadow-xl border rounded-xl px-4 py-3 min-w-[190px]">
      <p className="text-xs font-bold text-gray-500 mb-2">{formatMonthTick(label)}</p>
      <div className="flex text-[10px] font-semibold text-gray-400 mb-1 gap-2">
        <span className="flex-1">Business</span>
        <span className="w-16 text-right" style={{ color: colColor }}>{colLabel}</span>
      </div>
      {rows.map((biz) => (
        <div key={biz} className="flex items-center text-xs mb-0.5 gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: bizColors[biz] }} />
          <span className="flex-1 text-gray-700 font-medium">{biz}</span>
          <span className="w-16 text-right font-semibold text-gray-800">
            {byBiz[biz][valKey] != null ? tickLakhs(byBiz[biz][valKey]) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function LineChartView({ data = [], mode = "MRP" }) {
  const [activeBiz, setActiveBiz] = useState(null);

  const bizNames = useMemo(() => {
    const keys = new Set();
    data.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "month" && k.endsWith("_MRP")) keys.add(k.slice(0, -4));
      });
    });
    return [...keys];
  }, [data]);

  const bizColors = useMemo(() => {
    const map = {};
    bizNames.forEach((name, i) => { map[name] = getColor(i); });
    return map;
  }, [bizNames]);

  const isMRP = mode === "MRP";
  const title = isMRP ? "MRP Trend" : "NON-MRP Trend";
  const subtitle = isMRP
    ? "Total stock value by business · Hover to highlight"
    : "Unplanned value by business · Hover to highlight";
  const lineStyle = isMRP ? undefined : "5 4";
  const lineOpacityBase = isMRP ? 1 : 0.85;

  const renderLegend = () => (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
      {bizNames.map((biz) => (
        <button
          key={biz}
          onMouseEnter={() => setActiveBiz(biz)}
          onMouseLeave={() => setActiveBiz(null)}
          className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-900 transition"
        >
          <svg width="22" height="10">
            <line
              x1="0" y1="5" x2="22" y2="5"
              stroke={bizColors[biz]}
              strokeWidth="2"
              strokeDasharray={lineStyle}
            />
          </svg>
          <span>{biz}</span>
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <div className="mb-1">
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        <p className="text-[11px] text-gray-400">{subtitle}</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {bizNames.map((biz) => (
              <linearGradient key={biz} id={`lg-${mode}-${biz}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={bizColors[biz]} stopOpacity={0.18} />
                <stop offset="100%" stopColor={bizColors[biz]} stopOpacity={0} />
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
            content={<CustomTooltip bizNames={bizNames} bizColors={bizColors} mode={mode} />}
          />

          {/* Gradient area fills under lines */}
          {bizNames.map((biz) => (
            <Area
              key={`area-${biz}`}
              type="monotone"
              dataKey={isMRP ? `${biz}_MRP` : `${biz}_NonMRP`}
              fill={`url(#lg-${mode}-${biz})`}
              stroke="none"
              opacity={activeBiz && activeBiz !== biz ? 0 : 1}
            />
          ))}

          {bizNames.map((biz) => (
            <Line
              key={`line-${biz}`}
              type="monotone"
              dataKey={isMRP ? `${biz}_MRP` : `${biz}_NonMRP`}
              stroke={bizColors[biz]}
              strokeWidth={activeBiz === biz ? 3 : 1.8}
              strokeDasharray={lineStyle}
              dot={false}
              activeDot={{ r: 5, fill: bizColors[biz], stroke: "#fff", strokeWidth: 2 }}
              opacity={activeBiz && activeBiz !== biz ? 0.15 : lineOpacityBase}
              onMouseEnter={() => setActiveBiz(biz)}
              onMouseLeave={() => setActiveBiz(null)}
              style={{ cursor: "default", transition: "opacity .2s" }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {renderLegend()}
    </Card>
  );
}
