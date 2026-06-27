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
    "revenue_exp_abs",
    "revenue_exp_gsdp",
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
        parsed = parsed.filter(c => c !== "revenue_deficit" && c !== "revenue_deficit_abs");
        columnOrder = parsed;
        // Verify we have all columns (in case of updates)
        const allCols = ["state", "gsdp_absolute", "total_budget", "budget_gsdp", "total_revenue", "revenue_gsdp", "revenue_exp_abs", "revenue_exp_gsdp", "gsdp_growth", "fiscal_deficit", "fiscal_deficit_abs", "deficit_to_sotr", "capital_outlay", "capital_outlay_abs", "debt_gsdp", "pc_gsdp", "pc_debt", "central_transfers", "central_transfers_abs", "borrowing_spread", "direct_central_investment"];
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
    revenue_exp_abs: { label: "Revenue Exp (₹ Bn)" },
    revenue_exp_gsdp: { label: "Revenue Exp (% GSDP)" },
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


    // Populate Transfers Matrix Year Selector
    const transfersYearSelect = document.getElementById("transfers-year-select");
    if(transfersYearSelect) {
      fiscalData.years.forEach((yr, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = yr;
        transfersYearSelect.appendChild(option);
      });
      transfersYearSelect.value = fiscalData.years.length - 1;
    }

    // Populate Deficit Quality Matrix Year Selector
    const deficitYearSelect = document.getElementById("deficit-year-select");
    fiscalData.years.forEach((yr, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = yr;
      deficitYearSelect.appendChild(option);
    });
    deficitYearSelect.value = fiscalData.years.length - 1; // Default to latest

    // Populate Sustainability Matrix Year Selector
    const sustainabilityYearSelect = document.getElementById("sustainability-year-select");
    fiscalData.years.forEach((yr, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = yr;
      sustainabilityYearSelect.appendChild(option);
    });
    sustainabilityYearSelect.value = fiscalData.years.length - 1; // Default to latest

    // Populate Revenue Matrix Year Selector
    const revenueYearSelect = document.getElementById("revenue-year-select");
    fiscalData.years.forEach((yr, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = yr;
      revenueYearSelect.appendChild(option);
    });
    revenueYearSelect.value = fiscalData.years.length - 1; // Default to latest

    // Populate Expenditure Matrix Year Selector
    const expenditureYearSelect = document.getElementById("expenditure-year-select");
    fiscalData.years.forEach((yr, idx) => {
      const option = document.createElement("option");
      option.value = idx;
      option.textContent = yr;
      expenditureYearSelect.appendChild(option);
    });
    expenditureYearSelect.value = fiscalData.years.length - 1; // Default to latest

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


    // Transfers Tab Year Selection Changed
    const transfersYearSelect2 = document.getElementById("transfers-year-select");
    if(transfersYearSelect2) {
      transfersYearSelect2.addEventListener("change", () => {
        if (activeTab === "transfers") {
          renderTransfersTab(getThemeColors());
        }
      });
    }

    // Deficit Tab Year Selection Changed
    const deficitYearSelect = document.getElementById("deficit-year-select");
    deficitYearSelect.addEventListener("change", () => {
      if (activeTab === "deficit") {
        renderDeficitTab(getThemeColors());
      }
    });

    // Sustainability Tab Year Selection Changed
    const sustainabilityYearSelect = document.getElementById("sustainability-year-select");
    sustainabilityYearSelect.addEventListener("change", () => {
      if (activeTab === "sustainability") {
        renderSustainabilityTab(getThemeColors());
      }
    });

    // Revenue Tab Year Selection Changed
    const revenueYearSelect = document.getElementById("revenue-year-select");
    revenueYearSelect.addEventListener("change", () => {
      if (activeTab === "revenue") {
        renderRevenueTab(getThemeColors());
      }
    });

    // Expenditure Tab Year Selection Changed
    const expenditureYearSelect = document.getElementById("expenditure-year-select");
    expenditureYearSelect.addEventListener("change", () => {
      if (activeTab === "expenditure") {
        renderExpenditureTab(getThemeColors());
      }
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
      renderFiscalNavigator();
    });
    compareYearSelect.addEventListener("change", () => {
      renderComparisonTab();
      renderFiscalNavigator();
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
      // Use setTimeout so canvas has been laid out with correct dimensions
      setTimeout(() => renderFiscalNavigator(), 50);
    } else if (activeTab === "threed") {
      renderThreeDTab();
    }
  }

  // --- Render Deficit Tab Charts ---
  function renderDeficitTab(t) {
    const ctx = document.getElementById("chart-deficit-decomposition").getContext("2d");
    
    // Destroy previous chart
    if (charts["deficit"]) charts["deficit"].destroy();

    const yearIdx = parseInt(document.getElementById("deficit-year-select").value);
    
    const datasets = [];
    fiscalData.states.forEach(state => {
      const rd = fiscalData.metrics.revenue_deficit[state.id][yearIdx];
      const capex = fiscalData.metrics.capital_outlay[state.id][yearIdx];
      const gfd = fiscalData.metrics.fiscal_deficit[state.id][yearIdx];
      
      if (rd !== null && capex !== null && gfd !== null) {
        // Calculate bubble radius scaling
        const radius = Math.max(gfd * 5, 4); // Example: 3% GFD -> 15px radius
        
        datasets.push({
          label: state.name,
          data: [{
            x: rd, 
            y: capex, 
            r: radius,
            gfd: gfd // Store for tooltip
          }],
          backgroundColor: state.color + 'CC', // 80% opacity
          borderColor: state.color,
          borderWidth: 2,
          hoverBackgroundColor: state.color,
          hoverBorderWidth: 3,
          hoverRadius: radius + 2
        });
      }
    });

    charts["deficit"] = new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            right: 30,
            bottom: 10,
            left: 10
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: t.textColor,
              usePointStyle: true,
              boxWidth: 8,
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const stateName = context.dataset.label;
                const rd = context.raw.x.toFixed(2);
                const capex = context.raw.y.toFixed(2);
                const gfd = context.raw.gfd.toFixed(2);
                return `${stateName} | Rev Bal: ${rd}% | Capex: ${capex}% | GFD: ${gfd}%`;
              }
            }
          },
          annotation: {
            // Optional: You could use chartjs-plugin-annotation here if included, 
            // but we'll use native grid line styling instead.
          }
        },
        scales: {
          x: {
            grid: { 
              color: context => context.tick.value === 0 ? t.textColor : t.gridColor,
              lineWidth: context => context.tick.value === 0 ? 2 : 1,
              z: 1 // Draw above background but below points
            },
            title: {
              display: true,
              text: "Revenue Deficit (-) / Surplus (+)  (% of GSDP) (Better →)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Capital Outlay (% of GSDP) (Better ↑)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          }
        }
      }
    });

    // Chart 2: Deficit to SOTR (Bar)
    const ctxDefSotr = document.getElementById("chart-deficit-sotr").getContext("2d");
    if (charts["deficitSotr"]) charts["deficitSotr"].destroy();

    const defSotrData = [];
    const defSotrLabels = [];
    const defSotrColors = [];
    const defSotrBorderColors = [];
    
    // Sort states by deficit to sotr dependency
    const sortedStatesDef = [...fiscalData.states].sort((a, b) => {
        return getMetricValue(b.id, "deficit_to_sotr", yearIdx) - getMetricValue(a.id, "deficit_to_sotr", yearIdx);
    });

    sortedStatesDef.forEach(state => {
        const val = getMetricValue(state.id, "deficit_to_sotr", yearIdx);
        if (val !== null) {
            defSotrData.push(val);
            defSotrLabels.push(state.name);
            defSotrColors.push(state.color + 'CC');
            defSotrBorderColors.push(state.color);
        }
    });

    charts["deficitSotr"] = new Chart(ctxDefSotr, {
      type: "bar",
      data: {
        labels: defSotrLabels,
        datasets: [
          {
            label: "Own Revenue Deficit/Surplus (% of Own Revenue)",
            data: defSotrData,
            backgroundColor: defSotrColors,
            borderColor: defSotrBorderColors,
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
            grid: { display: false },
            ticks: { font: { weight: 500, size: 10 }, color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: { 
              display: true, 
              text: "% of Own Tax Revenue", 
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" } 
            },
            ticks: { color: t.textSecondary }
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
              label: (ctx) => `${ctx.raw.toFixed(1)}%`
            }
          }
        }
      }
    });

    // Chart 3: Direct Central Investment (Bar) with rich breakdown tooltip
    const ctxCentralInv = document.getElementById("chart-central-favoritism").getContext("2d");
    if (charts["centralInv"]) charts["centralInv"].destroy();

    const invData = [];
    const invLabels = [];
    const invColors = [];
    const invBorderColors = [];
    const invBreakdowns = []; // Per-bar breakdown details
    
    // Sort states by highest direct investment
    const sortedStatesInv = [...fiscalData.states].sort((a, b) => {
        return getMetricValue(b.id, "direct_central_investment", yearIdx) - getMetricValue(a.id, "direct_central_investment", yearIdx);
    });

    sortedStatesInv.forEach(state => {
        const val = getMetricValue(state.id, "direct_central_investment", yearIdx);
        if (val !== null) {
            invData.push(val);
            invLabels.push(state.name);
            invColors.push(state.color + 'CC');
            invBorderColors.push(state.color);
            // Store breakdown details for tooltip
            const bd = (window.centralInvestmentBreakdown && window.centralInvestmentBreakdown[state.id]) || null;
            invBreakdowns.push(bd ? {
              railways: bd.railways[yearIdx],
              nhai:     bd.nhai[yearIdx],
              css:      bd.css[yearIdx],
              grants:   bd.grants[yearIdx],
              notes:    bd.notes
            } : null);
        }
    });

    charts["centralInv"] = new Chart(ctxCentralInv, {
      type: "bar",
      data: {
        labels: invLabels,
        datasets: [
          {
            label: "Direct Central Investment (% of GSDP)",
            data: invData,
            backgroundColor: invColors,
            borderColor: invBorderColors,
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
            grid: { display: false },
            ticks: { font: { weight: 500, size: 10 }, color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: { 
              display: true, 
              text: "% of GSDP", 
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" } 
            },
            ticks: { color: t.textSecondary }
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
            padding: 12,
            titleFont: { size: 13, weight: 700 },
            bodyFont: { size: 11 },
            callbacks: {
              title: (items) => {
                const i = items[0].dataIndex;
                return `${invLabels[i]}  —  Total: ${invData[i].toFixed(1)}% of GSDP`;
              },
              label: () => null, // suppress default
              afterBody: (items) => {
                const i = items[0].dataIndex;
                const bd = invBreakdowns[i];
                if (!bd) return ["  (No breakdown available)"];
                const lines = [
                  "  ─────────────────────────────",
                  `  🚂 Railways Capital Works : ${bd.railways !== null ? bd.railways.toFixed(1) + "%" : "N/A"}`,
                  `  🛣️  NHAI / Road Projects   : ${bd.nhai !== null ? bd.nhai.toFixed(1) + "%" : "N/A"}`,
                  `  📋 Centrally Sp. Schemes  : ${bd.css !== null ? bd.css.toFixed(1) + "%" : "N/A"}`,
                  `  🏛️  Direct Grants & Others : ${bd.grants !== null ? bd.grants.toFixed(1) + "%" : "N/A"}`,
                  "  ─────────────────────────────",
                  `  📌 ${bd.notes}`
                ];
                return lines;
              }
            }
          }
        }
      }
    });
  }

  // --- Render Sustainability Tab Charts ---
  function renderSustainabilityTab(t) {
    // Chart 1: Debt Ratio vs Interest to Revenue Receipts (Bubble Chart)
    const ctxDebt = document.getElementById("chart-debt-trends").getContext("2d");
    if (charts["debt"]) charts["debt"].destroy();

    const yearIdx = parseInt(document.getElementById("sustainability-year-select").value);

    const bubbleDatasets = [];
    const spreadLabels = [];
    const spreadData = [];
    const spreadBgColors = [];
    const spreadBorderColors = [];

    fiscalData.states.forEach(state => {
      const debt = fiscalData.metrics.debt_gsdp[state.id][yearIdx];
      const interest = fiscalData.metrics.interest_revenue[state.id][yearIdx];
      
      const growth = fiscalData.metrics.gsdp_growth[state.id][yearIdx];
      const cost = fiscalData.metrics.effective_interest[state.id][yearIdx];

      // For Chart 1 (Bubble)
      if (debt !== null && interest !== null) {
        bubbleDatasets.push({
          label: state.name,
          data: [{
            x: interest, 
            y: debt, 
            r: 8 // Uniform size for simplicity, or could map to per capita debt
          }],
          backgroundColor: state.color + 'CC', 
          borderColor: state.color,
          borderWidth: 2,
          hoverBackgroundColor: state.color,
          hoverBorderWidth: 3,
          hoverRadius: 10
        });
      }

      // For Chart 2 (Bar - Spread)
      if (growth !== null && cost !== null) {
        const spread = growth - cost;
        spreadLabels.push(state.name);
        spreadData.push(spread);
        
        // Green if sustainable (>0), Red if unsustainable (<0)
        if (spread >= 0) {
          spreadBgColors.push('rgba(16, 185, 129, 0.7)'); // Emerald
          spreadBorderColors.push('rgba(16, 185, 129, 1)');
        } else {
          spreadBgColors.push('rgba(244, 63, 94, 0.7)'); // Rose
          spreadBorderColors.push('rgba(244, 63, 94, 1)');
        }
      }
    });

    charts["debt"] = new Chart(ctxDebt, {
      type: "bubble",
      data: {
        datasets: bubbleDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20, right: 30, bottom: 10, left: 10 }
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { color: t.textColor, usePointStyle: true, boxWidth: 8, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const stateName = context.dataset.label;
                const x = context.raw.x.toFixed(2);
                const y = context.raw.y.toFixed(2);
                return `${stateName} | Interest/Rev: ${x}% | Debt/GSDP: ${y}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Interest to Revenue Receipts (%) (← Better)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Debt to GSDP Ratio (%) (↓ Better)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          }
        }
      }
    });

    // Chart 2: Sustainability Spread (Bar Chart)
    const ctxSpread = document.getElementById("chart-growth-cost-spread").getContext("2d");
    if (charts["spread"]) charts["spread"].destroy();

    charts["spread"] = new Chart(ctxSpread, {
      type: "bar",
      data: {
        labels: spreadLabels,
        datasets: [
          {
            label: "Sustainability Spread (Growth - Interest)",
            data: spreadData,
            backgroundColor: spreadBgColors,
            borderColor: spreadBorderColors,
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
            grid: { display: false },
            ticks: { font: { weight: 500, size: 10 } }
          },
          y: {
            grid: { 
              color: context => context.tick.value === 0 ? t.textColor : t.gridColor,
              lineWidth: context => context.tick.value === 0 ? 2 : 1
            },
            title: { display: true, text: "Spread (%) (Better ↑)", font: { weight: 600 } }
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
                const val = context.raw.toFixed(2);
                return `Spread: ${val}%`;
              }
            }
          }
        }
      }
    });
  }

  // --- Render Revenue Tab Charts ---
  function renderRevenueTab(t) {
    // Chart 1: Fiscal Autonomy Matrix (Bubble Scatter)
    const ctxOwnTax = document.getElementById("chart-own-tax").getContext("2d");
    if (charts["owntax"]) charts["owntax"].destroy();

    const yearIdx = parseInt(document.getElementById("revenue-year-select").value);

    const bubbleDatasets = [];
    const barLabels = [];
    const barData = [];
    const barColors = [];
    const barBorderColors = [];

    fiscalData.states.forEach(state => {
      const ownTax = fiscalData.metrics.own_tax_gsdp[state.id][yearIdx];
      const transfers = fiscalData.metrics.central_transfers[state.id][yearIdx];
      
      // Bubble Chart
      if (ownTax !== null && transfers !== null) {
        bubbleDatasets.push({
          label: state.name,
          data: [{
            x: ownTax, 
            y: transfers, 
            r: 8 // Uniform bubble size
          }],
          backgroundColor: state.color + 'CC', 
          borderColor: state.color,
          borderWidth: 2,
          hoverBackgroundColor: state.color,
          hoverBorderWidth: 3,
          hoverRadius: 10
        });
      }

      // Bar Chart
      if (ownTax !== null) {
        barLabels.push(state.name);
        barData.push(ownTax);
        barColors.push(state.color + 'CC');
        barBorderColors.push(state.color);
      }
    });

    charts["owntax"] = new Chart(ctxOwnTax, {
      type: "bubble",
      data: {
        datasets: bubbleDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20, right: 30, bottom: 10, left: 10 }
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { color: t.textColor, usePointStyle: true, boxWidth: 8, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const stateName = context.dataset.label;
                const x = context.raw.x.toFixed(2);
                const y = context.raw.y.toFixed(2);
                return `${stateName} | Own Tax: ${x}% | Transfers: ${y}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Own Tax Revenue (% of GSDP) (Better →)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Federal Transfers (% of Revenue Receipts) (↓ Better)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          }
        }
      }
    });

    // Chart 2: Own Tax Mobilization (Bar Chart)
    const ctxCentralTrans = document.getElementById("chart-central-transfers").getContext("2d");
    if (charts["centraltransfers"]) charts["centraltransfers"].destroy();

    charts["centraltransfers"] = new Chart(ctxCentralTrans, {
      type: "bar",
      data: {
        labels: barLabels,
        datasets: [
          {
            label: "Own Tax Revenue (% of GSDP)",
            data: barData,
            backgroundColor: barColors,
            borderColor: barBorderColors,
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
            grid: { display: false },
            ticks: { font: { weight: 500, size: 10 } }
          },
          y: {
            grid: { color: t.gridColor },
            title: { display: true, text: "% of GSDP (Better ↑)", font: { weight: 600 } }
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
    // Chart 1: Expenditure Rigidity Matrix (Bubble Scatter)
    const ctxExp = document.getElementById("chart-committed-vs-capex").getContext("2d");
    if (charts["exp"]) charts["exp"].destroy();

    const yearIdx = parseInt(document.getElementById("expenditure-year-select").value);

    const bubbleDatasets = [];
    
    fiscalData.states.forEach(state => {
      const committed = fiscalData.metrics.committed_exp[state.id][yearIdx];
      const capex = fiscalData.metrics.capital_outlay[state.id][yearIdx];
      
      if (committed !== null && capex !== null) {
        bubbleDatasets.push({
          label: state.name,
          data: [{
            x: committed, 
            y: capex, 
            r: 8 // Uniform bubble size
          }],
          backgroundColor: state.color + 'CC', 
          borderColor: state.color,
          borderWidth: 2,
          hoverBackgroundColor: state.color,
          hoverBorderWidth: 3,
          hoverRadius: 10
        });
      }
    });

    charts["exp"] = new Chart(ctxExp, {
      type: "bubble",
      data: {
        datasets: bubbleDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 20, right: 30, bottom: 10, left: 10 }
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { color: t.textColor, usePointStyle: true, boxWidth: 8, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const stateName = context.dataset.label;
                const x = context.raw.x.toFixed(2);
                const y = context.raw.y.toFixed(2);
                return `${stateName} | Committed Exp: ${x}% | Capex: ${y}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Committed Expenditures (% of Revenue Receipts) (← Better)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Capital Outlay (% of GSDP) (Better ↑)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
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
            backgroundColor: fiscalData.states.map(s => s.color + 'CC'),
            borderColor: fiscalData.states.map(s => s.color),
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
            grid: { display: false },
            ticks: { font: { weight: 500, size: 10 } }
          },
          y: {
            grid: { color: t.gridColor },
            title: { display: true, text: "% of GSDP (↓ Better)", font: { weight: 600 } }
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
                const val = context.raw.toFixed(1);
                return `Guarantees: ${val}%`;
              }
            }
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
            backgroundColor: sortedStates.map(s => s.color + 'CC'),
            borderColor: sortedStates.map(s => s.color),
            borderWidth: s => s.id === activeStateId ? 2.5 : 1.5,
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
              text: metricKey === "debt_own_tax" ? "Ratio (x)" : (metricKey === "pc_gsdp" || metricKey === "pc_debt" ? "Rupees (₹)" : (metricKey === "fiscal_deficit_abs" || metricKey === "revenue_exp_abs" || metricKey === "capital_outlay_abs" || metricKey === "central_transfers_abs" || metricKey === "gsdp_absolute" || metricKey === "total_budget" || metricKey === "total_revenue" ? "Rupees Billion (₹ Bn)" : "Percentage (%)")),
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
        budget_gsdp: getMetricValue(s.id, 'budget_gsdp', yearIdx),
        total_revenue: getMetricValue(s.id, 'total_revenue', yearIdx),
        revenue_gsdp: getMetricValue(s.id, 'revenue_gsdp', yearIdx),
        gsdp_growth: fiscalData.metrics.gsdp_growth[s.id][yearIdx],
        fiscal_deficit: fiscalData.metrics.fiscal_deficit[s.id][yearIdx],
        fiscal_deficit_abs: getMetricValue(s.id, 'fiscal_deficit_abs', yearIdx),
        revenue_exp_abs: getMetricValue(s.id, 'revenue_exp_abs', yearIdx),
        revenue_exp_gsdp: getMetricValue(s.id, 'revenue_exp_gsdp', yearIdx),
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
      "budget_gsdp",
      "total_revenue",
      "revenue_gsdp",
      "gsdp_growth",
      "fiscal_deficit",
      "fiscal_deficit_abs",
      "deficit_to_sotr",
      "revenue_exp_abs",
      "revenue_exp_gsdp",
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
        "revenue_exp_abs",
        "revenue_exp_gsdp",
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
        row.style.background = rowItem.color + '18'; // 10% opacity of state color
        row.style.boxShadow = `inset 3px 0 0 ${rowItem.color}`;
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


  // --- Render Fiscal Navigator (Parallel Coordinates) ---
  function renderFiscalNavigator() {
    const canvas = document.getElementById("chart-fiscal-navigator");
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");

    const yearIdx = parseInt(document.getElementById("compare-year-select").value);
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    // All 18 scorecard columns as axes
    const axes = [
      { key: "gsdp_absolute",        label: "GSDP\n(₹ Bn)",            higherBetter: true  },
      { key: "total_budget",          label: "Total\nBudget (₹ Bn)",     higherBetter: true  },
      { key: "budget_gsdp",           label: "Budget\n% GSDP",           higherBetter: false },
      { key: "total_revenue",         label: "Revenue\n(₹ Bn)",           higherBetter: true  },
      { key: "revenue_gsdp",          label: "Revenue\n% GSDP",           higherBetter: true  },
      { key: "gsdp_growth",           label: "GSDP\nGrowth %",           higherBetter: true  },
      { key: "fiscal_deficit",        label: "Fiscal\nDeficit %",         higherBetter: false },
      { key: "fiscal_deficit_abs",    label: "Deficit\n(₹ Bn)",           higherBetter: false },
      { key: "revenue_exp_gsdp",      label: "Rev Exp\n% GSDP",           higherBetter: false },
      { key: "revenue_exp_abs",       label: "Rev Exp\n(₹ Bn)",           higherBetter: false },
      { key: "capital_outlay",        label: "Capex\n% GSDP",            higherBetter: true  },
      { key: "capital_outlay_abs",    label: "Capex\n(₹ Bn)",             higherBetter: true  },
      { key: "debt_gsdp",             label: "Debt\n% GSDP",             higherBetter: false },
      { key: "pc_gsdp",               label: "Per Cap\nGSDP (₹)",         higherBetter: true  },
      { key: "pc_debt",               label: "Per Cap\nDebt (₹)",          higherBetter: false },
      { key: "central_transfers",     label: "C.Transfers\n% Revenue",   higherBetter: false },
      { key: "central_transfers_abs", label: "C.Transfers\n(₹ Bn)",      higherBetter: false },
      { key: "borrowing_spread",      label: "SDL\nSpread bps",           higherBetter: false }
    ];

    // Collect data — allow some axes to be null and fill forward for resilience
    const stateData = fiscalData.states.map(state => {
      const vals = axes.map(a => {
        const v = getMetricValue(state.id, a.key, yearIdx);
        return (v === null || v === undefined) ? null : v;
      });
      return { id: state.id, name: state.name, color: state.color, vals };
    }).filter(s => s.vals.some(v => v !== null)); // show states with at least partial data

    // Compute min/max per axis for normalization (ignoring nulls)
    const mins = axes.map((_, i) => {
      const vs = stateData.map(s => s.vals[i]).filter(v => v !== null);
      return vs.length ? Math.min(...vs) : 0;
    });
    const maxs = axes.map((_, i) => {
      const vs = stateData.map(s => s.vals[i]).filter(v => v !== null);
      return vs.length ? Math.max(...vs) : 1;
    });

    // Normalize: returns 0-1 where 1 = visually "better"
    function normalizeVal(val, i) {
      if (val === null) return null;
      const range = maxs[i] - mins[i];
      if (range === 0) return 0.5;
      const raw = (val - mins[i]) / range;
      return axes[i].higherBetter ? raw : 1 - raw;
    }

    // Sizing — use the inner div (parent of canvas) which is 1700px wide
    const dpr = window.devicePixelRatio || 1;
    const innerDiv = canvas.parentElement;
    const W = innerDiv.offsetWidth || 1700;
    const H = innerDiv.offsetHeight || 380;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + "px";
    canvas.style.height = H + "px";
    ctx2d.scale(dpr, dpr);

    const padL = 30, padR = 30, padT = 44, padB = 55;
    const axisCount = axes.length;
    const axisSpacing = (W - padL - padR) / (axisCount - 1);
    const axisX = i => padL + i * axisSpacing;
    const yForVal = v => padT + (1 - v) * (H - padT - padB);

    ctx2d.clearRect(0, 0, W, H);

    // Draw axis lines
    for (let i = 0; i < axisCount; i++) {
      const x = axisX(i);
      ctx2d.beginPath();
      ctx2d.moveTo(x, padT);
      ctx2d.lineTo(x, H - padB);
      ctx2d.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();

      // Arrow tip at top (better direction)
      ctx2d.beginPath();
      ctx2d.moveTo(x - 5, padT + 10);
      ctx2d.lineTo(x, padT + 1);
      ctx2d.lineTo(x + 5, padT + 10);
      ctx2d.strokeStyle = "#10b981";
      ctx2d.lineWidth = 1.5;
      ctx2d.stroke();

      // Axis label
      const labelLines = axes[i].label.split("\n");
      ctx2d.fillStyle = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";
      ctx2d.font = "bold 10px 'Outfit', sans-serif";
      ctx2d.textAlign = "center";
      labelLines.forEach((line, li) => {
        ctx2d.fillText(line, x, H - padB + 14 + li * 13);
      });

      // Min / max labels
      ctx2d.font = "9px 'Outfit', sans-serif";
      ctx2d.fillStyle = "#10b981";
      ctx2d.fillText("Better ↑", x, padT - 5);
    }

    // Draw state lines (dim first pass)
    let hoveredState = null;

    function drawLines(highlightId) {
      ctx2d.clearRect(0, 0, W, H);

      // Redraw axes
      for (let i = 0; i < axisCount; i++) {
        const x = axisX(i);
        ctx2d.beginPath();
        ctx2d.moveTo(x, padT);
        ctx2d.lineTo(x, H - padB);
        ctx2d.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();

        ctx2d.beginPath();
        ctx2d.moveTo(x - 5, padT + 10);
        ctx2d.lineTo(x, padT + 1);
        ctx2d.lineTo(x + 5, padT + 10);
        ctx2d.strokeStyle = "#10b981";
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();

        const labelLines = axes[i].label.split("\n");
        ctx2d.fillStyle = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";
        ctx2d.font = "bold 10px 'Outfit', sans-serif";
        ctx2d.textAlign = "center";
        labelLines.forEach((line, li) => {
          ctx2d.fillText(line, x, H - padB + 14 + li * 13);
        });
        ctx2d.font = "9px 'Outfit', sans-serif";
        ctx2d.fillStyle = "#10b981";
        ctx2d.fillText("Better ↑", x, padT - 5);
      }

      // Draw non-highlighted states dimly first
      stateData.forEach(s => {
        if (s.id === highlightId) return;
        const pts = axes.map((_, i) => {
          const n = normalizeVal(s.vals[i], i);
          return n === null ? null : { x: axisX(i), y: yForVal(n) };
        });
        // Draw line segments between non-null points
        let penDown = false;
        ctx2d.beginPath();
        pts.forEach((pt, i) => {
          if (!pt) { penDown = false; return; }
          if (!penDown) { ctx2d.moveTo(pt.x, pt.y); penDown = true; }
          else {
            const prev = pts.slice(0, i).reverse().find(p => p);
            if (prev) {
              const cp1x = (prev.x + pt.x) / 2;
              ctx2d.bezierCurveTo(cp1x, prev.y, cp1x, pt.y, pt.x, pt.y);
            }
          }
        });
        ctx2d.strokeStyle = s.color + (highlightId ? "28" : "88");
        ctx2d.lineWidth = highlightId ? 1 : 1.8;
        ctx2d.stroke();

        // Dots at non-null axes
        pts.forEach(pt => {
          if (!pt) return;
          ctx2d.beginPath();
          ctx2d.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx2d.fillStyle = s.color + (highlightId ? "30" : "99");
          ctx2d.fill();
        });
      });

      // Draw highlighted state on top
      if (highlightId) {
        const s = stateData.find(s => s.id === highlightId);
        if (s) {
          const pts = axes.map((_, i) => {
            const n = normalizeVal(s.vals[i], i);
            return n === null ? null : { x: axisX(i), y: yForVal(n) };
          });

          // Glow pass — draw segments between non-null consecutive points
          ctx2d.shadowColor = s.color;
          ctx2d.shadowBlur = 12;
          let penDown = false;
          ctx2d.beginPath();
          pts.forEach((pt, i) => {
            if (!pt) { penDown = false; return; }
            if (!penDown) { ctx2d.moveTo(pt.x, pt.y); penDown = true; }
            else {
              const prev = pts.slice(0, i).reverse().find(p => p);
              if (prev) {
                const cp1x = (prev.x + pt.x) / 2;
                ctx2d.bezierCurveTo(cp1x, prev.y, cp1x, pt.y, pt.x, pt.y);
              }
            }
          });
          ctx2d.strokeStyle = s.color;
          ctx2d.lineWidth = 3;
          ctx2d.stroke();
          ctx2d.shadowBlur = 0;

          // Arrow markers mid-segment (only for adjacent non-null pairs)
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i+1];
            if (!a || !b) continue;
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            ctx2d.save();
            ctx2d.translate(midX, midY);
            ctx2d.rotate(angle);
            ctx2d.beginPath();
            ctx2d.moveTo(-6, -4);
            ctx2d.lineTo(0, 0);
            ctx2d.lineTo(-6, 4);
            ctx2d.strokeStyle = s.color;
            ctx2d.lineWidth = 2;
            ctx2d.stroke();
            ctx2d.restore();
          }

          // Dots + compact value labels for non-null points
          pts.forEach((pt, i) => {
            if (!pt) return;
            ctx2d.beginPath();
            ctx2d.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            ctx2d.fillStyle = s.color;
            ctx2d.fill();
            ctx2d.strokeStyle = isDark ? "#1a1d2e" : "#fff";
            ctx2d.lineWidth = 1.5;
            ctx2d.stroke();

            // Value label — use formatted value
            const rawVal = s.vals[i];
            const label = rawVal !== null ? formatMetricValue(rawVal, axes[i].key) : "N/A";
            ctx2d.font = "bold 9px 'Outfit', sans-serif";
            ctx2d.fillStyle = isDark ? "#fff" : "#111";
            ctx2d.textAlign = "center";
            ctx2d.fillText(label, pt.x, pt.y - 9);
          });

          // State name label top-left
          ctx2d.font = "bold 13px 'Outfit', sans-serif";
          ctx2d.fillStyle = s.color;
          ctx2d.textAlign = "left";
          ctx2d.fillText(`▶ ${s.name}`, padL, padT - 18);
        }
      }
    }

    drawLines(null);

    // Hover interaction
    canvas.onmousemove = (e) => {
      const cr = canvas.getBoundingClientRect();
      const mx = e.clientX - cr.left;
      const my = e.clientY - cr.top;
      let closest = null, minDist = 30;

      stateData.forEach(s => {
        axes.forEach((_, i) => {
          const n = normalizeVal(s.vals[i], i);
          if (n === null) return;
          const px = axisX(i);
          const py = yForVal(n);
          const d = Math.hypot(mx - px, my - py);
          if (d < minDist) { minDist = d; closest = s.id; }
        });
      });

      if (closest !== hoveredState) {
        hoveredState = closest;
        drawLines(hoveredState);
      }
    };

    canvas.onmouseleave = () => {
      hoveredState = null;
      drawLines(null);
    };
  }


  // --- Render Central Transfers Tab Charts ---
  function renderTransfersTab(t) {
    const yearIdxStr = document.getElementById("transfers-year-select").value;
    if(!yearIdxStr) return;
    const yearIdx = parseInt(yearIdxStr);

    // Chart 1: Central Transfers Dependency Matrix (Bubble Scatter)
    const ctxMatrix = document.getElementById("chart-transfers-matrix").getContext("2d");
    if (charts["transfersMatrix"]) charts["transfersMatrix"].destroy();

    const bubbleDatasets = [];
    fiscalData.states.forEach(state => {
      const ct_pct = fiscalData.metrics.central_transfers[state.id][yearIdx];
      const ct_abs = getMetricValue(state.id, "central_transfers_abs", yearIdx);
      const gsdp = getMetricValue(state.id, "gsdp_absolute", yearIdx) || 0; 
      if (ct_pct === null || ct_abs === null) return;
      
      const r = Math.max(8, Math.min(30, (gsdp / 1000) * 1.5));
      bubbleDatasets.push({
        label: state.name,
        data: [{ x: ct_pct, y: ct_abs, r: r }],
        backgroundColor: state.color + 'CC',
        borderColor: state.color,
        borderWidth: 1.5,
        hoverBackgroundColor: state.color,
        hoverBorderWidth: 2,
        stateId: state.id
      });
    });

    charts["transfersMatrix"] = new Chart(ctxMatrix, {
      type: "bubble",
      data: { datasets: bubbleDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Central Transfers (% of Revenue Receipts)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Central Transfers Absolute (\u20B9 Bn)",
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary, callback: function(value) { return '\u20B9' + value; } }
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
              label: (ctx) => {
                const ds = ctx.dataset;
                return [
                  ds.label,
                  `Transfers (% Rev): ${ctx.raw.x.toFixed(2)}%`,
                  `Transfers (Abs): \u20B9${ctx.raw.y.toLocaleString('en-US', {minimumFractionDigits: 2})} Bn`
                ];
              }
            }
          }
        }
      }
    });

    // Chart 2: State-wise Transfer Dependency (Bar)
    const ctxBar = document.getElementById("chart-transfers-bar").getContext("2d");
    if (charts["transfersBar"]) charts["transfersBar"].destroy();

    const barData = [];
    const barLabels = [];
    const barColors = [];
    const barBorderColors = [];
    
    // Sort states by transfer dependency
    const sortedStates = [...fiscalData.states].sort((a, b) => {
        return fiscalData.metrics.central_transfers[b.id][yearIdx] - fiscalData.metrics.central_transfers[a.id][yearIdx];
    });

    sortedStates.forEach(state => {
        const val = fiscalData.metrics.central_transfers[state.id][yearIdx];
        if (val !== null) {
            barData.push(val);
            barLabels.push(state.name);
            barColors.push(state.color + 'CC');
            barBorderColors.push(state.color);
        }
    });

    charts["transfersBar"] = new Chart(ctxBar, {
      type: "bar",
      data: {
        labels: barLabels,
        datasets: [
          {
            label: "Central Transfers (% of Revenue Receipts)",
            data: barData,
            backgroundColor: barColors,
            borderColor: barBorderColors,
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
            grid: { display: false },
            ticks: { font: { weight: 500, size: 10 }, color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: { 
              display: true, 
              text: "% of Revenue Receipts", 
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" } 
            },
            ticks: { color: t.textSecondary }
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
              label: (ctx) => `${ctx.raw.toFixed(2)}%`
            }
          }
        }
      }
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
    if (key === "total_revenue") {
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      if (budget === null || fd_abs === null) return null;
      return budget - fd_abs;
    }
    if (key === "revenue_gsdp") {
      const gsdp = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const rev = getMetricValue(stateId, "total_revenue", yearIdx);
      if (gsdp === null || rev === null || gsdp === 0) return null;
      return (rev / gsdp) * 100;
    }
    if (key === "budget_gsdp") {
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const gsdp = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      if (budget === null || gsdp === null || gsdp === 0) return null;
      return (budget / gsdp) * 100;
    }
    if (key === "revenue_exp_abs") {
      const rev = getMetricValue(stateId, "total_revenue", yearIdx);
      const revBal = getMetricValue(stateId, "revenue_deficit_abs", yearIdx);
      if (rev === null || revBal === null) return null;
      return rev - revBal;
    }
    if (key === "revenue_exp_gsdp") {
      const gsdp = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const revExp = getMetricValue(stateId, "revenue_exp_abs", yearIdx);
      if (gsdp === null || revExp === null || gsdp === 0) return null;
      return (revExp / gsdp) * 100;
    }
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
    if (key === "deficit_to_sotr") {
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      
      const trr_abs = getMetricValue(stateId, "total_revenue", yearIdx);
      const central_transfers_pct = fiscalData.metrics.central_transfers[stateId][yearIdx];
      const rd_pct = fiscalData.metrics.revenue_deficit[stateId][yearIdx];
      
      if (gsdp_abs === null || trr_abs === null || trr_abs === 0 || rd_pct === null || central_transfers_pct === null) return null;
      
      const transfers_abs = (central_transfers_pct / 100) * trr_abs;
      const orr_abs = trr_abs - transfers_abs; // Own Revenue Receipts
      
      const headline_rd_abs = (rd_pct / 100) * gsdp_abs;
      
      // Headline RD is positive for surplus, negative for deficit
      // Own RD = Headline RD - Transfers (transfers subsidize the deficit)
      const own_rd_abs = headline_rd_abs - transfers_abs;
      
      if (orr_abs === 0) return null;
      
      return (own_rd_abs / orr_abs) * 100;
    }
    if (key === "direct_central_investment") {
      return fiscalData.metrics.direct_central_investment[stateId][yearIdx];
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
    if (key === "total_revenue") {
      return { name: "Total Revenue (Absolute) (Rupees Billion)", shortName: "Total Revenue" };
    }
    if (key === "revenue_gsdp") {
      return { name: "Total Revenue (% of GSDP)", shortName: "Total Revenue (%)" };
    }
    if (key === "budget_gsdp") {
      return { name: "Total Budget (% of GSDP)", shortName: "Total Budget (%)" };
    }
    if (key === "revenue_exp_abs") {
      return { name: "Revenue Expenditure (Absolute) (Rupees Billion)", shortName: "Revenue Expenditure (Absolute)" };
    }
    if (key === "revenue_exp_gsdp") {
      return { name: "Revenue Expenditure (% of GSDP)", shortName: "Revenue Expenditure (%)" };
    }
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
    if (key === "direct_central_investment") {
      return { name: "Direct Central Investment (% of GSDP)", shortName: "Direct Central Inv." };
    }
    if (key === "central_transfers_abs") {
      return { name: "Federal Transfers (Absolute) (Rupees Billion)", shortName: "Federal Transfers (Absolute)" };
    }
    if (key === "deficit_to_sotr") {
      return { name: "Own Revenue Deficit/Surplus (% of Own Revenue)", shortName: "Deficit to SOTR" };
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
    if (key === "deficit_to_sotr") {
      return `${value.toFixed(1)}%`;
    }
    if (key === "gsdp_absolute" || key === "total_budget" || key === "total_revenue" || key === "fiscal_deficit_abs" || key === "revenue_exp_abs" || key === "capital_outlay_abs" || key === "central_transfers_abs") {
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
