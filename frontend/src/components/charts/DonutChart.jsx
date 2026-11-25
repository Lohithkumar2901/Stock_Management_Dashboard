import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../layout/Card";

// Auto = vivid shades · EMCE = light shades · MRP = blue · NON-MRP = red
const SEGMENTS = [
  { key: "mrp_auto",        name: "Auto MRP",      busType: "AUTO", fill: "#2563eb" },
  { key: "non_mrp_auto",    name: "Auto NON-MRP",  busType: "AUTO", fill: "#dc2626" },
  { key: "mrp_nonAuto",     name: "EMCE MRP",      busType: "EMCE", fill: "#93c5fd" },
  { key: "non_mrp_nonAuto", name: "EMCE NON-MRP",  busType: "EMCE", fill: "#fca5a5" },
];

function lighten(hex, amount = 0.45) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`;
}

const fmt2 = (n) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg px-3 py-2 border border-gray-100">
      <p className="text-xs font-semibold" style={{ color: d.payload.fill }}>{d.name}</p>
      <p className="text-sm font-bold text-gray-800">{fmt2(d.value)}</p>
      <p className="text-[10px] text-gray-400">{d.payload.pct}%</p>
    </div>
  );
};

export default function DonutChart({ mrp_auto = 0, mrp_nonAuto = 0, non_mrp_auto = 0, non_mrp_nonAuto = 0, totalStock = 0, onSliceClick }) {
  const vals = { mrp_auto, mrp_nonAuto, non_mrp_auto, non_mrp_nonAuto };
  const segTotal = Object.values(vals).reduce((s, v) => s + v, 0);
  const displayTotal = totalStock > 0 ? totalStock : segTotal;

  const data = SEGMENTS.map((seg) => ({
    ...seg,
    value: vals[seg.key] ?? 0,
    pct: displayTotal ? (((vals[seg.key] ?? 0) / displayTotal) * 100).toFixed(1) : "0.0",
  }));

  const handleSlice = (entry) => {
    if (entry?.busType) onSliceClick?.(entry);
  };

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-gray-700 text-sm">Overall</h3>
      <p className="text-[11px] text-gray-400 mb-2">
        {onSliceClick ? "Click a slice to drill down" : "MRP & NON-MRP Distribution"}
      </p>

      <div className="flex items-center">
        <div className="w-3/5">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <defs>
                {SEGMENTS.map((seg) => (
                  <linearGradient key={seg.key} id={`dlg-${seg.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lighten(seg.fill, 0.45)} stopOpacity={1} />
                    <stop offset="100%" stopColor={seg.fill} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                minAngle={8}
                dataKey="value"
                stroke="none"
                animationDuration={800}
                onClick={(d) => handleSlice(d)}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={`url(#dlg-${entry.key})`}
                    style={{ cursor: onSliceClick ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-8" fontSize={10} fill="#9ca3af">Total Stock</tspan>
                <tspan x="50%" dy="16" fontSize={11} fontWeight="bold" fill="#374151">
                  {fmt2(displayTotal)}
                </tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-2/5 space-y-2 pl-2">
          {data.map((d) => (
            <button
              key={d.key}
              onClick={() => handleSlice(d)}
              disabled={!onSliceClick}
              className={`w-full flex items-center gap-2 text-left rounded-md px-1 py-0.5 ${
                onSliceClick ? "hover:bg-indigo-50/60 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.fill }} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-600 truncate">{d.name}</p>
                <p className="text-xs font-bold text-gray-800">{d.pct}%</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
