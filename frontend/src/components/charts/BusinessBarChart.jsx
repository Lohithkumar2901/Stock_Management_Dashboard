import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import Card from "../layout/Card";
import { tickLakhs } from "../../utils/format";

const NON_MRP_COLOR = "#ec4899";
const MRP_COLOR = "#6366f1";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const name = payload[0]?.payload?.name;
  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg px-3 py-2 border border-gray-100 min-w-[170px]">
      <p className="text-xs font-semibold text-indigo-600 mb-1.5">{name}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4 text-xs mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.name === "NON-MRP" ? NON_MRP_COLOR : MRP_COLOR }} />
            <span className="font-medium text-gray-600">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800">{tickLakhs(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const BUS_TYPE_OPTIONS = [
  { key: "AUTO", label: "Auto" },
  { key: "EMCE", label: "EMCE" },
];

function BusTypeToggle({ value, onChange }) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {BUS_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
            value === opt.key
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function BusinessBarChart({ data = [], onBarClick, busType = "AUTO", onBusTypeChange }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="font-semibold text-gray-700 text-sm">Business Analysis</h3>
          <p className="text-[11px] text-gray-400">Click bar for drilldown</p>
        </div>
        {onBusTypeChange && (
          <BusTypeToggle value={busType} onChange={onBusTypeChange} />
        )}
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          barCategoryGap="20%"
          barGap={2}
        >
          <defs>
            <linearGradient id="biz-grad-nonmrp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NON_MRP_COLOR} stopOpacity={1} />
              <stop offset="100%" stopColor={NON_MRP_COLOR} stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="biz-grad-mrp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MRP_COLOR} stopOpacity={1} />
              <stop offset="100%" stopColor={MRP_COLOR} stopOpacity={0.35} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="name"
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.05)" }} />
          <Legend
            iconType="rect"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(value) => <span style={{ color: "#6b7280" }}>{value}</span>}
          />
          <Bar
            dataKey="mrp_value"
            name="MRP"
            fill="url(#biz-grad-mrp)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            onClick={(entry) => onBarClick?.(entry)}
            style={{ cursor: "pointer" }}
          />
          <Bar
            dataKey="value"
            name="NON-MRP"
            fill="url(#biz-grad-nonmrp)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            onClick={(entry) => onBarClick?.(entry)}
            style={{ cursor: "pointer" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
