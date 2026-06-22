// Sub-National Fiscal Analytics Dashboard JS Engine
// Handles: Theme toggle, State selector population, Tab swapping, Summary card calculations, and interactive Chart.js visualization redrawing.

document.addEventListener("DOMContentLoaded", () => {
  // --- State Variables ---
  let activeStateId = "MH"; // Default to Maharashtra
  let activeTab = "deficit"; // Default tab
  let charts = {}; // Cache to hold Chart.js instances
  let currentSortColumn = "state"; // Default sort column for comparison table
  let currentSortAsc = true; // Default sort order

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

    // 3D Selector Changed
    const threedSelects = ["3d-year-select", "3d-x-select", "3d-y-select", "3d-z-select"];
    threedSelects.forEach(id => {
      document.getElementById(id).addEventListener("change", () => {
        if (activeTab === "threed") renderThreeDTab();
      });
    });

    // Bind click events on sortable headers
    const headers = document.querySelectorAll(".sortable-header");
    headers.forEach(header => {
      header.addEventListener("click", () => {
        const sortKey = header.getAttribute("data-sort-key");
        if (currentSortColumn === sortKey) {
          currentSortAsc = !currentSortAsc;
        } else {
          currentSortColumn = sortKey;
          currentSortAsc = true;
        }
        
        // Update header sorting classes and icons
        headers.forEach(h => {
          h.classList.remove("sorted-asc", "sorted-desc");
          const icon = h.querySelector("i");
          if (icon) icon.className = "fa-solid fa-sort";
        });
        
        if (currentSortAsc) {
          header.classList.add("sorted-asc");
          header.querySelector("i").className = "fa-solid fa-caret-up";
        } else {
          header.classList.add("sorted-desc");
          header.querySelector("i").className = "fa-solid fa-caret-down";
        }
        
        renderComparisonTab();
      });
    });
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

    document.getElementById("profile-pc-gsdp").textContent = `₹${latestPcGsdp.toLocaleString('en-IN')}`;
    document.getElementById("profile-pc-debt").textContent = `₹${Math.round(latestPcDebt).toLocaleString('en-IN')}`;
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
              text: metricKey === "debt_own_tax" ? "Ratio (x)" : (metricKey === "pc_gsdp" || metricKey === "pc_debt" ? "Rupees (₹)" : "Percentage (%)"),
              font: { weight: 600 }
            },
            ticks: {
              callback: function(value) {
                if (metricKey === "pc_gsdp" || metricKey === "pc_debt") {
                  return '₹' + value.toLocaleString('en-IN');
                }
                if (metricKey === "debt_own_tax") {
                  return value.toFixed(1) + 'x';
                }
                return value + '%';
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
        fiscal_deficit: fiscalData.metrics.fiscal_deficit[s.id][yearIdx],
        revenue_deficit: fiscalData.metrics.revenue_deficit[s.id][yearIdx],
        capital_outlay: fiscalData.metrics.capital_outlay[s.id][yearIdx],
        debt_gsdp: debt_pct,
        pc_gsdp: pc_gsdp_val,
        pc_debt: pc_debt_val,
        central_transfers: fiscalData.metrics.central_transfers[s.id][yearIdx],
        borrowing_spread: fiscalData.metrics.borrowing_spread[s.id][yearIdx]
      };
    });

    // Sort table data based on selected column & direction
    tableData.sort((a, b) => {
      let valA = currentSortColumn === "state" ? a.name : a[currentSortColumn];
      let valB = currentSortColumn === "state" ? b.name : b[currentSortColumn];

      if (valA === null || valA === undefined) return currentSortAsc ? 1 : -1;
      if (valB === null || valB === undefined) return currentSortAsc ? -1 : 1;

      if (typeof valA === "string") {
        return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return currentSortAsc ? valA - valB : valB - valA;
      }
    });

    // Helper for scorecard heatmap coloring
    function getCellFormatting(value, metricType) {
      if (value === null || value === undefined) {
        return `style="background-color: transparent; font-weight: 500; color: var(--text-secondary);"`;
      }
      let bgColor = "";
      if (metricType === "fiscal_deficit") {
        bgColor = value < 3.0 ? "rgba(16, 185, 129, 0.08)" : (value <= 4.0 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "revenue_deficit") {
        bgColor = value >= 0.0 ? "rgba(16, 185, 129, 0.08)" : (value >= -1.5 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "capital_outlay") {
        bgColor = value >= 2.5 ? "rgba(16, 185, 129, 0.08)" : (value >= 1.5 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "debt_gsdp") {
        bgColor = value < 20.0 ? "rgba(16, 185, 129, 0.08)" : (value <= 30.0 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "central_transfers") {
        bgColor = value < 25.0 ? "rgba(16, 185, 129, 0.08)" : (value <= 45.0 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "borrowing_spread") {
        bgColor = value < 20 ? "rgba(16, 185, 129, 0.08)" : (value <= 35 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "pc_gsdp") {
        bgColor = value >= 300000 ? "rgba(16, 185, 129, 0.08)" : (value >= 200000 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      } else if (metricType === "pc_debt") {
        bgColor = value < 60000 ? "rgba(16, 185, 129, 0.08)" : (value <= 90000 ? "rgba(245, 158, 11, 0.08)" : "rgba(244, 63, 94, 0.08)");
      }
      return `style="background-color: ${bgColor}; font-weight: 500;"`;
    }

    function formatCellText(val, metricType) {
      if (val === null || val === undefined) {
        return "N/A";
      }
      if (metricType === "fiscal_deficit" || metricType === "revenue_deficit" || metricType === "capital_outlay" || metricType === "debt_gsdp" || metricType === "central_transfers") {
        const prefix = (metricType === "revenue_deficit" && val >= 0) ? "+" : "";
        return `${prefix}${val.toFixed(2)}%`;
      }
      if (metricType === "pc_gsdp" || metricType === "pc_debt") {
        return `₹${Math.round(val).toLocaleString('en-IN')}`;
      }
      if (metricType === "borrowing_spread") {
        return `+${val} bps`;
      }
      return val;
    }

    // Render table data rows
    tableData.forEach(rowItem => {
      const row = document.createElement("tr");
      // Highlight the active state row
      if (rowItem.id === activeStateId) {
        row.style.background = "rgba(99, 102, 241, 0.08)";
        row.style.fontWeight = "600";
      }

      row.innerHTML = `
        <td style="font-weight: 600;">
          <span class="state-bullet" style="background: ${rowItem.color}"></span>
          ${rowItem.name}
        </td>
        <td ${getCellFormatting(rowItem.fiscal_deficit, 'fiscal_deficit')}>${formatCellText(rowItem.fiscal_deficit, 'fiscal_deficit')}</td>
        <td ${getCellFormatting(rowItem.revenue_deficit, 'revenue_deficit')}>${formatCellText(rowItem.revenue_deficit, 'revenue_deficit')}</td>
        <td ${getCellFormatting(rowItem.capital_outlay, 'capital_outlay')}>${formatCellText(rowItem.capital_outlay, 'capital_outlay')}</td>
        <td ${getCellFormatting(rowItem.debt_gsdp, 'debt_gsdp')}>${formatCellText(rowItem.debt_gsdp, 'debt_gsdp')}</td>
        <td ${getCellFormatting(rowItem.pc_gsdp, 'pc_gsdp')}>${formatCellText(rowItem.pc_gsdp, 'pc_gsdp')}</td>
        <td ${getCellFormatting(rowItem.pc_debt, 'pc_debt')}>${formatCellText(rowItem.pc_debt, 'pc_debt')}</td>
        <td ${getCellFormatting(rowItem.central_transfers, 'central_transfers')}>${formatCellText(rowItem.central_transfers, 'central_transfers')}</td>
        <td ${getCellFormatting(rowItem.borrowing_spread, 'borrowing_spread')}>${formatCellText(rowItem.borrowing_spread, 'borrowing_spread')}</td>
      `;
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
    return fiscalData.metrics[key][stateId][yearIdx];
  }

  function getMetricMetadata(key) {
    if (key === "debt_own_tax") {
      return { name: "Debt to Own Tax Revenue (Ratio)", shortName: "Debt/Own Tax" };
    }
    if (key === "pc_debt") {
      return { name: "Per Capita Debt (Rupees)", shortName: "Per Capita Debt" };
    }
    const names = {
      fiscal_deficit: "Gross Fiscal Deficit",
      revenue_deficit: "Revenue Deficit",
      capital_outlay: "Capital Outlay",
      debt_gsdp: "Outstanding Debt",
      own_tax_gsdp: "Own Tax Revenue",
      central_transfers: "Federal Transfers",
      committed_exp: "Committed Expenditure",
      pc_gsdp: "Per Capita GSDP",
      pc_debt: "Per Capita Debt"
    };
    return {
      name: fiscalData.metrics[key] ? fiscalData.metrics[key].name : (key === "pc_debt" ? "Per Capita Debt (Rupees)" : "Debt to Own Tax Revenue (Ratio)"),
      shortName: names[key] || (fiscalData.metrics[key] ? fiscalData.metrics[key].name : "Debt/Own Tax")
    };
  }

  function formatMetricValue(value, key) {
    if (key === "debt_own_tax") {
      return `${value.toFixed(2)}x`;
    }
    if (key === "pc_gsdp" || key === "pc_debt") {
      return `₹${Math.round(value).toLocaleString('en-IN')}`;
    }
    if (key === "borrowing_spread") {
      return `+${value} bps`;
    }
    return `${value.toFixed(2)}%`;
  }

  // Run initialization
  init();
});
