const fmt2 = (n) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mrpPct(mrp, nonMrp) {
  const m = Number(mrp || 0);
  const n = Number(nonMrp || 0);
  if (m === 0) return { label: "0%", color: "#9ca3af" };
  const pct = ((m - n) / m) * 100;
  if (pct <= 0) return { label: "0%", color: "#9ca3af" };
  return { label: `${pct.toFixed(1)}%`, color: "#22c55e" };
}

export default function MaterialTableModal({
  title, subtitle, materials = [], onClose, zIndex = 80, showBusiness = false, showPlant = false,
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={onClose}
    >
      <div
        className="animate-fade-scale bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-[1360px] max-w-[98vw] max-h-[90vh] overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-base">{title}</h2>
            <p className="text-indigo-200 text-xs">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl transition leading-none">&times;</button>
        </div>

        <div className="overflow-auto max-h-[80vh]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-32">Material</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                {showBusiness && <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-20">Business</th>}
                {showPlant && <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-40">Plant</th>}
                <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider w-28" style={{ color: "#6366f1" }}>MRP (L)</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider w-28" style={{ color: "#ec4899" }}>NON-MRP (L)</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wider w-28">Total (L)</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider w-24" style={{ color: "#22c55e" }}>MRP %</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-24">NON-MRP Qty</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No materials found.</td></tr>
              ) : (
                materials.map((m, i) => {
                  const ch = mrpPct(m.stock_value_lakhs ?? 0, m.unplanned_value_lakhs);
                  const rowTotal = Number(m.stock_value_lakhs ?? 0) + Number(m.unplanned_value_lakhs ?? 0);
                  return (
                    <tr
                      key={m.material}
                      className={`border-b border-gray-100 transition hover:bg-indigo-50/40 ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-3 py-2.5 text-gray-400 text-center">{i + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-700 break-all">{m.material}</td>
                      <td className="px-3 py-2.5 text-gray-600">{m.description}</td>
                      {showBusiness && <td className="px-3 py-2.5 text-gray-700 font-medium">{m.business}</td>}
                      {showPlant && <td className="px-3 py-2.5 text-gray-600">{m.plant_name}</td>}
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: "#6366f1" }}>
                        {fmt2(m.stock_value_lakhs ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                        {fmt2(m.unplanned_value_lakhs)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-700">
                        {fmt2(rowTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: ch.color }}>
                        {ch.label}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {fmt2(m.unplanned_qty)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
