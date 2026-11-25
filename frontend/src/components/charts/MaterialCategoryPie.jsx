import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../layout/Card";

// MRP first (blue shades light→vivid), NON-MRP second (red shades light→vivid)
const MRP_COLORS = ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb"];
const NM_COLORS  = ["#fca5a5", "#f87171", "#ef4444", "#dc2626"];

function lighten(hex, amount = 0.45) {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgb(${Math.round(r+(255-r)*amount)},${Math.round(g+(255-g)*amount)},${Math.round(b+(255-b)*amount)})`;
}

const fmt2 = (n) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = d.grandTotal ? ((d.value / d.grandTotal) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg px-3 py-2 border border-gray-100">
      <p className="text-xs font-semibold mb-0.5" style={{ color: d.baseColor }}>{d.label}</p>
      <p className="text-sm font-bold text-gray-800">{fmt2(d.value)} L</p>
      <p className="text-[10px] text-gray-400">{pct}% of total</p>
    </div>
  );
};

export default function MaterialCategoryPie({ data = [], onCategoryClick }) {
  const grandTotal = data.reduce(
    (s, d) => s + Number(d.value || 0) + Number(d.mrp_value || 0), 0
  );

  // MRP group first (blue), then NON-MRP group (red)
  const mrpItems = data.map((d, i) => ({
    id: `${d.name}-mrp`, cat: d.name, type: "mrp",
    label: `${d.name} MRP`, catLabel: d.name,
    value: Number(d.mrp_value || 0),
    baseColor: MRP_COLORS[i % MRP_COLORS.length],
    gradId: `cat-m-${i}`, grandTotal,
  }));
  const nmItems = data.map((d, i) => ({
    id: `${d.name}-nonmrp`, cat: d.name, type: "nonmrp",
    label: `${d.name} NON-MRP`, catLabel: d.name,
    value: Number(d.value || 0),
    baseColor: NM_COLORS[i % NM_COLORS.length],
    gradId: `cat-nm-${i}`, grandTotal,
  }));
  const items = [...mrpItems, ...nmItems];

  const handleClick = (entry) => {
    if (entry?.cat) onCategoryClick?.({ name: entry.cat });
  };

  const LegendGroup = ({ title, color, group }) => (
    <div className="mb-2">
      <p className="text-[10px] font-bold mb-1 tracking-wide" style={{ color }}>{title}</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {group.map((d) => {
          const pct = grandTotal ? ((d.value / grandTotal) * 100).toFixed(1) : "0.0";
          return (
            <button
              key={d.id}
              onClick={() => handleClick(d)}
              disabled={!onCategoryClick}
              className={`flex items-center gap-1.5 text-left rounded px-1 py-0.5 ${
                onCategoryClick ? "hover:bg-indigo-50/60 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.baseColor }} />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-700">{d.catLabel}</p>
                <p className="text-[10px] font-medium" style={{ color: d.baseColor }}>{pct}%</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card>
      <h3 className="mb-0.5 font-semibold text-gray-700 text-sm">Material Category</h3>
      <p className="text-[11px] text-gray-400 mb-1">
        {onCategoryClick ? "Click a slice to drill down" : "MRP & NON-MRP by category"}
        &nbsp;·&nbsp;
        <span style={{ color: "#3b82f6" }}>Blue = MRP</span>
        &nbsp;·&nbsp;
        <span style={{ color: "#ef4444" }}>Red = NON-MRP</span>
      </p>

      <div className="flex items-center">
        <div className="w-3/5">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <defs>
                {items.map((item) => (
                  <linearGradient key={item.gradId} id={item.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lighten(item.baseColor, 0.4)} stopOpacity={1} />
                    <stop offset="100%" stopColor={item.baseColor} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={items}
                cx="50%" cy="50%"
                innerRadius={52} outerRadius={88}
                paddingAngle={1.5} minAngle={4}
                dataKey="value" stroke="none"
                animationDuration={800}
                onClick={(d) => handleClick(d)}
              >
                {items.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={`url(#${entry.gradId})`}
                    style={{ cursor: onCategoryClick ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-8" fontSize={10} fill="#9ca3af">Total</tspan>
                <tspan x="50%" dy="16" fontSize={11} fontWeight="bold" fill="#374151">
                  {fmt2(grandTotal)}
                </tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-2/5 pl-3">
          <LegendGroup title="MRP" color="#3b82f6" group={mrpItems} />
          <LegendGroup title="NON-MRP" color="#ef4444" group={nmItems} />
        </div>
      </div>
    </Card>
  );
}
