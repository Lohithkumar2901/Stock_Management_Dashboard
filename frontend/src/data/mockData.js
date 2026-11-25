// ── Centralized Mock Data (values already in Lakhs) ──

const PLANTS_POOL = [
  "Chennai", "Pune", "Jamshedpur", "Lucknow", "Hosur",
  "Dharwad", "Pantnagar", "Sanand", "Pithampur", "Gurgaon",
  "Rudrapur", "Indore", "Bangalore", "Mysore", "Nagpur",
];

function makePlants(total, count = 10) {
  const selected = PLANTS_POOL.slice(0, count);
  const weights = selected.map(() => Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  return selected.map((name, i) => ({
    name,
    value: Math.round((weights[i] / sum) * total),
  }));
}

// ── Business data per month (with auto / nonAuto splits) ──
export const businessDataByMonth = {
  JAN: [
    { name: "WW", value: 28, auto: 18, nonAuto: 10, plants: makePlants(28) },
    { name: "CV", value: 525, auto: 320, nonAuto: 205, plants: makePlants(525) },
    { name: "TR", value: 995, auto: 610, nonAuto: 385, plants: makePlants(995) },
    { name: "LP", value: 504, auto: 300, nonAuto: 204, plants: makePlants(504) },
    { name: "CAW", value: 693, auto: 420, nonAuto: 273, plants: makePlants(693) },
    { name: "FAW", value: 240, auto: 132, nonAuto: 108, plants: makePlants(240) },
  ],
  FEB: [
    { name: "WW", value: 35, auto: 22, nonAuto: 13, plants: makePlants(35) },
    { name: "CV", value: 480, auto: 290, nonAuto: 190, plants: makePlants(480) },
    { name: "TR", value: 1050, auto: 660, nonAuto: 390, plants: makePlants(1050) },
    { name: "LP", value: 460, auto: 280, nonAuto: 180, plants: makePlants(460) },
    { name: "CAW", value: 720, auto: 450, nonAuto: 270, plants: makePlants(720) },
    { name: "FAW", value: 265, auto: 148, nonAuto: 117, plants: makePlants(265) },
  ],
  MAR: [
    { name: "WW", value: 42, auto: 26, nonAuto: 16, plants: makePlants(42) },
    { name: "CV", value: 550, auto: 340, nonAuto: 210, plants: makePlants(550) },
    { name: "TR", value: 920, auto: 560, nonAuto: 360, plants: makePlants(920) },
    { name: "LP", value: 530, auto: 310, nonAuto: 220, plants: makePlants(530) },
    { name: "CAW", value: 680, auto: 400, nonAuto: 280, plants: makePlants(680) },
    { name: "FAW", value: 220, auto: 114, nonAuto: 106, plants: makePlants(220) },
  ],
};

// ── Auto / Non-Auto split per month ──
export const autoSplitByMonth = {
  JAN: { auto: 1800, nonAuto: 1185 },
  FEB: { auto: 1920, nonAuto: 1090 },
  MAR: { auto: 1750, nonAuto: 1192 },
};

// ── Region data per month ──
export const regionDataByMonth = {
  JAN: [
    { name: "North", value: 620 },
    { name: "South", value: 840 },
    { name: "East", value: 510 },
    { name: "West", value: 730 },
    { name: "Central", value: 285 },
  ],
  FEB: [
    { name: "North", value: 680 },
    { name: "South", value: 790 },
    { name: "East", value: 550 },
    { name: "West", value: 700 },
    { name: "Central", value: 290 },
  ],
  MAR: [
    { name: "North", value: 640 },
    { name: "South", value: 870 },
    { name: "East", value: 480 },
    { name: "West", value: 760 },
    { name: "Central", value: 192 },
  ],
};

// ── Trend data for line chart (all months combined) ──
export const BUSINESSES = ["WW", "CV", "TR", "LP", "CAW", "FAW"];
export const MONTHS = ["JAN", "FEB", "MAR"];

/** @param {"ALL"|"AUTO"|"NONAUTO"} busType */
export function getTrendData(busType = "ALL") {
  return MONTHS.map((month) => {
    const row = { month };
    businessDataByMonth[month].forEach((b) => {
      if (busType === "AUTO") row[b.name] = b.auto;
      else if (busType === "NONAUTO") row[b.name] = b.nonAuto;
      else row[b.name] = b.value;
    });
    return row;
  });
}

/** Filter business array by bus type, returning {name, value, plants} */
export function filterBusinessData(businesses, busType) {
  if (busType === "ALL") return businesses;
  return businesses.map((b) => ({
    ...b,
    value: busType === "AUTO" ? b.auto : b.nonAuto,
  }));
}

// ── Color palettes ──
export const BUSINESS_COLORS = {
  WW: "#6366f1",
  CV: "#8b5cf6",
  TR: "#a855f7",
  LP: "#ec4899",
  CAW: "#f43f5e",
  FAW: "#f97316",
};

export const REGION_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f97316"];

export const PIE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#c084fc",
  "#ec4899", "#f43f5e", "#f97316", "#facc15",
  "#34d399", "#22d3ee",
];
