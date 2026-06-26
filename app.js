// Sub-National Fiscal Analytics Dashboard JS Engine
// Handles: Theme toggle, State selector population, Tab swapping, Summary card calculations, and interactive Chart.js visualization redrawing.

document.addEventListener("DOMContentLoaded", () => {
  // --- State Variables ---
  let activeStateId = "MH"; // Default to Maharashtra
  let activeTab = "deficit"; // Default tab
  let charts = {}; // Cache to hold Chart.js instances
  let currentSortColumn = "state"; // Default sort column for comparison table
  let currentSortAsc = true; // Default sort order
  let isVibrantHeatmap = false; // Toggle for heatmap style

  // --- Dynamic Column Re-ordering State ---
  let columnOrder = [
    "state",
    "gsdp_absolute",
    "total_budget",
    "budget_gsdp",
    "total_revenue",
    "revenue_gsdp",
    "gsdp_growth",
    "fiscal_deficit",
    "fiscal_deficit_abs",
    "revenue_deficit",
    "revenue_deficit_abs",
    "capital_outlay",
    "capital_outlay_abs",
    "debt_gsdp",
    "pc_gsdp",
    "pc_debt",
    "central_transfers",
    "central_transfers_abs",
    "borrowing_spread"
  ];

  // Try to load column order from session storage
  const savedOrder = sessionStorage.getItem("column_order");
  if (savedOrder) {
    try {
      const parsed = JSON.parse(savedOrder);
      if (Array.isArray(parsed) && parsed.length > 0) {
        columnOrder = parsed;
        // Verify we have all columns (in case of updates)
        const allCols = ["state", "gsdp_absolute", "total_budget", "budget_gsdp", "total_revenue", "revenue_gsdp", "gsdp_growth", "fiscal_deficit", "fiscal_deficit_abs", "revenue_deficit", "revenue_deficit_abs", "capital_outlay", "capital_outlay_abs", "debt_gsdp", "pc_gsdp", "pc_debt", "central_transfers", "central_transfers_abs", "borrowing_spread"];
        allCols.forEach(c => {
          if (!columnOrder.includes(c)) columnOrder.push(c);
        });
      }
    } catch (e) {
      console.error("Failed to parse saved column order:", e);
    }
  }

  const columnMetadata = {
    state: { label: "State" },
    gsdp_absolute: { label: "GSDP (₹ Bn)" },
    total_budget: { label: "Total Budget (₹ Bn)" },
    budget_gsdp: { label: "Total Budget (% GSDP)" },
    total_revenue: { label: "Total Revenue (₹ Bn)" },
    revenue_gsdp: { label: "Total Revenue (% GSDP)" },
    gsdp_growth: { label: "GSDP Growth (%)" },
    fiscal_deficit: { label: "Fiscal Deficit (% GSDP)" },
    fiscal_deficit_abs: { label: "Fiscal Deficit (₹ Bn)" },
    revenue_deficit: { label: "Revenue Balance (% GSDP)" },
    revenue_deficit_abs: { label: "Revenue Balance (₹ Bn)" },
    capital_outlay: { label: "Capital Outlay (% GSDP)" },
    capital_outlay_abs: { label: "Capital Outlay (₹ Bn)" },
    debt_gsdp: { label: "Outstanding Debt (% GSDP)" },
    pc_gsdp: { label: "Per Capita GSDP" },
    pc_debt: { label: "Per Capita Debt" },
    central_transfers: { label: "Central Transfers (% Revenue)" },
    central_transfers_abs: { label: "Central Transfers (₹ Bn)" },
    borrowing_spread: { label: "SDL Spread (bps)" }
  };

  // --- DOM Elements ---
  const stateSelector = document.getElementById("state-selector");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const navItems = document.querySelectorAll(".nav-item");
  const tabViews = document.querySelectorAll(".tab-view");
  
  // Profile Info Elements
  const profileStateName = document.getElementById("profile-state-name");
  const profileRegion = document.getElementById("profile-region");
  const profileCapital = document.getElementById("profile-capital");
  const profileBorrowCost = document.getElementById("profile-borrow-cost");
  const profileSpread = document.getElementById("profile-spread");

  // Summary Strip Metric Cards
  const mFiscalDeficit = document.getElementById("m-fiscal-deficit");
  const tFiscalDeficit = document.getElementById("t-fiscal-deficit");
  const mRevenueDeficit = document.getElementById("m-revenue-deficit");
  const tRevenueDeficit = document.getElementById("t-revenue-deficit");
  const mCapitalOutlay = document.getElementById("m-capital-outlay");
  const tCapitalOutlay = document.getElementById("t-capital-outlay");
  const mDebtRatio = document.getElementById("m-debt-ratio");
  const tDebtRatio = document.getElementById("t-debt-ratio");

  // Comparison Selector Elements
  const compareMetricSelect = document.getElementById("compare-metric-select");
  const compareYearSelect = document.getElementById("compare-year-select");
  const compareChartTitle = document.getElementById("compare-chart-title");

  // --- Initializer ---
  function init() {
    // 1. Populate State selector dropdown
    fiscalData.states.forEach(state => {
      const option = document.createElement("option");
      option.value = state.id;
      option.textContent = state.name;
      stateSelector.appendChild(option);
    });
    stateSelector.value = activeStateId;

    // 2. Populate Years in Comparison Dropdown
    fiscalData.years.forEach((yr, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = yr;
      compareYearSelect.appendChild(option);
    });
    compareYearSelect.value = fiscalData.years.length - 1; // Default to latest

    // Populate 3D Year Selector
    const threedYearSelect = document.getElementById("3d-year-select");
    fiscalData.years.forEach((yr, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = yr;
      threedYearSelect.appendChild(option);
    });
    threedYearSelect.value = fiscalData.years.length - 1; // Default to latest

    // 2.5 Initialize comparison table headers dynamically
    renderTableHeader();

    // 3. Initialize Sidebar profile
    updateSidebarProfile(activeStateId);

    // 4. Initialize Highlights Cards
    updateSummaryStrip(activeStateId);

    // 5. Draw active tab charts
    renderActiveTabCharts();

    // 6. Bind Events
    bindEvents();
  }

  // --- Event Listeners Bindings ---
  function bindEvents() {
    // State Selection Changed
    stateSelector.addEventListener("change", (e) => {
      activeStateId = e.target.value;
      updateSidebarProfile(activeStateId);
      updateSummaryStrip(activeStateId);
      renderActiveTabCharts();
    });

    // Tab Navigation Item Clicked
    navItems.forEach(item => {
      item.addEventListener("click", () => {
        navItems.forEach(nav => nav.classList.remove("active"));
        item.classList.add("active");
        
        activeTab = item.getAttribute("data-tab");
        
        tabViews.forEach(view => {
          view.classList.remove("active");
          if (view.id === `tab-${activeTab}`) {
            view.classList.add("active");
          }
        });

        renderActiveTabCharts();
      });
    });

    // Theme Toggle Clicked
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", newTheme);
      
      // Re-render active charts with updated theme colors
      destroyAllCharts();
      renderActiveTabCharts();
    });

    // Comparison Selector Changed
    compareMetricSelect.addEventListener("change", () => {
      renderComparisonTab();
    });
    compareYearSelect.addEventListener("change", () => {
      renderComparisonTab();
    });

    // Toggle Heatmap style
    const toggleHeatmapBtn = document.getElementById("toggle-heatmap-style");
    if (toggleHeatmapBtn) {
      toggleHeatmapBtn.addEventListener("click", () => {
        isVibrantHeatmap = !isVibrantHeatmap;
        const label = document.getElementById("toggle-heatmap-label");
        if (label) {
          label.textContent = isVibrantHeatmap ? "Subtle Heatmap" : "Vibrant Heatmap";
        }
        if (isVibrantHeatmap) {
          toggleHeatmapBtn.style.background = "var(--accent-color)";
          toggleHeatmapBtn.style.color = "var(--color-bg, #0f172a)";
          toggleHeatmapBtn.style.borderColor = "var(--accent-color)";
        } else {
          toggleHeatmapBtn.style.background = "rgba(99, 102, 241, 0.15)";
          toggleHeatmapBtn.style.color = "var(--accent-color)";
          toggleHeatmapBtn.style.borderColor = "rgba(99, 102, 241, 0.3)";
        }
        renderComparisonTab();
      });
    }

    // 3D Selector Changed
    const threedSelects = ["3d-year-select", "3d-x-select", "3d-y-select", "3d-z-select"];
    threedSelects.forEach(id => {
      document.getElementById(id).addEventListener("change", () => {
        if (activeTab === "threed") renderThreeDTab();
      });
    });

    // Sortable header click and drag bindings are now dynamically managed inside renderTableHeader()
  }

  // --- Helper Methods ---

  // Get active theme style settings
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      gridColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)",
      textColor: isDark ? "#94a3b8" : "#475569",
      tooltipBg: isDark ? "#1e293b" : "#ffffff",
      tooltipBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)",
      tooltipText: isDark ? "#f8fafc" : "#0f172a"
    };
  }

  // Update Left Sidebar State Profile info
  function updateSidebarProfile(stateId) {
    const state = fiscalData.states.find(s => s.id === stateId);
    if (!state) return;
    profileStateName.textContent = state.name;
    profileRegion.textContent = `${state.region} India`;
    profileCapital.textContent = state.capital;
    
    const latestIdx = fiscalData.years.length - 1;

    // Borrow cost info
    const yieldCost = fiscalData.sdl_yields[stateId];
    const spreadBps = fiscalData.metrics.borrowing_spread[stateId][latestIdx]; // Latest year spread
    
    profileBorrowCost.textContent = `${yieldCost.toFixed(2)}%`;
    profileSpread.textContent = `+${spreadBps} bps vs G-Sec`;

    // Debt to own tax revenue ratio (latest year FY25 BE)
    const latestDebt = fiscalData.metrics.debt_gsdp[stateId][latestIdx];
    const latestOwnTax = fiscalData.metrics.own_tax_gsdp[stateId][latestIdx];
    const debtOwnTaxRatio = latestDebt / latestOwnTax;
    
    document.getElementById("profile-debt-own-revenue").textContent = `${debtOwnTaxRatio.toFixed(2)}x`;

    // Per Capita GSDP and Per Capita Debt (latest year FY25 BE)
    const latestPcGsdp = fiscalData.metrics.pc_gsdp[stateId][latestIdx];
    const latestPcDebt = (latestDebt / 100.0) * latestPcGsdp;

    document.getElementById("profile-pc-gsdp").textContent = `₹${latestPcGsdp.toLocaleString('en-US')}`;
    document.getElementById("profile-pc-debt").textContent = `₹${Math.round(latestPcDebt).toLocaleString('en-US')}`;

    // Absolute GSDP, Budget, and Growth Rate (latest year FY25 BE)
    const latestGsdp = fiscalData.metrics.gsdp_absolute[stateId][latestIdx];
    const latestBudget = fiscalData.metrics.total_budget[stateId][latestIdx];
    const latestGrowth = fiscalData.metrics.gsdp_growth[stateId][latestIdx];

    // Absolute deficits/outlay
    const latestFD = getMetricValue(stateId, "fiscal_deficit_abs", latestIdx);
    const latestRD = getMetricValue(stateId, "revenue_deficit_abs", latestIdx);
    const latestCO = getMetricValue(stateId, "capital_outlay_abs", latestIdx);

    document.getElementById("profile-gsdp-abs").textContent = formatMetricValue(latestGsdp, "gsdp_absolute");
    document.getElementById("profile-budget-abs").textContent = formatMetricValue(latestBudget, "total_budget");
    document.getElementById("profile-gsdp-growth").textContent = `${latestGrowth.toFixed(1)}%`;

    document.getElementById("profile-fiscal-deficit-abs").textContent = formatMetricValue(latestFD, "fiscal_deficit_abs");
    document.getElementById("profile-revenue-deficit-abs").textContent = formatMetricValue(latestRD, "revenue_deficit_abs");
    document.getElementById("profile-capital-outlay-abs").textContent = formatMetricValue(latestCO, "capital_outlay_abs");

    const latestCT = getMetricValue(stateId, "central_transfers_abs", latestIdx);
    document.getElementById("profile-central-transfers-abs").textContent = formatMetricValue(latestCT, "central_transfers_abs");
  }

  // Update Summary Metrics Card Highlights
  function updateSummaryStrip(stateId) {
    const latestIdx = fiscalData.years.length - 1;
    const prevIdx = latestIdx - 1;

    // Get current and previous values
    const fdCurr = fiscalData.metrics.fiscal_deficit[stateId][latestIdx];
    const fdPrev = fiscalData.metrics.fiscal_deficit[stateId][prevIdx];
    
    const rdCurr = fiscalData.metrics.revenue_deficit[stateId][latestIdx];
    const rdPrev = fiscalData.metrics.revenue_deficit[stateId][prevIdx];
    
    const coCurr = fiscalData.metrics.capital_outlay[stateId][latestIdx];
    const coPrev = fiscalData.metrics.capital_outlay[stateId][prevIdx];
    
    const debtCurr = fiscalData.metrics.debt_gsdp[stateId][latestIdx];
    const debtPrev = fiscalData.metrics.debt_gsdp[stateId][prevIdx];

    // Card 1: Fiscal Deficit
    mFiscalDeficit.textContent = `${fdCurr.toFixed(1)}%`;
    setTrendLabel(tFiscalDeficit, fdCurr - fdPrev, "deficit");

    // Card 2: Revenue Deficit/Surplus (handle positive surplus vs negative deficit)
    if (rdCurr >= 0) {
      mRevenueDeficit.textContent = `+${rdCurr.toFixed(1)}%`;
      mRevenueDeficit.style.color = "var(--color-capex)";
      setTrendLabel(tRevenueDeficit, rdCurr - rdPrev, "surplus");
    } else {
      mRevenueDeficit.textContent = `${rdCurr.toFixed(1)}%`;
      mRevenueDeficit.style.color = "var(--color-revenue)";
      setTrendLabel(tRevenueDeficit, rdCurr - rdPrev, "deficit");
    }

    // Card 3: Capital Outlay
    mCapitalOutlay.textContent = `${coCurr.toFixed(1)}%`;
    setTrendLabel(tCapitalOutlay, coCurr - coPrev, "outlay");

    // Card 4: Debt GSDP Ratio
    mDebtRatio.textContent = `${debtCurr.toFixed(1)}%`;
    setTrendLabel(tDebtRatio, debtCurr - debtPrev, "debt");
  }

  // Render metric card trend sub-labels
  function setTrendLabel(elem, diff, type) {
    elem.className = "card-trend";
    if (diff > 0.05) {
      if (type === "deficit" || type === "debt") {
        elem.classList.add("trend-up");
        elem.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${diff.toFixed(2)}% (Worsening)`;
      } else {
        elem.classList.add("trend-down"); // Green for higher surplus or outlay
        elem.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${diff.toFixed(2)}% (Improving)`;
      }
    } else if (diff < -0.05) {
      const absDiff = Math.abs(diff);
      if (type === "deficit" || type === "debt") {
        elem.classList.add("trend-down"); // Green for lower deficit or debt
        elem.innerHTML = `<i class="fa-solid fa-caret-down"></i> -${absDiff.toFixed(2)}% (Improving)`;
      } else {
        elem.classList.add("trend-up"); // Red for lower surplus or outlay
        elem.innerHTML = `<i class="fa-solid fa-caret-down"></i> -${absDiff.toFixed(2)}% (Worsening)`;
      }
    } else {
      elem.classList.add("trend-stable");
      elem.innerHTML = `<i class="fa-solid fa-minus"></i> Stable (vs prev year)`;
    }
  }

  // Destroy all cached chart instances
  function destroyAllCharts() {
    Object.keys(charts).forEach(key => {
      if (charts[key]) {
        charts[key].destroy();
        charts[key] = null;
      }
    });
  }

  // --- Dynamic Tab Render Engine ---
  function renderActiveTabCharts() {
    const t = getThemeColors();
    Chart.defaults.color = t.textColor;
    Chart.defaults.font.family = "'Inter', sans-serif";

    if (activeTab === "deficit") {
      renderDeficitTab(t);
    } else if (activeTab === "sustainability") {
      renderSustainabilityTab(t);
    } else if (activeTab === "revenue") {
      renderRevenueTab(t);
    } else if (activeTab === "expenditure") {
      renderExpenditureTab(t);
    } else if (activeTab === "comparison") {
      renderComparisonTab();
    } else if (activeTab === "threed") {
      renderThreeDTab();
    }
  }

  // --- Render Deficit Tab Charts ---
  function renderDeficitTab(t) {
    const ctx = document.getElementById("chart-deficit-decomposition").getContext("2d");
    
    // Destroy previous chart
    if (charts["deficit"]) charts["deficit"].destroy();

    const gfdData = fiscalData.metrics.fiscal_deficit[activeStateId];
    const rdData = fiscalData.metrics.revenue_deficit[activeStateId];
    const capexData = fiscalData.metrics.capital_outlay[activeStateId];

    charts["deficit"] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: fiscalData.years,
        datasets: [
          {
            label: "Gross Fiscal Deficit (GFD)",
            data: gfdData,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgba(59, 130, 246, 1)",
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: "Revenue Deficit/Surplus (RD)",
            data: rdData,
            backgroundColor: rdData.map(v => v >= 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.6)"),
            borderColor: rdData.map(v => v >= 0 ? "rgba(16, 185, 129, 1)" : "rgba(245, 158, 11, 1)"),
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: "Capital Outlay (Capex)",
            data: capexData,
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: t.gridColor },
            ticks: { font: { weight: 500 } }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "% of GSDP",
              font: { family: "'Outfit', sans-serif", size: 12, weight: 600 }
            }
          }
        },
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 12, font: { weight: 500 } }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });
  }

  // --- Render Sustainability Tab Charts ---
  function renderSustainabilityTab(t) {
    // Chart 1: Debt Ratio vs Interest to Revenue Receipts
    const ctxDebt = document.getElementById("chart-debt-trends").getContext("2d");
    if (charts["debt"]) charts["debt"].destroy();

    const debtData = fiscalData.metrics.debt_gsdp[activeStateId];
    const interestData = fiscalData.metrics.interest_revenue[activeStateId];

    charts["debt"] = new Chart(ctxDebt, {
      type: "line",
      data: {
        labels: fiscalData.years,
        datasets: [
          {
            label: "Outstanding Debt (% of GSDP)",
            data: debtData,
            borderColor: "rgba(139, 92, 246, 1)",
            backgroundColor: "rgba(139, 92, 246, 0.1)",
            borderWidth: 3,
            yAxisID: "y-debt",
            tension: 0.3,
            fill: true,
            pointBackgroundColor: "rgba(139, 92, 246, 1)"
          },
          {
            label: "Interest payments (% of Revenue Receipts)",
            data: interestData,
            borderColor: "rgba(59, 130, 246, 1)",
            backgroundColor: "transparent",
            borderWidth: 3,
            yAxisID: "y-interest",
            tension: 0.3,
            pointBackgroundColor: "rgba(59, 130, 246, 1)"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: t.gridColor } },
          "y-debt": {
            type: "linear",
            position: "left",
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Debt to GSDP Ratio (%)",
              font: { weight: 600 }
            }
          },
          "y-interest": {
            type: "linear",
            position: "right",
            grid: { drawOnChartArea: false }, // Avoid duplicate gridlines
            title: {
              display: true,
              text: "Interest to Revenue Receipts (%)",
              font: { weight: 600 }
            }
          }
        },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12 } },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });

    // Chart 2: GSDP Growth vs Borrowing Cost (Growth-Interest Spread)
    const ctxSpread = document.getElementById("chart-growth-cost-spread").getContext("2d");
    if (charts["spread"]) charts["spread"].destroy();

    const growthData = fiscalData.metrics.gsdp_growth[activeStateId];
    const costData = fiscalData.metrics.effective_interest[activeStateId];

    charts["spread"] = new Chart(ctxSpread, {
      type: "bar",
      data: {
        labels: fiscalData.years,
        datasets: [
          {
            label: "Nominal GSDP Growth (%)",
            data: growthData,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgba(59, 130, 246, 1)",
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: "Effective Interest Cost (%)",
            data: costData,
            backgroundColor: "rgba(244, 63, 94, 0.7)",
            borderColor: "rgba(244, 63, 94, 1)",
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: t.gridColor } },
          y: {
            grid: { color: t.gridColor },
            title: { display: true, text: "Annual Rate (%)", font: { weight: 600 } }
          }
        },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12 } },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });
  }

  // --- Render Revenue Tab Charts ---
  function renderRevenueTab(t) {
    const ctxOwnTax = document.getElementById("chart-own-tax").getContext("2d");
    if (charts["owntax"]) charts["owntax"].destroy();

    const ownTaxData = fiscalData.metrics.own_tax_gsdp[activeStateId];

    charts["owntax"] = new Chart(ctxOwnTax, {
      type: "bar",
      data: {
        labels: fiscalData.years,
        datasets: [
          {
            label: "State's Own Tax Revenue (% of GSDP)",
            data: ownTaxData,
            backgroundColor: "rgba(139, 92, 246, 0.7)",
            borderColor: "rgba(139, 92, 246, 1)",
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: t.gridColor } },
          y: {
            grid: { color: t.gridColor },
            title: { display: true, text: "% of GSDP", font: { weight: 600 } },
            suggestedMax: 10
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });

    const ctxCentralTrans = document.getElementById("chart-central-transfers").getContext("2d");
    if (charts["centraltransfers"]) charts["centraltransfers"].destroy();

    const centralTransData = fiscalData.metrics.central_transfers[activeStateId];

    charts["centraltransfers"] = new Chart(ctxCentralTrans, {
      type: "line",
      data: {
        labels: fiscalData.years,
        datasets: [
          {
            label: "Federal Transfers Share (% of Revenue Receipts)",
            data: centralTransData,
            borderColor: "rgba(245, 158, 11, 1)",
            backgroundColor: "rgba(245, 158, 11, 0.1)",
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: "rgba(245, 158, 11, 1)"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: t.gridColor } },
          y: {
            grid: { color: t.gridColor },
            title: { display: true, text: "% of Revenue Receipts", font: { weight: 600 } },
            suggestedMax: 70
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });
  }

  // --- Render Expenditure Tab Charts ---
  function renderExpenditureTab(t) {
    // Chart 1: Committed vs Capital Outlay
    const ctxExp = document.getElementById("chart-committed-vs-capex").getContext("2d");
    if (charts["exp"]) charts["exp"].destroy();

    const committed = fiscalData.metrics.committed_exp[activeStateId];
    const capex = fiscalData.metrics.capital_outlay[activeStateId];

    charts["exp"] = new Chart(ctxExp, {
      type: "bar",
      data: {
        labels: fiscalData.years,
        datasets: [
          {
            label: "Committed Expenditures (% of Revenue Receipts) [Left Scale]",
            data: committed,
            backgroundColor: "rgba(245, 158, 11, 0.7)",
            borderColor: "rgba(245, 158, 11, 1)",
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: "y-committed"
          },
          {
            label: "Capital Outlay (% of GSDP) [Right Scale]",
            data: capex,
            backgroundColor: "rgba(16, 185, 129, 0.7)",
            borderColor: "rgba(16, 185, 129, 1)",
            borderWidth: 1.5,
            borderRadius: 4,
            yAxisID: "y-capex"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: t.gridColor } },
          "y-committed": {
            type: "linear",
            position: "left",
            grid: { color: t.gridColor },
            title: { display: true, text: "Committed Exp (% of Revenue)", font: { weight: 600 } }
          },
          "y-capex": {
            type: "linear",
            position: "right",
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Capital Outlay (% of GSDP)", font: { weight: 600 } }
          }
        },
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12 } },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });

    // Chart 2: Contingent Guarantees (2022-23 Cross-state)
    const ctxGuar = document.getElementById("chart-guarantees").getContext("2d");
    if (charts["guar"]) charts["guar"].destroy();

    // Map outstanding guarantees data for all states for 2022-23 (guarantees are reported for 2022-23 in the RBI report)
    const guaranteeDataList = fiscalData.states.map(s => {
      // Find outstanding guarantee values for 2022-23 (hardcoded from Figure 27 text mapping)
      // AP: 10.7%, TN: 7.7%, MH: 1.4%, TS: 3.8%, GJ: 0.1%, KA: 1.7%, UP: 15.1%, WB: 0.0%, HR: 2.3%
      const guars = { AP: 10.7, TN: 7.7, MH: 1.4, TS: 3.8, GJ: 0.1, KA: 1.7, UP: 15.1, WB: 0.0, HR: 2.3 };
      return guars[s.id] || 0.0;
    });

    charts["guar"] = new Chart(ctxGuar, {
      type: "bar",
      data: {
        labels: fiscalData.states.map(s => s.name),
        datasets: [
          {
            label: "Outstanding State Guarantees (% of GSDP, end-FY23)",
            data: guaranteeDataList,
            backgroundColor: fiscalData.states.map(s => s.id === activeStateId ? "rgba(99, 102, 241, 0.85)" : "rgba(255, 255, 255, 0.15)"),
            borderColor: fiscalData.states.map(s => s.id === activeStateId ? "rgba(99, 102, 241, 1)" : "rgba(255, 255, 255, 0.3)"),
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: t.gridColor } },
          y: {
            grid: { color: t.gridColor },
            title: { display: true, text: "% of GSDP", font: { weight: 600 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });
  }

  // --- Render Dynamic Draggable Table Headers ---
  function renderTableHeader() {
    const thead = document.querySelector("#states-comparison-table thead");
    if (!thead) return;
    thead.innerHTML = "";
    const tr = document.createElement("tr");

    columnOrder.forEach(key => {
      const meta = columnMetadata[key];
      const th = document.createElement("th");
      th.className = "sortable-header draggable-header";
      th.setAttribute("data-sort-key", key);
      th.setAttribute("draggable", "true");

      if (currentSortColumn === key) {
        th.classList.add(currentSortAsc ? "sorted-asc" : "sorted-desc");
      }

      th.innerHTML = `${meta.label} <i class="fa-solid ${currentSortColumn === key ? (currentSortAsc ? "fa-caret-up" : "fa-caret-down") : "fa-sort"}"></i>`;

      // Drag and Drop Listeners
      th.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", key);
        th.style.opacity = "0.4";
      });

      th.addEventListener("dragend", () => {
        th.style.opacity = "1";
      });

      th.addEventListener("dragover", (e) => {
        e.preventDefault();
        th.style.backgroundColor = "rgba(99, 102, 241, 0.15)";
      });

      th.addEventListener("dragleave", () => {
        th.style.backgroundColor = "";
      });

      th.addEventListener("drop", (e) => {
        e.preventDefault();
        th.style.backgroundColor = "";
        const draggedKey = e.dataTransfer.getData("text/plain");
        if (draggedKey && draggedKey !== key) {
          const fromIdx = columnOrder.indexOf(draggedKey);
          const toIdx = columnOrder.indexOf(key);
          if (fromIdx !== -1 && toIdx !== -1) {
            columnOrder.splice(fromIdx, 1);
            columnOrder.splice(toIdx, 0, draggedKey);
            sessionStorage.setItem("column_order", JSON.stringify(columnOrder));
            renderTableHeader();
            renderComparisonTab();
          }
        }
      });

      // Sorting click listener
      th.addEventListener("click", () => {
        if (currentSortColumn === key) {
          currentSortAsc = !currentSortAsc;
        } else {
          currentSortColumn = key;
          currentSortAsc = true;
        }
        renderTableHeader();
        renderComparisonTab();
      });

      tr.appendChild(th);
    });

    thead.appendChild(tr);
  }

  // --- Render Comparison Tab (Rankings & Data Grid) ---
  function renderComparisonTab() {
    const metricKey = compareMetricSelect.value;
    const yearIdx = parseInt(compareYearSelect.value);
    const yearStr = fiscalData.years[yearIdx];
    const t = getThemeColors();

    let metricMeta = getMetricMetadata(metricKey);
    let sortedStates = fiscalData.states.map(s => {
      const val = getMetricValue(s.id, metricKey, yearIdx);
      return {
        id: s.id,
        name: s.name,
        value: val,
        color: s.color
      };
    }).filter(s => s.value !== null && s.value !== undefined)
      .sort((a, b) => b.value - a.value);

    compareChartTitle.textContent = `${metricMeta.name} - ${yearStr} Rankings`;

    // 2. Render horizontal ranking chart
    const ctx = document.getElementById("chart-comparison").getContext("2d");
    if (charts["compare"]) charts["compare"].destroy();

    charts["compare"] = new Chart(ctx, {
      type: "bar",
      data: {
        labels: sortedStates.map(s => s.name),
        datasets: [
          {
            label: metricMeta.name,
            data: sortedStates.map(s => s.value),
            backgroundColor: sortedStates.map(s => s.id === activeStateId ? "rgba(99, 102, 241, 0.85)" : "rgba(255, 255, 255, 0.15)"),
            borderColor: sortedStates.map(s => s.id === activeStateId ? "rgba(99, 102, 241, 1)" : "rgba(255, 255, 255, 0.3)"),
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: "y", // Horizontal Bar chart
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: metricKey === "debt_own_tax" ? "Ratio (x)" : (metricKey === "pc_gsdp" || metricKey === "pc_debt" ? "Rupees (₹)" : (metricKey === "fiscal_deficit_abs" || metricKey === "revenue_deficit_abs" || metricKey === "capital_outlay_abs" || metricKey === "central_transfers_abs" || metricKey === "gsdp_absolute" || metricKey === "total_budget" ? "Rupees Billion (₹ Bn)" : "Percentage (%)")),
              font: { weight: 600 }
            },
            ticks: {
              callback: function(value) {
                return formatMetricValue(value, metricKey);
              }
            }
          },
          y: {
            grid: { color: t.gridColor },
            ticks: { font: { weight: 500 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const val = context.raw;
                return ` ${metricMeta.name}: ${formatMetricValue(val, metricKey)}`;
              }
            }
          }
        }
      }
    });

    // 3. Build Comparison Grid Table
    const tableBody = document.querySelector("#states-comparison-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    // Prepare table data dynamically
    const tableData = fiscalData.states.map(s => {
      const pc_gsdp_val = fiscalData.metrics.pc_gsdp[s.id][yearIdx];
      const debt_pct = fiscalData.metrics.debt_gsdp[s.id][yearIdx];
      const pc_debt_val = (pc_gsdp_val === null || debt_pct === null) ? null : (debt_pct / 100.0) * pc_gsdp_val;
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        gsdp_absolute: fiscalData.metrics.gsdp_absolute[s.id][yearIdx],
        total_budget: fiscalData.metrics.total_budget[s.id][yearIdx],
        gsdp_growth: fiscalData.metrics.gsdp_growth[s.id][yearIdx],
        fiscal_deficit: fiscalData.metrics.fiscal_deficit[s.id][yearIdx],
        fiscal_deficit_abs: getMetricValue(s.id, 'fiscal_deficit_abs', yearIdx),
        revenue_deficit: fiscalData.metrics.revenue_deficit[s.id][yearIdx],
        revenue_deficit_abs: getMetricValue(s.id, 'revenue_deficit_abs', yearIdx),
        capital_outlay: fiscalData.metrics.capital_outlay[s.id][yearIdx],
        capital_outlay_abs: getMetricValue(s.id, 'capital_outlay_abs', yearIdx),
        debt_gsdp: debt_pct,
        pc_gsdp: pc_gsdp_val,
        pc_debt: pc_debt_val,
        central_transfers: fiscalData.metrics.central_transfers[s.id][yearIdx],
        central_transfers_abs: getMetricValue(s.id, 'central_transfers_abs', yearIdx),
        borrowing_spread: fiscalData.metrics.borrowing_spread[s.id][yearIdx]
      };
    });

    // Sort table data based on selected column & direction
    tableData.sort((a, b) => {
      let valA = currentSortColumn === "state" ? a.name : a[currentSortColumn];
      let valB = currentSortColumn === "state" ? b.name : b[currentSortColumn];
 
      const aNull = valA === null || valA === undefined;
      const bNull = valB === null || valB === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
 
      if (typeof valA === "string") {
        return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return currentSortAsc ? valA - valB : valB - valA;
      }
    });

    // Pre-calculate column values for percentile ranking
    const columnValuesCache = {};
    const metricsToRank = [
      "gsdp_absolute",
      "total_budget",
      "gsdp_growth",
      "fiscal_deficit",
      "fiscal_deficit_abs",
      "revenue_deficit",
      "revenue_deficit_abs",
      "capital_outlay",
      "capital_outlay_abs",
      "debt_gsdp",
      "pc_gsdp",
      "pc_debt",
      "central_transfers",
      "central_transfers_abs",
      "borrowing_spread"
    ];

    metricsToRank.forEach(key => {
      let vals = fiscalData.states.map(s => {
        return getMetricValue(s.id, key, yearIdx);
      }).filter(v => v !== null && v !== undefined);

      const lowerIsBetterMetrics = [
        "fiscal_deficit",
        "fiscal_deficit_abs",
        "debt_gsdp",
        "pc_debt",
        "central_transfers",
        "central_transfers_abs",
        "borrowing_spread"
      ];
      const isLowerBetter = lowerIsBetterMetrics.includes(key);
      vals.sort((a, b) => isLowerBetter ? b - a : a - b);
      columnValuesCache[key] = vals;
    });

    // Helper for scorecard heatmap coloring
    function getCellFormatting(value, metricType) {
      if (value === null || value === undefined) {
        return `style="background-color: transparent; font-weight: 500; color: var(--text-secondary);"`;
      }
      const vals = columnValuesCache[metricType];
      if (!vals || vals.length === 0) {
        return `style="background-color: transparent; font-weight: 500;"`;
      }
      
      let p = 0.5;
      if (vals.length > 1) {
        const idx = vals.indexOf(value);
        if (idx !== -1) {
          p = idx / (vals.length - 1);
        }
      }

      let r, g, b;
      if (p > 0.5) {
        const t = (p - 0.5) / 0.5;
        r = Math.round((1 - t) * 245 + t * 16);
        g = Math.round((1 - t) * 158 + t * 185);
        b = Math.round((1 - t) * 11 + t * 129);
      } else {
        const t = p / 0.5;
        r = Math.round((1 - t) * 244 + t * 245);
        g = Math.round((1 - t) * 63 + t * 158);
        b = Math.round((1 - t) * 94 + t * 11);
      }

      const minOpacity = isVibrantHeatmap ? 0.14 : 0.04;
      const maxOpacity = isVibrantHeatmap ? 0.38 : 0.12;
      const dist = Math.abs(p - 0.5) * 2;
      const opacity = minOpacity + dist * (maxOpacity - minOpacity);

      return `style="background-color: rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)}); font-weight: 500;"`;
    }

    function formatCellText(val, metricType) {
      return formatMetricValue(val, metricType);
    }

    // Render table data rows dynamically based on columnOrder
    tableData.forEach(rowItem => {
      const row = document.createElement("tr");
      if (rowItem.id === activeStateId) {
        row.style.background = "rgba(99, 102, 241, 0.08)";
        row.style.fontWeight = "600";
      }

      let rowHtml = "";
      columnOrder.forEach(key => {
        if (key === "state") {
          rowHtml += `
            <td style="font-weight: 600;">
              <span class="state-bullet" style="background: ${rowItem.color}"></span>
              ${rowItem.name}
            </td>
          `;
        } else {
          rowHtml += `<td ${getCellFormatting(rowItem[key], key)}>${formatCellText(rowItem[key], key)}</td>`;
        }
      });

      row.innerHTML = rowHtml;
      tableBody.appendChild(row);
    });
  }

  // --- Render 3D Fiscal Space Analysis Tab ---
  function renderThreeDTab() {
    const yearIdx = parseInt(document.getElementById("3d-year-select").value);
    const xKey = document.getElementById("3d-x-select").value;
    const yKey = document.getElementById("3d-y-select").value;
    const zKey = document.getElementById("3d-z-select").value;

    const xMeta = getMetricMetadata(xKey);
    const yMeta = getMetricMetadata(yKey);
    const zMeta = getMetricMetadata(zKey);

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    // Build data arrays for Plotly
    const xData = [];
    const yData = [];
    const zData = [];
    const textLabels = [];
    const colors = [];
    const stateNames = [];

    fiscalData.states.forEach(s => {
      const xVal = getMetricValue(s.id, xKey, yearIdx);
      const yVal = getMetricValue(s.id, yKey, yearIdx);
      const zVal = getMetricValue(s.id, zKey, yearIdx);

      if (xVal === null || yVal === null || zVal === null || xVal === undefined || yVal === undefined || zVal === undefined) {
        return;
      }

      xData.push(xVal);
      yData.push(yVal);
      zData.push(zVal);
      textLabels.push(`<b>${s.name}</b><br>${xMeta.name}: ${formatMetricValue(xVal, xKey)}<br>${yMeta.name}: ${formatMetricValue(yVal, yKey)}<br>${zMeta.name}: ${formatMetricValue(zVal, zKey)}`);
      colors.push(s.color);
      stateNames.push(s.name);
    });

    const trace = {
      x: xData,
      y: yData,
      z: zData,
      mode: 'markers+text',
      text: stateNames,
      textposition: 'top center',
      type: 'scatter3d',
      marker: {
        size: 14,
        color: colors,
        opacity: 0.85,
        line: {
          color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.3)',
          width: 1
        }
      },
      hoverinfo: 'text',
      hovertext: textLabels
    };

    const layout = {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: {
          title: { text: xMeta.shortName, font: { size: 11, color: isDark ? '#94a3b8' : '#475569' } },
          gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          backgroundcolor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.5)',
          showbackground: true,
          tickfont: { color: isDark ? '#64748b' : '#64748b' }
        },
        yaxis: {
          title: { text: yMeta.shortName, font: { size: 11, color: isDark ? '#94a3b8' : '#475569' } },
          gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          backgroundcolor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.5)',
          showbackground: true,
          tickfont: { color: isDark ? '#64748b' : '#64748b' }
        },
        zaxis: {
          title: { text: zMeta.shortName, font: { size: 11, color: isDark ? '#94a3b8' : '#475569' } },
          gridcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          backgroundcolor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.5)',
          showbackground: true,
          tickfont: { color: isDark ? '#64748b' : '#64748b' }
        },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.2 }
        }
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: {
        family: 'Outfit, sans-serif',
        color: isDark ? '#f8fafc' : '#0f172a'
      }
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['sendDataToCloud'],
      displaylogo: false
    };

    Plotly.newPlot('chart-3d-scatter', [trace], layout, config);
  }

  // Helper to fetch values/meta dynamically for calculated or compiled metrics
  function getMetricValue(stateId, key, yearIdx) {
    if (key === "debt_own_tax") {
      const debt = fiscalData.metrics.debt_gsdp[stateId][yearIdx];
      const ownTax = fiscalData.metrics.own_tax_gsdp[stateId][yearIdx];
      return debt / ownTax;
    }
    if (key === "pc_debt") {
      const debt = fiscalData.metrics.debt_gsdp[stateId][yearIdx];
      const pc_gsdp = fiscalData.metrics.pc_gsdp[stateId][yearIdx];
      return (debt / 100.0) * pc_gsdp;
    }
    if (key === "fiscal_deficit_abs") {
      const gsdp = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const pct = fiscalData.metrics.fiscal_deficit[stateId][yearIdx];
      return (gsdp === null || pct === null) ? null : (gsdp * pct) / 100.0;
    }
    if (key === "revenue_deficit_abs") {
      const gsdp = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const pct = fiscalData.metrics.revenue_deficit[stateId][yearIdx];
      return (gsdp === null || pct === null) ? null : (gsdp * pct) / 100.0;
    }
    if (key === "capital_outlay_abs") {
      const gsdp = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const pct = fiscalData.metrics.capital_outlay[stateId][yearIdx];
      return (gsdp === null || pct === null) ? null : (gsdp * pct) / 100.0;
    }
    if (key === "central_transfers_abs") {
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const ct_pct = fiscalData.metrics.central_transfers[stateId][yearIdx];
      if (budget === null || fd_abs === null || ct_pct === null) return null;
      const rev_receipts = budget - fd_abs;
      return (rev_receipts * ct_pct) / 100.0;
    }
    return fiscalData.metrics[key][stateId][yearIdx];
  }

  function getMetricMetadata(key) {
    if (key === "debt_own_tax") {
      return { name: "Debt to Own Tax Revenue (Ratio)", shortName: "Debt/Own Tax" };
    }
    if (key === "pc_debt") {
      return { name: "Per Capita Debt (Rupees)", shortName: "Per Capita Debt" };
    }
    if (key === "fiscal_deficit_abs") {
      return { name: "Gross Fiscal Deficit (Absolute) (Rupees Billion)", shortName: "Fiscal Deficit (Absolute)" };
    }
    if (key === "revenue_deficit_abs") {
      return { name: "Revenue Balance (Absolute) (Rupees Billion)", shortName: "Revenue Balance (Absolute)" };
    }
    if (key === "capital_outlay_abs") {
      return { name: "Capital Outlay (Absolute) (Rupees Billion)", shortName: "Capital Outlay (Absolute)" };
    }
    if (key === "central_transfers_abs") {
      return { name: "Federal Transfers (Absolute) (Rupees Billion)", shortName: "Federal Transfers (Absolute)" };
    }
    const names = {
      fiscal_deficit: "Gross Fiscal Deficit",
      fiscal_deficit_abs: "Fiscal Deficit (Absolute)",
      revenue_deficit: "Revenue Deficit",
      revenue_deficit_abs: "Revenue Balance (Absolute)",
      capital_outlay: "Capital Outlay",
      capital_outlay_abs: "Capital Outlay (Absolute)",
      debt_gsdp: "Outstanding Debt",
      own_tax_gsdp: "Own Tax Revenue",
      central_transfers: "Federal Transfers",
      central_transfers_abs: "Federal Transfers (Absolute)",
      committed_exp: "Committed Expenditure",
      pc_gsdp: "Per Capita GSDP",
      pc_debt: "Per Capita Debt",
      gsdp_absolute: "GSDP (Absolute)",
      total_budget: "Total Budget",
      gsdp_growth: "GSDP Growth"
    };
    return {
      name: fiscalData.metrics[key] ? fiscalData.metrics[key].name : (names[key] || "Metric"),
      shortName: names[key] || (fiscalData.metrics[key] ? fiscalData.metrics[key].name : "Metric")
    };
  }

  function formatMetricValue(value, key) {
    if (value === null || value === undefined) {
      return "N/A";
    }
    if (key === "debt_own_tax") {
      return `${value.toFixed(2)}x`;
    }
    if (key === "pc_gsdp" || key === "pc_debt") {
      return `₹${Math.round(value).toLocaleString('en-US')}`;
    }
    if (key === "gsdp_absolute" || key === "total_budget" || key === "fiscal_deficit_abs" || key === "revenue_deficit_abs" || key === "capital_outlay_abs" || key === "central_transfers_abs") {
      const bnVal = value / 100.0;
      const sign = bnVal < 0 ? "-" : "";
      return `${sign}₹${Math.abs(bnVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bn`;
    }
    if (key === "borrowing_spread") {
      return `+${value} bps`;
    }
    if (key === "revenue_deficit") {
      const prefix = value >= 0 ? "+" : "";
      return `${prefix}${value.toFixed(2)}%`;
    }
    return `${value.toFixed(2)}%`;
  }

  // Run initialization
  init();
});
