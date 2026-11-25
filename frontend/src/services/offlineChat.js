import {
  businessDataByMonth,
  autoSplitByMonth,
  regionDataByMonth,
  MONTHS,
} from "../data/mockData";

/**
 * Offline chatbot that answers questions from the dashboard mock data
 * when the backend API is unavailable.
 */
export function offlineReply(question, month = "JAN") {
  const q = question.toLowerCase();

  // Detect month override in question
  const detectedMonth = MONTHS.find((m) => q.includes(m.toLowerCase()));
  const m = detectedMonth || month;

  const businesses = businessDataByMonth[m] || [];
  const autoSplit = autoSplitByMonth[m] || {};
  const regions = regionDataByMonth[m] || [];

  // ── Top plants (across all businesses) ──
  if (q.includes("plant")) {
    const allPlants = {};
    businesses.forEach((biz) => {
      (biz.plants || []).forEach((p) => {
        allPlants[p.name] = (allPlants[p.name] || 0) + p.value;
      });
    });
    const sorted = Object.entries(allPlants)
      .map(([name, value]) => ({ Plant: name, "Value (L)": value }))
      .sort((a, b) => b["Value (L)"] - a["Value (L)"]);

    const limit = parseNumber(q) || 5;
    const top = sorted.slice(0, limit);

    return {
      answer: `Top ${top.length} plants by unplanned value for ${m}:`,
      table: top,
    };
  }

  // ── Business query ──
  if (q.includes("business") || q.includes("segment") || q.includes("unit")) {
    const table = businesses.map((b) => ({
      Business: b.name,
      Total: `${b.value}L`,
      Auto: `${b.auto}L`,
      "Non-Auto": `${b.nonAuto}L`,
    }));
    return {
      answer: `Business-wise unplanned values for ${m}:`,
      table,
    };
  }

  // ── Region query ──
  if (q.includes("region")) {
    const table = regions.map((r) => ({
      Region: r.name,
      "Value (L)": r.value,
    }));
    return {
      answer: `Region-wise unplanned values for ${m}:`,
      table,
    };
  }

  // ── Auto / Non-Auto query ──
  if (q.includes("auto") || q.includes("non-auto") || q.includes("nonauto") || q.includes("split")) {
    const total = autoSplit.auto + autoSplit.nonAuto;
    const autoPct = ((autoSplit.auto / total) * 100).toFixed(1);
    const nonPct = ((autoSplit.nonAuto / total) * 100).toFixed(1);
    return {
      answer: `Auto vs Non-Auto split for ${m}:\n\nAuto: ${autoSplit.auto}L (${autoPct}%)\nNon-Auto: ${autoSplit.nonAuto}L (${nonPct}%)\nTotal: ${total}L`,
      table: null,
    };
  }

  // ── Total / summary ──
  if (q.includes("total") || q.includes("summary") || q.includes("overview")) {
    const bizTotal = businesses.reduce((s, b) => s + b.value, 0);
    return {
      answer: `Summary for ${m}:\n\nTotal unplanned value: ${bizTotal}L\nAuto: ${autoSplit.auto}L\nNon-Auto: ${autoSplit.nonAuto}L\nBusinesses: ${businesses.length}\nRegions: ${regions.length}`,
      table: null,
    };
  }

  // ── Trend ──
  if (q.includes("trend") || q.includes("month")) {
    const table = MONTHS.map((mo) => {
      const split = autoSplitByMonth[mo];
      return { Month: mo, Auto: `${split.auto}L`, "Non-Auto": `${split.nonAuto}L`, Total: `${split.auto + split.nonAuto}L` };
    });
    return {
      answer: "Monthly trend of unplanned values:",
      table,
    };
  }

  // ── Material (generic) ──
  if (q.includes("material") || q.includes("part") || q.includes("item")) {
    return {
      answer: "Material-level data requires the database backend. Currently running in offline mode with aggregated dashboard data.\n\nTry asking about plants, businesses, regions, or auto/non-auto split instead.",
      table: null,
    };
  }

  // ── Default ──
  return {
    answer: `I'm running in offline mode (backend unavailable). I can answer questions about:\n\n- Plants (e.g. "top 5 plants")\n- Businesses (e.g. "business wise values")\n- Regions (e.g. "region analysis")\n- Auto/Non-Auto split\n- Monthly trend\n- Summary/total\n\nCurrently showing data for: ${m}`,
    table: null,
  };
}

function parseNumber(str) {
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}
