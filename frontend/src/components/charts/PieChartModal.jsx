import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  fetchBusinessCategories,
  fetchBusinessMaterialDrilldown,
  fetchCategoryDrilldown,
  fetchMaterialDrilldown,
} from "../../services/api";
import MaterialTableModal from "./MaterialTableModal";
import { formatMonth } from "../../utils/format";

const PIE_COLORS = [
  "#3b82f6", "#f97316", "#22c55e", "#ef4444",
  "#a855f7", "#eab308", "#14b8a6", "#ec4899",
  "#8b5cf6", "#84cc16",
];

const fmt2 = (n) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function changePct(mrp, nonMrp) {
  const m = Number(mrp || 0);
  const n = Number(nonMrp || 0);
  if (m === 0) return { label: "0%", color: "#9ca3af" };
  const pct = ((m - n) / m) * 100;
  if (pct <= 0) return { label: "0%", color: "#9ca3af" };
  return { label: `${pct.toFixed(1)}%`, color: "#22c55e" };
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg px-3 py-2 border border-gray-100">
      <p className="text-xs font-semibold text-indigo-600">{d.name}</p>
      <p className="text-sm font-bold text-gray-800">{fmt2(d.value)}</p>
      <p className="text-[10px] text-gray-400">{d.pct}%</p>
    </div>
  );
};

