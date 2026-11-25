/** Format a raw number into Lakhs display */
export const formatLakhs = (value) => {
  if (value >= 100000) return (value / 100000).toFixed(1);
  return value.toFixed(1);
};

/** Short Lakhs label for axis ticks (values already in Lakhs) */
export const tickLakhs = (value) => `${value}`;

/** Format percentage */
export const formatPct = (value) => `${value.toFixed(1)}%`;

/** Convert "05.2026" → "MAY 2026" */
const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
export const formatMonth = (val) => {
  const parts = String(val).split(".");
  if (parts.length === 2) {
    const idx = parseInt(parts[0], 10) - 1;
    if (idx >= 0 && idx < 12) return `${MONTH_NAMES[idx]} ${parts[1]}`;
  }
  return String(val);
};
