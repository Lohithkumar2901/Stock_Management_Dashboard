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

export default function CategoryTableModal({
  title, subtitle, categories = [], onCategoryClick, onClose, zIndex = 60,
}) {
  const total = categories.reduce((s, c) => s + Number(c.value || 0), 0);
  const rows = categories.map((c) => ({
    ...c,
    pct: total ? ((c.value / total) * 100).toFixed(1) : "0.0",
    change: changePct(c.mrp_value, c.value),
  }));

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

        <div className="p-5 overflow-auto max-h-[75vh]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Category {onCategoryClick ? "(click to drill)" : ""}
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#6366f1" }}>MRP (L)</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#ec4899" }}>NON-MRP (L)</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wider">Total (L)</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#22c55e" }}>MRP %</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Overall %</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data.</td></tr>
              ) : (
                rows.map((c, i) => (
                  <tr
                    key={c.name}
                    onClick={onCategoryClick ? () => onCategoryClick(c) : undefined}
                    className={`border-b border-gray-100 transition ${
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                    } ${onCategoryClick ? "cursor-pointer hover:bg-indigo-50" : "hover:bg-gray-50"}`}
                  >
                    <td className={`px-4 py-3 font-semibold ${onCategoryClick ? "text-indigo-700" : "text-gray-700"}`}>
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "#6366f1" }}>
                      {fmt2(c.mrp_value ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {fmt2(c.value)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-700">
                      {fmt2(Number(c.mrp_value ?? 0) + Number(c.value ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: c.change.color }}>
                      {c.change.label}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{c.pct}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