/* ─── Plant → category drill: pie + structured table ─── */
function PieView({ title, subtitle, items = [], onClose, onItemClick, zIndex = 70, preserveOrder = false }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const total = items.reduce((s, p) => s + p.value, 0);
  const mapped = items.map((p) => ({
    ...p,
    pct: total ? ((p.value / total) * 100).toFixed(1) : "0.0",
  }));
  const withPct = preserveOrder ? mapped : [...mapped].sort((a, b) => b.value - a.value);
  const top8 = withPct.slice(0, 8);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className="animate-fade-scale bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-[960px] max-w-[96vw] max-h-[88vh] overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-base">{title}</h2>
            <p className="text-indigo-200 text-xs">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl transition leading-none">&times;</button>
        </div>

        <div className="p-6 flex gap-6">
          {/* Mini pie */}
          <div className="w-[240px] shrink-0">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={top8} cx="50%" cy="50%"
                  innerRadius={0} outerRadius={88}
                  paddingAngle={1} dataKey="value" stroke="none"
                  animationDuration={600}
                  onMouseEnter={(_, i) => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {top8.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                      style={{
                        transform: activeIndex === i ? "scale(1.07)" : "scale(1)",
                        transformOrigin: "center",
                        transition: "transform .2s ease",
                        filter: activeIndex === i ? "drop-shadow(0 2px 8px rgba(0,0,0,.2))" : "none",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {top8.map((p, i) => (
                <div key={p.name} className="flex items-start gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-gray-600 break-words flex-1 leading-tight">{p.name}</span>
                  <span className="font-semibold text-gray-500 shrink-0">{p.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Structured table */}
          <div className="flex-1 overflow-auto max-h-[60vh]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {onItemClick ? "Category (click to drill)" : "Item"}
                  </th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6366f1" }}>MRP (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#ec4899" }}>NON-MRP (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Total (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#22c55e" }}>MRP %</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {withPct.map((p, i) => {
                  const ch = changePct(p.mrp_value, p.value);
                  const rowTotal = Number(p.mrp_value ?? 0) + Number(p.value ?? 0);
                  return (
                    <tr
                      key={p.name}
                      onClick={onItemClick ? () => onItemClick(p) : undefined}
                      className={`border-b border-gray-100 transition ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      } ${onItemClick ? "cursor-pointer hover:bg-indigo-50" : "hover:bg-gray-50"}`}
                    >
                      <td className={`px-3 py-2.5 ${onItemClick ? "text-indigo-700 font-semibold" : "text-gray-700"}`}>{p.name}</td>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "#6366f1" }}>{fmt2(p.mrp_value ?? 0)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmt2(p.value)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-700">{fmt2(rowTotal)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: ch.color }}>{ch.label}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{p.pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Business drilldown: category table + plants table ─── */
function BusinessDrilldownModal({ business, plants = [], categories = [], onClose, onCategoryClick, onPlantClick }) {
  const catTotal = categories.reduce((s, c) => s + Number(c.value || 0), 0);
  const cats = categories.map((c) => ({
    ...c,
    pct: catTotal ? ((c.value / catTotal) * 100).toFixed(1) : "0.0",
  }));

  const plantTotal = plants.reduce((s, p) => s + Number(p.value || 0), 0);
  const sortedPlants = [...plants]
    .map((p) => ({ ...p, pct: plantTotal ? ((p.value / plantTotal) * 100).toFixed(1) : "0.0" }))
    .sort((a, b) => b.value - a.value);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-[60]"
      onClick={onClose}
    >
      <div
        className="animate-fade-scale bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-[1100px] max-w-[97vw] max-h-[90vh] overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-base">{business} — Drilldown</h2>
            <p className="text-indigo-200 text-xs">Click a category for top 25 materials · Click a plant for plant-level drilldown</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl transition leading-none">&times;</button>
        </div>

        <div className="p-6 flex gap-6 overflow-auto max-h-[80vh]">
          {/* Category table */}
          <div className="w-1/2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Material Category — click to drill</p>
            <table className="w-full text-xs border-collapse rounded-xl overflow-hidden border border-gray-200">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase" style={{ color: "#6366f1" }}>MRP (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase" style={{ color: "#ec4899" }}>NON-MRP (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-700 uppercase">Total (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase" style={{ color: "#22c55e" }}>MRP %</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {cats.length === 0
                  ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data.</td></tr>
                  : cats.map((c, i) => {
                      const ch = changePct(c.mrp_value, c.value);
                      const rowTotal = Number(c.mrp_value ?? 0) + Number(c.value ?? 0);
                      return (
                        <tr
                          key={c.name}
                          onClick={() => onCategoryClick?.(c)}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-indigo-50 transition ${
                            i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-3 py-2.5 text-indigo-700 font-semibold">{c.name}</td>
                          <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "#6366f1" }}>{fmt2(c.mrp_value ?? 0)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmt2(c.value)}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-700">{fmt2(rowTotal)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold" style={{ color: ch.color }}>{ch.label}</td>
                          <td className="px-3 py-2.5 text-right text-gray-500">{c.pct}%</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Plants table */}
          <div className="w-1/2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Plants — click to drill</p>
            <table className="w-full text-xs border-collapse rounded-xl overflow-hidden border border-gray-200">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plant</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase" style={{ color: "#6366f1" }}>MRP (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase" style={{ color: "#ec4899" }}>NON-MRP (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-700 uppercase">Total (L)</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase" style={{ color: "#22c55e" }}>MRP %</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlants.map((p, i) => {
                  const ch = changePct(p.mrp_value, p.value);
                  const rowTotal = Number(p.mrp_value ?? 0) + Number(p.value ?? 0);
                  return (
                    <tr
                      key={p.plnt || p.name}
                      onClick={() => onPlantClick?.(p)}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-indigo-50 transition ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-indigo-700 font-medium">{p.name}</td>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "#6366f1" }}>{fmt2(p.mrp_value ?? 0)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{fmt2(p.value)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-700">{fmt2(rowTotal)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: ch.color }}>{ch.label}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{p.pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PieChartModal({ business, plants = [], month, onClose }) {
  const [categories, setCategories] = useState([]);
  const [categoryDrill, setCategoryDrill] = useState(null);
  const [materialDrill, setMaterialDrill] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!business || !month) return;
    let cancelled = false;
    setLoading(true);
    fetchBusinessCategories(month, business)
      .then((rows) => { if (!cancelled) setCategories(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [business, month]);

  if (!business) return null;

  const handleCategoryFromBusiness = async (cat) => {
    if (!month || !cat?.name) return;
    setLoading(true);
    try {
      const mats = await fetchBusinessMaterialDrilldown(month, business, cat.name);
      setMaterialDrill({ title: `${cat.name} — Top 25 Materials`, subtitle: `${business} · ${formatMonth(month)}`, materials: mats, showPlant: true, showBusiness: false });
    } finally { setLoading(false); }
  };

  const handlePlantClick = async (plant) => {
    if (!month) return;
    setLoading(true);
    try {
      const cats = await fetchCategoryDrilldown(month, business, plant.plnt);
      setCategoryDrill({ plant, categories: cats });
    } finally { setLoading(false); }
  };

  const handleCategoryFromPlant = async (cat) => {
    if (!month || !categoryDrill?.plant) return;
    setLoading(true);
    try {
      const mats = await fetchMaterialDrilldown(month, business, categoryDrill.plant.plnt, cat.name);
      setMaterialDrill({
        title: `${cat.name} — Top 25 Materials`,
        subtitle: `${categoryDrill.plant.name} · ${business} · ${formatMonth(month)}`,
        materials: mats, showPlant: false, showBusiness: false,
      });
    } finally { setLoading(false); }
  };

  return (
    <>
      <BusinessDrilldownModal
        business={business} plants={plants} categories={categories}
        onClose={onClose} onCategoryClick={handleCategoryFromBusiness} onPlantClick={handlePlantClick}
      />
      {categoryDrill && (
        <PieView
          title={`${categoryDrill.plant.name} — Category Breakdown`}
          subtitle={`${business} · ${formatMonth(month)} · Click a category for top 25 materials`}
          items={categoryDrill.categories}
          onClose={() => setCategoryDrill(null)}
          onItemClick={handleCategoryFromPlant}
          zIndex={70} preserveOrder
        />
      )}
      {materialDrill && (
        <MaterialTableModal
          title={materialDrill.title} subtitle={materialDrill.subtitle}
          materials={materialDrill.materials}
          showBusiness={materialDrill.showBusiness} showPlant={materialDrill.showPlant}
          onClose={() => setMaterialDrill(null)} zIndex={80}
        />
      )}
      {loading && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-4 border-white/70 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}
