import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "../components/layout/Navbar";
import DonutChart from "../components/charts/DonutChart";
import MaterialCategoryPie from "../components/charts/MaterialCategoryPie";
import BusinessBarChart from "../components/charts/BusinessBarChart";
import LineChartView from "../components/charts/LineChartView";
import PlantTrendChart from "../components/charts/PlantTrendChart";
import RegionBarChart from "../components/charts/RegionBarChart";
import PieChartModal from "../components/charts/PieChartModal";
import CategoryTableModal from "../components/charts/CategoryTableModal";
import MaterialTableModal from "../components/charts/MaterialTableModal";
import ChatButton from "../components/chatbot/ChatButton";
import ChatPanel from "../components/chatbot/ChatPanel";

import {
  fetchCurrentMonth,
  fetchMonths,
  fetchSummary,
  fetchBusinesses,
  fetchRegions,
  fetchTrend,
  fetchDrilldown,
  fetchMaterialCategories,
  fetchBusTypeCategories,
  fetchBusTypeMaterialDrilldown,
  fetchCategoryMaterialDrilldown,
  fetchPlantTrend,
} from "../services/api";
import { formatMonth } from "../utils/format";

export default function Dashboard() {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [busType, setBusType] = useState("AUTO");
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);

  // Data states
  const [autoSplit, setAutoSplit] = useState({ mrp_auto: 0, mrp_nonAuto: 0, non_mrp_auto: 0, non_mrp_nonAuto: 0, total_stock: 0 });
  const [matCategories, setMatCategories] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [regions, setRegions] = useState([]);
  const [trendData, setTrendData] = useState([]);

  // Plant trend data
  const [plantTrendData, setPlantTrendData] = useState({ trend: [], names: {} });

  // Drilldown popups
  const [businessDrilldown, setBusinessDrilldown] = useState(null);
  const [busTypeDrill, setBusTypeDrill] = useState(null);          // {bus_type, label, categories}
  const [materialDrill, setMaterialDrill] = useState(null);        // {title, subtitle, materials, showPlant, showBusiness}

  // Load available months, current month, and plant trend on mount
  useEffect(() => {
    Promise.all([fetchMonths(), fetchCurrentMonth(), fetchPlantTrend(10)]).then(([list, current, plantTrend]) => {
      const arr = Array.isArray(list) ? list : [];
      if (current && !arr.includes(current)) arr.push(current);
      setMonths(arr);
      setMonth(current || (arr.length > 0 ? arr[arr.length - 1] : ""));
      setPlantTrendData(plantTrend || { trend: [], names: {} });
    });
  }, []);

  // Full reload when month changes (shows spinner)
  useEffect(() => {
    if (!month) return;
    setLoading(true);
    Promise.all([
      fetchSummary(month),
      fetchBusinesses(month, busType),
      fetchRegions(month),
      fetchTrend(busType),
      fetchMaterialCategories(month),
    ]).then(([summary, biz, reg, trend, mats]) => {
      setAutoSplit(summary);
      setBusinesses(biz);
      setRegions(reg);
      setTrendData(trend);
      setMatCategories(mats);
    }).finally(() => setLoading(false));
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth update when busType toggles — no spinner, only re-fetch charts that depend on it
  const busTypeInitial = useRef(true);
  useEffect(() => {
    if (busTypeInitial.current) { busTypeInitial.current = false; return; }
    if (!month) return;
    Promise.all([
      fetchBusinesses(month, busType),
      fetchTrend(busType),
    ]).then(([biz, trend]) => {
      setBusinesses(biz);
      setTrendData(trend);
    });
  }, [busType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBarClick = useCallback(
    (entry) => {
      if (!month) return;
      fetchDrilldown(month, entry.name).then((plants) => {
        setBusinessDrilldown({ business: entry.name, plants });
      });
    },
    [month]
  );

  // 4-segment pie click → category table modal for that bus_type (AUTO or NONAUTO)
  const handleBusTypeSlice = useCallback(
    async (slice) => {
      if (!month || !slice?.busType) return;
      setDrillLoading(true);
      try {
        const cats = await fetchBusTypeCategories(month, slice.busType);
        setBusTypeDrill({ bus_type: slice.busType, label: slice.name, categories: cats });
      } finally {
        setDrillLoading(false);
      }
    },
    [month]
  );

  // Inside the AUTO/NONAUTO category modal: click a category → top 25 materials
  const handleBusTypeCategoryClick = useCallback(
    async (cat) => {
      if (!month || !busTypeDrill?.bus_type || !cat?.name) return;
      setDrillLoading(true);
      try {
        const mats = await fetchBusTypeMaterialDrilldown(month, busTypeDrill.bus_type, cat.name);
        setMaterialDrill({
          title: `${cat.name} — Top 25 Materials`,
          subtitle: `${busTypeDrill.label} · ${formatMonth(month)}`,
          materials: mats,
          showBusiness: true,
          showPlant: true,
        });
      } finally {
        setDrillLoading(false);
      }
    },
    [month, busTypeDrill]
  );

  // Overall Material Category pie click → top 25 materials for that mat_cat
  const handleOverallCategoryClick = useCallback(
    async (cat) => {
      if (!month || !cat?.name) return;
      setDrillLoading(true);
      try {
        const mats = await fetchCategoryMaterialDrilldown(month, cat.name);
        setMaterialDrill({
          title: `${cat.name} — Top 25 Materials`,
          subtitle: `Overall · ${formatMonth(month)}`,
          materials: mats,
          showBusiness: false,
          showPlant: true,
        });
      } finally {
        setDrillLoading(false);
      }
    },
    [month]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-100 to-slate-100">
      <Navbar months={months} month={month} onMonthChange={setMonth} />

      <div className="p-6 space-y-6">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <DonutChart
                  mrp_auto={autoSplit.mrp_auto}
                  mrp_nonAuto={autoSplit.mrp_nonAuto}
                  non_mrp_auto={autoSplit.non_mrp_auto}
                  non_mrp_nonAuto={autoSplit.non_mrp_nonAuto}
                  totalStock={autoSplit.total_stock}
                  onSliceClick={handleBusTypeSlice}
                />
              </div>
              <div className="lg:col-span-1">
                <MaterialCategoryPie
                  data={matCategories}
                  onCategoryClick={handleOverallCategoryClick}
                />
              </div>
              <div className="lg:col-span-2">
                <BusinessBarChart
                  data={businesses}
                  onBarClick={handleBarClick}
                  busType={busType}
                  onBusTypeChange={setBusType}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <LineChartView data={trendData} mode="MRP" />
              <LineChartView data={trendData} mode="NONMRP" />
              <RegionBarChart data={regions} busType={busType} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlantTrendChart data={plantTrendData.trend} nameMap={plantTrendData.names} mode="MRP" />
              <PlantTrendChart data={plantTrendData.trend} nameMap={plantTrendData.names} mode="NONMRP" />
            </div>
          </>
        )}
      </div>

      {/* ChatButton and ChatPanel hidden */}
      {/* <ChatButton onClick={() => setChatOpen((o) => !o)} isOpen={chatOpen} /> */}
      {/* <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} /> */}

      {/* Business → category table + plants table */}
      {businessDrilldown && (
        <PieChartModal
          business={businessDrilldown.business}
          plants={businessDrilldown.plants}
          month={month}
          onClose={() => setBusinessDrilldown(null)}
        />
      )}

      {/* Auto/Non-Auto → category table */}
      {busTypeDrill && (
        <CategoryTableModal
          title={`${busTypeDrill.label} — Material Category Breakdown`}
          subtitle={`${formatMonth(month)} · Click a category for top 25 materials`}
          categories={busTypeDrill.categories}
          onCategoryClick={handleBusTypeCategoryClick}
          onClose={() => setBusTypeDrill(null)}
          zIndex={60}
        />
      )}

      {/* Top 25 materials popup — used by all flows */}
      {materialDrill && (
        <MaterialTableModal
          title={materialDrill.title}
          subtitle={materialDrill.subtitle}
          materials={materialDrill.materials}
          showBusiness={materialDrill.showBusiness}
          showPlant={materialDrill.showPlant}
          onClose={() => setMaterialDrill(null)}
          zIndex={80}
        />
      )}

      {drillLoading && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-4 border-white/70 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
