// Sub-National Fiscal Analytics Dashboard JS Engine
// Handles: Theme toggle, State selector population, Tab swapping, Summary card calculations, and interactive Chart.js visualization redrawing.

document.addEventListener("DOMContentLoaded", () => {
  // Canvas roundRect Polyfill for browser compatibility
  if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  // --- State Variables ---
  let activeStateId = "MH"; // Default to Maharashtra
  let activeTab = "deficit"; // Default tab
  let charts = {}; // Cache to hold Chart.js instances
  let currentSortColumn = "state"; // Default sort column for comparison table
  let currentSortAsc = true; // Default sort order
  let isVibrantHeatmap = true; // Toggle for heatmap style

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
    "revenue_exp_to_sotr",
    "capital_outlay",
    "capital_outlay_abs",
    "debt_gsdp",
    "pc_gsdp",
    "pc_debt",
    "central_transfers",
    "central_transfers_abs",
    "borrowing_spread"
  ];

  // Try to load column order from local storage (persists across reloads)
  const savedOrder = localStorage.getItem("column_order");
  if (savedOrder) {
    try {
      const parsed = JSON.parse(savedOrder);
      if (Array.isArray(parsed) && parsed.length > 0) {
        columnOrder = parsed.filter(c => c !== "revenue_deficit" && c !== "revenue_deficit_abs");
        // Verify we have all columns (in case of updates)
        const allCols = ["state", "gsdp_absolute", "total_budget", "budget_gsdp", "total_revenue", "revenue_gsdp", "revenue_exp_abs", "revenue_exp_gsdp", "revenue_exp_to_sotr", "gsdp_growth", "fiscal_deficit", "fiscal_deficit_abs", "deficit_to_sotr", "capital_outlay", "capital_outlay_abs", "debt_gsdp", "pc_gsdp", "pc_debt", "central_transfers", "central_transfers_abs", "borrowing_spread", "direct_central_investment"];
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
    revenue_exp_to_sotr: { label: "Rev Exp (% SOTR)" },
    capital_outlay: { label: "Capital Outlay (% GSDP)" },
    capital_outlay_abs: { label: "Capital Outlay (₹ Bn)" },
    debt_gsdp: { label: "Outstanding Debt (% GSDP)" },
    pc_gsdp: { label: "Per Capita GSDP" },
    pc_debt: { label: "Per Capita Debt" },
    central_transfers: { label: "Central Transfers (% Revenue)" },
    central_transfers_abs: { label: "Central Transfers (₹ Bn)" },
    borrowing_spread: { label: "SDL Spread (bps)" },
    deficit_to_sotr: { label: "Own Rev Deficit (% Own Rev)" },
    direct_central_investment: { label: "Direct Central Inv (% GSDP)" }
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
    if (transfersYearSelect) {
      fiscalData.years.forEach((yr, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = yr;
        transfersYearSelect.appendChild(option);
      });
      transfersYearSelect.value = fiscalData.years.length - 1;
    }

    // Populate Education Matrix Year Selector
    const educationYearSelect = document.getElementById("education-year-select");
    if (educationYearSelect) {
      fiscalData.years.forEach((yr, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = yr;
        educationYearSelect.appendChild(option);
      });
      educationYearSelect.value = fiscalData.years.length - 1;
    }

    // Populate Healthcare Matrix Year Selector
    const healthcareYearSelect = document.getElementById("healthcare-year-select");
    if (healthcareYearSelect) {
      fiscalData.years.forEach((yr, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = yr;
        healthcareYearSelect.appendChild(option);
      });
    }

    // Populate Social Safety Net Matrix Year Selector
    const socialYearSelect = document.getElementById("social-year-select");
    if (socialYearSelect) {
      fiscalData.years.forEach((yr, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = yr;
        socialYearSelect.appendChild(option);
      });
      socialYearSelect.value = fiscalData.years.length - 1;
    }

    // Populate Fiscal Input Quality Matrix Year Selector
    const fiscalInputYearSelect = document.getElementById("fiscal-input-year-select");
    if (fiscalInputYearSelect) {
      fiscalData.years.forEach((yr, idx) => {
        const option = document.createElement("option");
        option.value = idx;
        option.textContent = yr;
        fiscalInputYearSelect.appendChild(option);
      });
      fiscalInputYearSelect.value = fiscalData.years.length - 1;
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
    if (transfersYearSelect2) {
      transfersYearSelect2.addEventListener("change", () => {
        if (activeTab === "transfers") {
          renderTransfersTab(getThemeColors());
        }
      });
    }

    // Education Tab Year Selection Changed
    const educationYearSelect2 = document.getElementById("education-year-select");
    if (educationYearSelect2) {
      educationYearSelect2.addEventListener("change", () => {
        if (activeTab === "education") {
          renderEducationTab(getThemeColors());
        }
      });
    }

    // Healthcare Tab Year Selection Changed
    const healthcareYearSelect2 = document.getElementById("healthcare-year-select");
    if (healthcareYearSelect2) {
      healthcareYearSelect2.addEventListener("change", () => {
        if (activeTab === "healthcare") {
          renderHealthcareTab(getThemeColors());
        }
      });
    }

    // Social Safety Net Tab Year Selection Changed
    const socialYearSelect2 = document.getElementById("social-year-select");
    if (socialYearSelect2) {
      socialYearSelect2.addEventListener("change", () => {
        if (activeTab === "social") {
          renderSocialTab(getThemeColors());
        }
      });
    }

    // Fiscal Input Quality Tab Year Selection Changed
    const fiscalInputYearSelect2 = document.getElementById("fiscal-input-year-select");
    if (fiscalInputYearSelect2) {
      fiscalInputYearSelect2.addEventListener("change", () => {
        if (activeTab === "fiscal_input") {
          renderFiscalInputTab(getThemeColors());
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

    // Reset Column Order button
    const resetColBtn = document.getElementById("reset-column-order-btn");
    if (resetColBtn) {
      resetColBtn.addEventListener("click", () => {
        localStorage.removeItem("column_order");
        columnOrder = [
          "state", "gsdp_absolute", "total_budget", "budget_gsdp",
          "total_revenue", "revenue_gsdp", "gsdp_growth",
          "fiscal_deficit", "fiscal_deficit_abs",
          "revenue_exp_abs", "revenue_exp_gsdp", "revenue_exp_to_sotr",
          "capital_outlay", "capital_outlay_abs",
          "debt_gsdp", "pc_gsdp", "pc_debt",
          "central_transfers", "central_transfers_abs", "borrowing_spread"
        ];
        renderTableHeader();
        renderComparisonTab();
        // Brief visual feedback on the button
        resetColBtn.style.background = "var(--accent-color)";
        resetColBtn.style.color = "#fff";
        resetColBtn.style.borderColor = "var(--accent-color)";
        setTimeout(() => {
          resetColBtn.style.background = "";
          resetColBtn.style.color = "";
          resetColBtn.style.borderColor = "";
        }, 800);
      });
    }

    // Sortable header click and drag bindings are now dynamically managed inside renderTableHeader()
  }

  // --- Helper Methods ---

  // Get active theme style settings
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      gridColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)",
      textColor: isDark ? "#94a3b8" : "#475569",
      textSecondary: isDark ? "#64748b" : "#94a3b8",
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

    // Dynamic title year updates
    const latestYear = fiscalData.years[latestIdx];
    const profileCard = document.querySelector(".state-profile-card");
    if (profileCard) {
      profileCard.querySelectorAll(".detail-row").forEach(row => {
        const title = row.getAttribute("title");
        if (title) {
          row.setAttribute("title", title.replace(/\(FY\d{2}.*?\)/g, `(${latestYear})`));
        }
      });
    }
  }

  // Update Summary Metrics Card Highlights
  function updateSummaryStrip(stateId) {
    const latestIdx = fiscalData.years.length - 1;
    const prevIdx = latestIdx - 1;

    // Update summary strip labels dynamically
    const latestYear = fiscalData.years[latestIdx];
    document.querySelectorAll("#metrics-summary-strip .card-label").forEach(label => {
      if (label.textContent.includes("Fiscal Deficit")) {
        label.textContent = `Fiscal Deficit (${latestYear})`;
      } else if (label.textContent.includes("Capital Outlay")) {
        label.textContent = `Capital Outlay (${latestYear})`;
      }
    });

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
    } else if (activeTab === "deficit_trajectory") {
      renderDeficitTrajectoryTab(t);
    } else if (activeTab === "sustainability") {
      renderSustainabilityTab(t);
    } else if (activeTab === "sustainability_trajectory") {
      renderSustainabilityTrajectoryTab(t);
    } else if (activeTab === "revenue") {
      renderRevenueTab(t);
    } else if (activeTab === "revenue_trajectory") {
      renderRevenueTrajectoryTab(t);
    } else if (activeTab === "expenditure") {
      renderExpenditureTab(t);
    } else if (activeTab === "expenditure_trajectory") {
      renderExpenditureTrajectoryTab(t);
    } else if (activeTab === "transfers") {
      renderTransfersTab(t);
    } else if (activeTab === "transfers_trajectory") {
      renderTransfersTrajectoryTab(t);
    } else if (activeTab === "education") {
      renderEducationTab(t);
    } else if (activeTab === "education_trajectory") {
      renderEducationTrajectoryTab(t);
    } else if (activeTab === "healthcare") {
      renderHealthcareTab(t);
    } else if (activeTab === "healthcare_trajectory") {
      renderHealthcareTrajectoryTab(t);
    } else if (activeTab === "social") {
      renderSocialTab(t);
    } else if (activeTab === "social_trajectory") {
      renderSocialTrajectoryTab(t);
    } else if (activeTab === "fiscal_input") {
      renderFiscalInputTab(t);
    } else if (activeTab === "fiscal_input_trajectory") {
      renderFiscalInputTrajectoryTab(t);
    } else if (activeTab === "demographics_trajectory") {
      renderDemographicsTrajectoryTab(t);
    } else if (activeTab === "comparison") {
      renderComparisonTab();
      // Use setTimeout so canvas has been laid out with correct dimensions
      setTimeout(() => renderFiscalNavigator(), 50);
    } else if (activeTab === "threed") {
      renderThreeDTab();
    } else if (activeTab === "devolution") {
      renderDevolutionTab();
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
              label: function (context) {
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
      },
      plugins: [{
        id: "revDeficitLine",
        afterDraw(chart) {
          const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
          ctx.save();

          const xZero = (x && x.min !== undefined && x.max !== undefined && 0 >= x.min && 0 <= x.max) ? x.getPixelForValue(0) : null;
          const yCapex = (y && y.min !== undefined && y.max !== undefined && 1.5 >= y.min && 1.5 <= y.max) ? y.getPixelForValue(1.5) : null;

          // --- Quadrant shading (very subtle fills behind bubbles) ---
          if (xZero && yCapex) {
            // Bottom-left: Revenue Deficit + Low Capex = Vulnerable (faint red)
            ctx.fillStyle = "rgba(239,68,68,0.04)";
            ctx.fillRect(left, yCapex, xZero - left, bottom - yCapex);
            // Top-right: Revenue Surplus + High Capex = Golden (faint green)
            ctx.fillStyle = "rgba(16,185,129,0.04)";
            ctx.fillRect(xZero, top, right - xZero, yCapex - top);
          }

          // --- Vertical line: FRBM Revenue Deficit = 0% ---
          if (xZero) {
            ctx.beginPath();
            ctx.setLineDash([7, 5]);
            ctx.moveTo(xZero, top);
            ctx.lineTo(xZero, bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(239,68,68,0.85)";
            ctx.stroke();
            ctx.setLineDash([]);

            // Pill label centred on line at top
            const vLabel = "FRBM 2003: Rev Deficit = 0%";
            ctx.font = "bold 10px 'Outfit', sans-serif";
            const vTw = ctx.measureText(vLabel).width;
            const vPx = xZero - vTw / 2 - 4;
            const vPy = top + 4;
            ctx.fillStyle = "rgba(239,68,68,0.15)";
            ctx.beginPath();
            ctx.roundRect(vPx, vPy, vTw + 10, 17, 4);
            ctx.fill();
            ctx.strokeStyle = "rgba(239,68,68,0.55)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "#ef4444";
            ctx.textAlign = "left";
            ctx.fillText(vLabel, vPx + 5, vPy + 12);
          }

          // --- Horizontal line: 15th FC Capex Incentive ≥ 1.5% ---
          if (yCapex) {
            ctx.beginPath();
            ctx.setLineDash([7, 5]);
            ctx.moveTo(left, yCapex);
            ctx.lineTo(right, yCapex);
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(16,185,129,0.85)";
            ctx.stroke();
            ctx.setLineDash([]);

            // Pill label on right side of line
            const hLabel = "15th FC Capex Incentive: ≥1.5% GSDP";
            ctx.font = "bold 10px 'Outfit', sans-serif";
            const hTw = ctx.measureText(hLabel).width;
            const hPx = right - hTw - 18;
            const hPy = yCapex - 7;
            ctx.fillStyle = "rgba(16,185,129,0.12)";
            ctx.beginPath();
            ctx.roundRect(hPx - 4, hPy - 13, hTw + 10, 17, 4);
            ctx.fill();
            ctx.strokeStyle = "rgba(16,185,129,0.55)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "#10b981";
            ctx.textAlign = "left";
            ctx.fillText(hLabel, hPx, hPy);
          }

          // --- Quadrant corner labels ---
          ctx.font = "bold 9px 'Outfit', sans-serif";
          const qPad = 10;
          const midX = xZero || (left + right) / 2;
          const midY = yCapex || (top + bottom) / 2;

          // Top-right: Golden Quadrant
          ctx.fillStyle = "rgba(16,185,129,0.65)";
          ctx.textAlign = "right";
          ctx.fillText("★ Golden Quadrant", right - qPad, top + 28);
          ctx.font = "8px 'Outfit', sans-serif";
          ctx.fillText("Surplus + High Capex", right - qPad, top + 40);

          // Top-left: Productive but stressed
          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(245,158,11,0.7)";
          ctx.textAlign = "left";
          ctx.fillText("⚠ Productive but Stressed", left + qPad, top + 28);
          ctx.font = "8px 'Outfit', sans-serif";
          ctx.fillText("Deficit + High Capex", left + qPad, top + 40);

          // Bottom-right: Cautious / Under-investing
          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(99,102,241,0.7)";
          ctx.textAlign = "right";
          ctx.fillText("◈ Cautious / Under-investing", right - qPad, bottom - 20);
          ctx.font = "8px 'Outfit', sans-serif";
          ctx.fillText("Surplus + Low Capex", right - qPad, bottom - 10);

          // Bottom-left: Vulnerable Zone
          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(239,68,68,0.65)";
          ctx.textAlign = "left";
          ctx.fillText("✗ Vulnerable Zone", left + qPad, bottom - 20);
          ctx.font = "8px 'Outfit', sans-serif";
          ctx.fillText("Deficit + Low Capex", left + qPad, bottom - 10);

          ctx.restore();
        }
      }]
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
      },
      plugins: [{
        id: "sotrZeroLine",
        afterDraw(chart) {
          const { ctx, chartArea: { left, right }, scales: { y } } = chart;
          const LIMIT = 0;
          if (!y || y.min === undefined || y.max === undefined || LIMIT < y.min || LIMIT > y.max) return;

          const yPx = y.getPixelForValue(LIMIT);
          ctx.save();

          // Dashed horizontal line
          ctx.beginPath();
          ctx.setLineDash([8, 5]);
          ctx.moveTo(left, yPx);
          ctx.lineTo(right, yPx);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
          ctx.stroke();
          ctx.setLineDash([]);

          // Label pill
          const label = "FRBM 2003: Revenue Balance = 0%";
          ctx.font = "bold 10px 'Outfit', sans-serif";
          const tw = ctx.measureText(label).width;
          const px = left + 10;
          const py = yPx - 7;
          ctx.fillStyle = "rgba(239,68,68,0.15)";
          ctx.beginPath();
          ctx.roundRect(px - 4, py - 13, tw + 10, 18, 4);
          ctx.fill();
          ctx.strokeStyle = "rgba(239,68,68,0.55)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#ef4444";
          ctx.textAlign = "left";
          ctx.fillText(label, px, py);

          // Zone labels on right
          ctx.font = "10px 'Outfit', sans-serif";
          ctx.textAlign = "right";
          ctx.fillStyle = "rgba(16,185,129,0.65)";
          ctx.fillText("▲ Revenue Surplus (Compliant)", right - 8, yPx - 10);
          ctx.fillStyle = "rgba(239,68,68,0.55)";
          ctx.fillText("▼ Revenue Deficit (FRBM Breach)", right - 8, yPx + 16);

          ctx.restore();
        }
      }]
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
          nhai: bd.nhai[yearIdx],
          css: bd.css[yearIdx],
          grants: bd.grants[yearIdx],
          notes: bd.notes
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

    // Render FRBM Compliance Matrix
    renderFRBMMatrix(yearIdx);
  }

  // --- FRBM & 15th Finance Commission Compliance Matrix ---
  function renderFRBMMatrix(yearIdx) {
    const container = document.getElementById("frbm-matrix-container");
    if (!container) return;

    const yearStr = fiscalData.years[yearIdx];

    // FRBM norms — glide path aware
    // FY24 onwards: 3.0%, FY23: 3.5%, FY22: 4.0%
    const yrNum = parseInt(yearStr.split("-")[0]);
    const fdLimit = yrNum >= 2023 ? 3.0 : (yrNum === 2022 ? 3.5 : 4.0);

    const norms = [
      {
        key: "fiscal_deficit",
        label: "Fiscal Deficit",
        unit: "% of GSDP",
        limit: fdLimit,
        note: `≤${fdLimit}% GSDP (15th FC glide path)`,
        lowerBetter: true,
        noteExtra: "+0.5% allowed for power sector reforms"
      },
      {
        key: "revenue_deficit",
        label: "Revenue Deficit",
        unit: "% of GSDP",
        limit: 0,
        note: "≤0% (FRBM: must be zero or surplus)",
        lowerBetter: true,
        noteExtra: "Revenue deficit = structural fiscal stress"
      },
      {
        key: "debt_gsdp",
        label: "Debt / GSDP",
        unit: "%",
        limit: 32.5,
        note: "≤32.5% GSDP (15th FC aggregate target)",
        lowerBetter: true,
        noteExtra: "NK Singh FRBM Review target: 20% long-run"
      },
      {
        key: "capital_outlay",
        label: "Capital Outlay",
        unit: "% of GSDP",
        limit: 1.5,
        note: "≥1.5% GSDP (encouraged minimum for development)",
        lowerBetter: false,
        noteExtra: "15th FC incentivised incremental capex (+0.5% borrowing room)"
      },
      {
        key: "borrowing_spread",
        label: "SDL Spread over G-Sec",
        unit: "bps",
        limit: 50,
        note: "≤50 bps (market stress signal threshold)",
        lowerBetter: true,
        noteExtra: "Higher spreads signal market perception of fiscal risk"
      }
    ];

    // Build compliance status per state per norm
    function getStatus(val, norm) {
      if (val === null || val === undefined) return "na";
      if (norm.lowerBetter) {
        if (val <= norm.limit) return "ok";
        if (val <= norm.limit * 1.1 + (norm.limit === 0 ? 0.5 : 0)) return "warn";
        return "breach";
      } else {
        if (val >= norm.limit) return "ok";
        if (val >= norm.limit * 0.9) return "warn";
        return "breach";
      }
    }

    const statusColor = { ok: "#10b981", warn: "#f59e0b", breach: "#ef4444", na: "#6b7280" };
    const statusLabel = { ok: "✓", warn: "~", breach: "✗", na: "—" };
    const statusBg = { ok: "rgba(16,185,129,0.1)", warn: "rgba(245,158,11,0.1)", breach: "rgba(239,68,68,0.1)", na: "transparent" };

    // Summary counts
    const summary = { ok: 0, warn: 0, breach: 0 };

    let html = `
      <div style="margin-bottom:1rem; background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; padding: 0.8rem 1rem;">
        <div style="font-size:0.8rem; font-weight:700; color:var(--accent-color); margin-bottom:0.4rem;">
          <i class="fa-solid fa-scale-balanced"></i>&nbsp; Fiscal Year: ${yearStr} &nbsp;|&nbsp; FRBM Glide Path: Fiscal Deficit ≤ ${fdLimit}% GSDP &nbsp;|&nbsp; Revenue Deficit Target: 0% &nbsp;|&nbsp; Debt Target: ≤32.5% GSDP
        </div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">
          Constitutional limit under <strong>Article 293</strong>: States may not borrow without Central Govt approval. The <strong>Net Borrowing Ceiling (NBC)</strong> is set annually by the Ministry of Finance based on these norms.
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
        <thead>
          <tr style="border-bottom: 2px solid rgba(99,102,241,0.3);">
            <th style="text-align:left; padding: 0.5rem 0.8rem; font-weight:700; color:var(--text-secondary);">State</th>
    `;

    norms.forEach(n => {
      html += `<th style="text-align:center; padding:0.5rem 0.6rem; font-weight:700; color:var(--text-secondary); white-space:nowrap;">
        ${n.label}<br><span style="font-size:0.7rem; font-weight:400;">${n.note}</span>
      </th>`;
    });
    html += `<th style="text-align:center; padding:0.5rem 0.6rem; font-weight:700; color:var(--text-secondary);">Compliance<br><span style="font-size:0.7rem; font-weight:400;">Score</span></th></tr></thead><tbody>`;

    fiscalData.states.forEach((state, si) => {
      const rowBg = si % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent";
      let stateScore = 0, stateTotal = 0;
      let rowCells = "";

      norms.forEach(norm => {
        const raw = getMetricValue(state.id, norm.key, yearIdx);
        const status = getStatus(raw, norm);
        if (status === "ok") { stateScore += 2; stateTotal += 2; }
        else if (status === "warn") { stateScore += 1; stateTotal += 2; }
        else if (status === "breach") { stateTotal += 2; }
        else if (status === "na") { /* skip */ }

        const displayVal = raw !== null ? (
          norm.unit === "bps" ? `${Math.round(raw)} bps`
            : `${raw.toFixed(1)}%`
        ) : "N/A";
        const limitStr = norm.lowerBetter ? `Limit: ${norm.limit}${norm.unit === "bps" ? " bps" : "%"}` : `Min: ${norm.limit}%`;

        if (status !== "na") {
          summary[status] = (summary[status] || 0) + 1;
        }

        rowCells += `
          <td style="text-align:center; padding:0.5rem 0.6rem; background:${statusBg[status]};">
            <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
              <span style="font-size:1rem; font-weight:700; color:${statusColor[status]};">${statusLabel[status]}</span>
              <span style="font-weight:600; color:${statusColor[status]}; font-size:0.8rem;">${displayVal}</span>
              <div style="width:56px; height:5px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden; margin-top:2px;">
                ${raw !== null ? (() => {
            let pct;
            if (norm.lowerBetter) {
              pct = norm.limit === 0
                ? Math.max(0, Math.min(100, 100 - (raw / 5) * 100))
                : Math.max(0, Math.min(100, (1 - (raw / (norm.limit * 2))) * 100));
            } else {
              pct = Math.max(0, Math.min(100, (raw / (norm.limit * 1.5)) * 100));
            }
            return `<div style="height:100%; width:${pct.toFixed(0)}%; background:${statusColor[status]}; border-radius:3px; transition:width 0.4s;"></div>`;
          })() : ''}
              </div>
            </div>
          </td>`;
      });

      const scorePct = stateTotal > 0 ? Math.round((stateScore / stateTotal) * 100) : 0;
      const scoreColor = scorePct >= 70 ? "#10b981" : scorePct >= 40 ? "#f59e0b" : "#ef4444";
      const scoreLabel = scorePct >= 70 ? "Prudent" : scorePct >= 40 ? "Moderate" : "At Risk";

      html += `
        <tr style="background:${rowBg}; border-bottom: 1px solid rgba(255,255,255,0.04);">
          <td style="padding: 0.5rem 0.8rem; font-weight:600;">
            <span class="state-bullet" style="background:${state.color};"></span>
            ${state.name}
          </td>
          ${rowCells}
          <td style="text-align:center; padding:0.5rem 0.6rem;">
            <div style="display:inline-flex; flex-direction:column; align-items:center; gap:2px;">
              <span style="font-size:0.85rem; font-weight:700; color:${scoreColor};">${scorePct}%</span>
              <span style="font-size:0.7rem; color:${scoreColor}; font-weight:600; background:${scoreColor}22; padding:1px 6px; border-radius:10px;">${scoreLabel}</span>
            </div>
          </td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
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
      const interest = getMetricValue(state.id, "interest_to_own_revenue", yearIdx);

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
              label: function (context) {
                const stateName = context.dataset.label;
                const x = context.raw.x.toFixed(2);
                const y = context.raw.y.toFixed(2);
                return `${stateName} | Interest/Own Rev: ${x}% | Debt/GSDP: ${y}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: "Interest to Own Revenue Receipts (%) (← Better)",
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
      },
      plugins: [{
        id: "debtLimitLine",
        afterDraw(chart) {
          const { ctx, chartArea: { left, right }, scales: { y } } = chart;
          if (!y) return;
          ctx.save();

          // Helper to draw one horizontal reference line with a pill label
          function drawHLine({ value, color, colorAlpha, labelText, labelSide, zoneLabelAbove, zoneLabelBelow }) {
            if (y.min === undefined || y.max === undefined || value < y.min || value > y.max) return;
            const yPx = y.getPixelForValue(value);

            // Dashed line
            ctx.beginPath();
            ctx.setLineDash([8, 5]);
            ctx.moveTo(left, yPx);
            ctx.lineTo(right, yPx);
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.setLineDash([]);

            // Pill label
            ctx.font = "bold 10px 'Outfit', sans-serif";
            const tw = ctx.measureText(labelText).width;
            // Place labels on alternating sides to avoid overlap
            const px = labelSide === "right" ? right - tw - 24 : left + 10;
            const py = yPx - 7;
            ctx.fillStyle = colorAlpha;
            ctx.beginPath();
            ctx.roundRect(px - 4, py - 13, tw + 10, 18, 4);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.textAlign = "left";
            ctx.fillText(labelText, px, py);

            // Zone labels
            if (zoneLabelAbove) {
              ctx.font = "9px 'Outfit', sans-serif";
              ctx.fillStyle = zoneLabelAbove.color;
              ctx.textAlign = "right";
              ctx.fillText(zoneLabelAbove.text, right - 8, yPx - 10);
            }
            if (zoneLabelBelow) {
              ctx.font = "9px 'Outfit', sans-serif";
              ctx.fillStyle = zoneLabelBelow.color;
              ctx.textAlign = "right";
              ctx.fillText(zoneLabelBelow.text, right - 8, yPx + 15);
            }
          }

          // --- Line 1: 15th FC aggregate limit — 32.5% (Red) ---
          drawHLine({
            value: 32.5,
            color: "rgba(239,68,68,0.9)",
            colorAlpha: "rgba(239,68,68,0.12)",
            labelText: "15th FC Limit: 32.5%",
            labelSide: "left",
            zoneLabelAbove: { text: "▲ Breaching 15th FC limit", color: "rgba(239,68,68,0.6)" },
            zoneLabelBelow: null  // middle zone label handled by line 2 above
          });

          // --- Line 2: NK Singh FRBM Review — 20% long-run target (Amber) ---
          drawHLine({
            value: 20,
            color: "rgba(245,158,11,0.9)",
            colorAlpha: "rgba(245,158,11,0.12)",
            labelText: "NK Singh Target: 20% (long-run)",
            labelSide: "right",
            zoneLabelAbove: { text: "▲ Above long-run NK Singh target", color: "rgba(245,158,11,0.65)" },
            zoneLabelBelow: { text: "▼ Below 20% — Ideal Zone", color: "rgba(16,185,129,0.7)" }
          });

          // --- 3-zone shaded bands (very subtle) ---
          // Zone: 20% to 32.5% = Amber transition zone
          if (y.min !== undefined && y.max !== undefined && 32.5 >= y.min && 20 <= y.max) {
            const y32 = y.getPixelForValue(32.5);
            const y20 = y.getPixelForValue(20);
            if (y32 !== undefined && y20 !== undefined && y20 > y32) {
              ctx.fillStyle = "rgba(245,158,11,0.04)";
              ctx.fillRect(left, y32, right - left, y20 - y32);
            }
          }

          ctx.restore();
        }
      }]

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
              label: function (context) {
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
              label: function (context) {
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
              label: function (context) {
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
              label: function (context) {
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
      if (!meta) return; // Skip unknown keys gracefully to prevent crashes
      const th = document.createElement("th");
      th.className = "sortable-header draggable-header";
      th.setAttribute("data-sort-key", key);
      th.setAttribute("draggable", "true");

      if (currentSortColumn === key) {
        th.classList.add(currentSortAsc ? "sorted-asc" : "sorted-desc");
      }

      th.innerHTML = `${meta.label} <i class="fa-solid ${currentSortColumn === key ? (currentSortAsc ? "fa-caret-up" : "fa-caret-down") : "fa-sort"}"></i>`;

      th.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", key);
        th.classList.add("dragging");
      });

      th.addEventListener("dragend", () => {
        th.classList.remove("dragging");
        // Remove all drag-over highlights
        document.querySelectorAll(".draggable-header").forEach(h => h.classList.remove("drag-over"));
      });

      th.addEventListener("dragover", (e) => {
        e.preventDefault();
        document.querySelectorAll(".draggable-header").forEach(h => h.classList.remove("drag-over"));
        th.classList.add("drag-over");
      });

      th.addEventListener("dragleave", () => {
        th.classList.remove("drag-over");
      });

      th.addEventListener("drop", (e) => {
        e.preventDefault();
        th.classList.remove("drag-over");
        const draggedKey = e.dataTransfer.getData("text/plain");
        if (draggedKey && draggedKey !== key) {
          const fromIdx = columnOrder.indexOf(draggedKey);
          const toIdx = columnOrder.indexOf(key);
          if (fromIdx !== -1 && toIdx !== -1) {
            columnOrder.splice(fromIdx, 1);
            columnOrder.splice(toIdx, 0, draggedKey);
            // Persist to localStorage so order survives page reloads
            localStorage.setItem("column_order", JSON.stringify(columnOrder));
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
              callback: function (value) {
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
              label: function (context) {
                const val = context.raw;
                return ` ${metricMeta.name}: ${formatMetricValue(val, metricKey)}`;
              }
            }
          }
        }
      },
      plugins: [{
        id: "compareSpreadLine",
        afterDraw(chart) {
          if (metricKey !== "borrowing_spread") return;
          const { ctx, chartArea: { top, bottom, left, right }, scales: { x } } = chart;
          const LIMIT = 50;
          if (!x || x.min === undefined || x.max === undefined || LIMIT < x.min || LIMIT > x.max) return;

          const xPx = x.getPixelForValue(LIMIT);
          ctx.save();

          // Dashed vertical line
          ctx.beginPath();
          ctx.setLineDash([7, 5]);
          ctx.moveTo(xPx, top);
          ctx.lineTo(xPx, bottom);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
          ctx.stroke();
          ctx.setLineDash([]);

          // Pill label at top of the line
          const label = "Market Stress Limit: 50 bps";
          ctx.font = "bold 10px 'Outfit', sans-serif";
          const tw = ctx.measureText(label).width;
          const px = xPx - tw / 2 - 4;
          const py = top + 4;
          ctx.fillStyle = "rgba(239,68,68,0.15)";
          ctx.beginPath();
          ctx.roundRect(px, py, tw + 8, 17, 4);
          ctx.fill();
          ctx.strokeStyle = "rgba(239,68,68,0.55)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = "#ef4444";
          ctx.textAlign = "left";
          ctx.fillText(label, px + 4, py + 12);

          // Zone labels at the bottom of the chart
          ctx.font = "9px 'Outfit', sans-serif";
          // Left zone (under 50 bps)
          const leftMid = left + (xPx - left) / 2;
          ctx.fillStyle = "rgba(16,185,129,0.7)";
          ctx.textAlign = "center";
          ctx.fillText("Normal Spread ◀", leftMid, bottom - 6);

          // Right zone (above 50 bps)
          const rightMid = xPx + (right - xPx) / 2;
          ctx.fillStyle = "rgba(239,68,68,0.65)";
          ctx.textAlign = "center";
          ctx.fillText("Elevated Stress ▶", rightMid, bottom - 6);

          ctx.restore();
        }
      }]
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
        revenue_exp_to_sotr: getMetricValue(s.id, 'revenue_exp_to_sotr', yearIdx),
        capital_outlay: fiscalData.metrics.capital_outlay[s.id][yearIdx],
        capital_outlay_abs: getMetricValue(s.id, 'capital_outlay_abs', yearIdx),
        debt_gsdp: debt_pct,
        pc_gsdp: pc_gsdp_val,
        pc_debt: pc_debt_val,
        central_transfers: fiscalData.metrics.central_transfers[s.id][yearIdx],
        central_transfers_abs: getMetricValue(s.id, 'central_transfers_abs', yearIdx),
        borrowing_spread: fiscalData.metrics.borrowing_spread[s.id][yearIdx],
        deficit_to_sotr: getMetricValue(s.id, 'deficit_to_sotr', yearIdx),
        direct_central_investment: getMetricValue(s.id, 'direct_central_investment', yearIdx)
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
      "revenue_exp_to_sotr",
      "capital_outlay",
      "capital_outlay_abs",
      "debt_gsdp",
      "pc_gsdp",
      "pc_debt",
      "central_transfers",
      "central_transfers_abs",
      "borrowing_spread",
      "direct_central_investment"
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
        "revenue_exp_to_sotr",
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

      const minOpacity = isVibrantHeatmap ? 0.25 : 0.10;
      const maxOpacity = isVibrantHeatmap ? 0.65 : 0.30;
      const dist = Math.abs(p - 0.5) * 2;
      const opacity = minOpacity + dist * (maxOpacity - minOpacity);

      // Force high-contrast text color when cell opacity is high
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      let textColor = "var(--text-primary)";
      if (opacity > 0.35) {
        textColor = isDark ? "#ffffff" : "#0f172a";
      }

      return `style="background-color: rgba(${r}, ${g}, ${b}, ${opacity.toFixed(3)}); font-weight: 600; color: ${textColor};"`;
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
      { key: "gsdp_absolute", label: "GSDP\n(₹ Bn)", higherBetter: true },
      { key: "total_budget", label: "Total\nBudget (₹ Bn)", higherBetter: true },
      { key: "budget_gsdp", label: "Budget\n% GSDP", higherBetter: false },
      { key: "total_revenue", label: "Revenue\n(₹ Bn)", higherBetter: true },
      { key: "revenue_gsdp", label: "Revenue\n% GSDP", higherBetter: true },
      { key: "gsdp_growth", label: "GSDP\nGrowth %", higherBetter: true },
      { key: "fiscal_deficit", label: "Fiscal\nDeficit %", higherBetter: false },
      { key: "fiscal_deficit_abs", label: "Deficit\n(₹ Bn)", higherBetter: false },
      { key: "revenue_exp_gsdp", label: "Rev Exp\n% GSDP", higherBetter: false },
      { key: "revenue_exp_abs", label: "Rev Exp\n(₹ Bn)", higherBetter: false },
      { key: "capital_outlay", label: "Capex\n% GSDP", higherBetter: true },
      { key: "capital_outlay_abs", label: "Capex\n(₹ Bn)", higherBetter: true },
      { key: "debt_gsdp", label: "Debt\n% GSDP", higherBetter: false },
      { key: "pc_gsdp", label: "Per Cap\nGSDP (₹)", higherBetter: true },
      { key: "pc_debt", label: "Per Cap\nDebt (₹)", higherBetter: false },
      { key: "central_transfers", label: "C.Transfers\n% Revenue", higherBetter: false },
      { key: "central_transfers_abs", label: "C.Transfers\n(₹ Bn)", higherBetter: false },
      { key: "borrowing_spread", label: "SDL\nSpread bps", higherBetter: false }
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
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx2d.scale(dpr, dpr);

    const padL = 90, padR = 30, padT = 44, padB = 55;
    const axisCount = axes.length;
    const axisSpacing = (W - padL - padR) / (axisCount - 1);
    const axisX = i => padL + i * axisSpacing;
    const yForVal = v => padT + (1 - v) * (H - padT - padB);


    // Helper to draw one state's bezier path
    function drawStatePath(s, pts, lineWidth, alpha, glow) {
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
      if (glow) {
        ctx2d.shadowColor = s.color;
        ctx2d.shadowBlur = glow;
      }
      ctx2d.strokeStyle = s.color + alpha;
      ctx2d.lineWidth = lineWidth;
      ctx2d.stroke();
      ctx2d.shadowBlur = 0;
    }

    // Build axes once per redraw (extracted helper)
    function drawAxes() {
      for (let i = 0; i < axisCount; i++) {
        const x = axisX(i);
        ctx2d.beginPath();
        ctx2d.moveTo(x, padT);
        ctx2d.lineTo(x, H - padB);
        ctx2d.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
        ctx2d.lineWidth = 1;
        ctx2d.stroke();
        // Green arrow tip
        ctx2d.beginPath();
        ctx2d.moveTo(x - 4, padT + 9);
        ctx2d.lineTo(x, padT + 1);
        ctx2d.lineTo(x + 4, padT + 9);
        ctx2d.strokeStyle = "#10b981";
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();
        // Axis label bottom
        const labelLines = axes[i].label.split("\n");
        ctx2d.fillStyle = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.6)";
        ctx2d.font = "bold 10px 'Outfit', sans-serif";
        ctx2d.textAlign = "center";
        labelLines.forEach((line, li) => {
          ctx2d.fillText(line, x, H - padB + 15 + li * 13);
        });
        // "Better ↑" tip text
        ctx2d.font = "8px 'Outfit', sans-serif";
        ctx2d.fillStyle = "#10b981";
        ctx2d.fillText("Better ↑", x, padT - 4);
      }
    }

    let hoveredState = null;

    function drawLines(highlightId) {
      ctx2d.clearRect(0, 0, W, H);
      drawAxes();

      // First pass — all states glow with their color
      stateData.forEach(s => {
        const pts = axes.map((_, i) => {
          const n = normalizeVal(s.vals[i], i);
          return n === null ? null : { x: axisX(i), y: yForVal(n) };
        });

        const isHighlighted = s.id === highlightId;
        const hasHighlight = !!highlightId;

        // Line glow and style
        const lineWidth = isHighlighted ? 3 : (hasHighlight ? 1.2 : 2);
        const alpha = isHighlighted ? "FF" : (hasHighlight ? "30" : "CC");
        const glow = isHighlighted ? 18 : (hasHighlight ? 0 : 8);

        drawStatePath(s, pts, lineWidth, alpha, glow);

        // Dots at each axis
        pts.forEach(pt => {
          if (!pt) return;
          ctx2d.beginPath();
          ctx2d.arc(pt.x, pt.y, isHighlighted ? 5 : 3, 0, Math.PI * 2);
          if (isHighlighted) {
            ctx2d.shadowColor = s.color; ctx2d.shadowBlur = 10;
          }
          ctx2d.fillStyle = s.color + (hasHighlight && !isHighlighted ? "35" : "DD");
          ctx2d.fill();
          ctx2d.shadowBlur = 0;
          if (isHighlighted) {
            ctx2d.strokeStyle = isDark ? "#1a1d2e" : "#fff";
            ctx2d.lineWidth = 1.5; ctx2d.stroke();
          }
        });

        // State name always left of first non-null point
        const firstPt = pts.find(p => p);
        if (firstPt) {
          const nameAlpha = hasHighlight && !isHighlighted ? "40" : "EE";
          ctx2d.font = isHighlighted
            ? "bold 11px 'Outfit', sans-serif"
            : "10px 'Outfit', sans-serif";
          ctx2d.fillStyle = s.color + nameAlpha;
          ctx2d.textAlign = "right";
          ctx2d.fillText(s.name, firstPt.x - 8, firstPt.y + 4);
        }

        // On hover: draw directional arrows along the highlighted state's path
        if (isHighlighted) {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
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

          // Value labels on hover
          pts.forEach((pt, i) => {
            if (!pt) return;
            const rawVal = s.vals[i];
            const label = rawVal !== null ? formatMetricValue(rawVal, axes[i].key) : "";
            if (!label) return;
            ctx2d.font = "bold 9px 'Outfit', sans-serif";
            ctx2d.fillStyle = isDark ? "rgba(255,255,255,0.95)" : "#111";
            ctx2d.textAlign = "center";
            ctx2d.fillText(label, pt.x, pt.y - 10);
          });

          // Hovered state name top-left (big)
          ctx2d.font = "bold 13px 'Outfit', sans-serif";
          ctx2d.fillStyle = s.color;
          ctx2d.shadowColor = s.color;
          ctx2d.shadowBlur = 8;
          ctx2d.textAlign = "left";
          ctx2d.fillText(`▶ ${s.name}`, padL, padT - 20);
          ctx2d.shadowBlur = 0;
        }
      });
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
    if (!yearIdxStr) return;
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
            ticks: { color: t.textSecondary, callback: function (value) { return '\u20B9' + value; } }
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
                  `Transfers (Abs): \u20B9${ctx.raw.y.toLocaleString('en-US', { minimumFractionDigits: 2 })} Bn`
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

  // --- Render Deficit & Quality Trajectory (Trellis/Facet Plot) ---
  // --- Render Deficit & Quality Trajectory (Combined Single View) ---
  function renderDeficitTrajectoryTab(t) {
    const states = fiscalData.states;
    const canvasId = 'chart-deficit-combined';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const chartKey = 'deficit-trajectory-combined';
    if (charts[chartKey]) charts[chartKey].destroy();

    const labels = [...fiscalData.years];
    const datasets = states.map(state => {
      const data = fiscalData.years.map((_, yearIdx) => {
        const val = getMetricValue(state.id, "deficit_to_sotr", yearIdx);
        return val === null ? null : Math.max(0, -val);
      });

      return {
        label: state.name,
        data: data,
        borderColor: state.color,
        backgroundColor: state.color + '0C',
        borderWidth: 2.5,
        pointBackgroundColor: state.color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.15,
        order: 1
      };
    });

    const zeroLineDataset = {
      label: 'Zero Line',
      data: labels.map(() => 0),
      borderColor: t.textSecondary + '66',
      borderWidth: 1.25,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      order: 2
    };

    charts[chartKey] = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
        datasets: [...datasets, zeroLineDataset]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
        scales: {
          x: {
            grid: { color: t.gridColor },
            ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
          },
          y: {
            min: 0,
            max: 200,
            grid: { color: t.gridColor },
            ticks: {
              color: t.textSecondary,
              font: { size: 9, family: "'Outfit', sans-serif" },
              callback: function (value) { return value.toFixed(0) + '%'; }
            },
            title: {
              display: true,
              text: "Own Revenue Deficit (% of SOTR)",
              color: t.textSecondary,
              font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: t.textColor,
              font: { size: 11, family: "'Outfit', sans-serif" },
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                if (ctx.raw === null) return '';
                if (ctx.dataset.label === 'Zero Line') return '';
                return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });
  }

  // --- Render Debt Sustainability Trajectory (Trellis/Facet Plots) ---
  // --- Render Debt Sustainability Trajectory (Combined Single View) ---
  function renderSustainabilityTrajectoryTab(t) {
    const states = fiscalData.states;
    const labels = [...fiscalData.years];

    // Helper to generate simple combined datasets (one line per state)
    function makeCombinedDataset(metricKey) {
      return states.map(state => {
        const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, metricKey, yearIdx));
        return {
          label: state.name,
          data: data,
          borderColor: state.color,
          backgroundColor: state.color + '0C',
          borderWidth: 2.5,
          pointBackgroundColor: state.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15
        };
      });
    }

    // 1A. Interest-to-Own-Revenue Chart
    const interestOwnCtx = document.getElementById('chart-interest-own-combined');
    if (interestOwnCtx) {
      const ownKey = 'interest-own-trajectory-combined';
      if (charts[ownKey]) charts[ownKey].destroy();

      const datasets = states.map(state => {
        const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, "interest_to_own_revenue", yearIdx));
        return {
          label: state.name,
          data: data,
          borderColor: state.color,
          backgroundColor: state.color + '0C',
          borderWidth: 2.5,
          pointBackgroundColor: state.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15
        };
      });

      charts[ownKey] = new Chart(interestOwnCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 10,
              max: 50,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(0) + '%'; }
              },
              title: {
                display: true,
                text: "Interest / Own Revenue Receipts",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
                }
              }
            }
          }
        }
      });
    }

    // 1B. Interest-to-Total-Revenue Chart
    const interestTotalCtx = document.getElementById('chart-interest-total-combined');
    if (interestTotalCtx) {
      const totalKey = 'interest-total-trajectory-combined';
      if (charts[totalKey]) charts[totalKey].destroy();

      const fcLimitDataset = {
        label: '15th FC Limit (10%)',
        data: labels.map(() => 10),
        borderColor: 'rgba(239, 68, 68, 0.85)',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        order: 2
      };

      const datasets = states.map(state => {
        const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, "interest_revenue", yearIdx));
        return {
          label: state.name,
          data: data,
          borderColor: state.color,
          backgroundColor: state.color + '0C',
          borderWidth: 2.5,
          pointBackgroundColor: state.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15,
          order: 1
        };
      });

      charts[totalKey] = new Chart(interestTotalCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: [...datasets, fcLimitDataset]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 5,
              max: 25,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(0) + '%'; }
              },
              title: {
                display: true,
                text: "Interest / Total Revenue Receipts",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.label.includes('FC Limit')) return '15th FC Limit (Total Rev): 10.0%';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
                }
              }
            }
          }
        }
      });
    }

    // 2. Debt-to-GSDP Charts
    const debtCtx = document.getElementById('chart-debt-combined');
    if (debtCtx) {
      const debtKey = 'debt-trajectory-combined';
      if (charts[debtKey]) charts[debtKey].destroy();

      const fcTargetDataset = {
        label: '15th FC Target (32.5%)',
        data: labels.map(() => 32.5),
        borderColor: 'rgba(239, 68, 68, 0.85)',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 2
      };

      const datasets = states.map(state => {
        const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, "debt_gsdp", yearIdx));
        return {
          label: state.name,
          data: data,
          borderColor: state.color,
          backgroundColor: state.color + '0C',
          borderWidth: 2.5,
          pointBackgroundColor: state.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15,
          order: 1
        };
      });

      charts[debtKey] = new Chart(debtCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: [...datasets, fcTargetDataset]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 10,
              max: 50,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(0) + '%'; }
              },
              title: {
                display: true,
                text: "Debt Outstanding (% of GSDP)",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.label.includes('FC Target')) return '15th FC Target Ceiling: 32.5%';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
                }
              }
            }
          }
        }
      });
    }

    // 3. Contingent Liabilities (Outstanding Guarantees)
    const guarCtx = document.getElementById('chart-guar-combined');
    if (guarCtx) {
      const guarKey = 'guar-trajectory-combined';
      if (charts[guarKey]) charts[guarKey].destroy();

      const prudentCeilingDataset = {
        label: 'Prudent Ceiling Limit (2.0%)',
        data: labels.map(() => 2.0),
        borderColor: 'rgba(239, 68, 68, 0.85)',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        order: 2
      };

      const datasets = states.map(state => {
        const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, "outstanding_guarantees", yearIdx));
        return {
          label: state.name,
          data: data,
          borderColor: state.color,
          backgroundColor: state.color + '0C',
          borderWidth: 2.5,
          pointBackgroundColor: state.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15,
          order: 1
        };
      });

      charts[guarKey] = new Chart(guarCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: [...datasets, prudentCeilingDataset]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 0,
              max: 20,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(1) + '%'; }
              },
              title: {
                display: true,
                text: "Outstanding Guarantees (% of GSDP)",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.label.includes('Ceiling')) return 'Prudent Ceiling Limit: 2.0%';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`;
                }
              }
            }
          }
        }
      });
    }
  }

  // --- Render Revenue Quality Trajectory (Trellis/Facet Plots) ---
  // --- Render Revenue Quality Trajectory (Combined Single View) ---
  function renderRevenueTrajectoryTab(t) {
    const states = fiscalData.states;
    const canvasId = 'chart-revqual-combined';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const chartKey = 'revqual-trajectory-combined';
    if (charts[chartKey]) charts[chartKey].destroy();

    const labels = [...fiscalData.years];
    const datasets = states.map(state => {
      const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, "own_tax_gsdp", yearIdx));
      return {
        label: state.name,
        data: data,
        borderColor: state.color,
        backgroundColor: state.color + '0C',
        borderWidth: 2.5,
        pointBackgroundColor: state.color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.15
      };
    });

    charts[chartKey] = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
        scales: {
          x: {
            grid: { color: t.gridColor },
            ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
          },
          y: {
            min: 4,
            max: 9,
            grid: { color: t.gridColor },
            ticks: {
              color: t.textSecondary,
              font: { size: 9, family: "'Outfit', sans-serif" },
              callback: function (value) { return value.toFixed(0) + '%'; }
            },
            title: {
              display: true,
              text: "Own Tax Revenue (% of GSDP)",
              color: t.textSecondary,
              font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: t.textColor,
              font: { size: 11, family: "'Outfit', sans-serif" },
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                if (ctx.raw === null) return '';
                return `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`;
              }
            }
          }
        }
      }
    });
  }

  // --- Render Expenditure Quality Trajectory (Combined Single View) ---
  function renderExpenditureTrajectoryTab(t) {
    const states = fiscalData.states;
    const labels = [...fiscalData.years];

    // Helper to generate combined dataset objects for Chart.js
    function makeCombinedDataset(metricKey) {
      return states.map(state => {
        const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, metricKey, yearIdx));
        return {
          label: state.name,
          data: data,
          borderColor: state.color,
          backgroundColor: state.color + '0C',
          borderWidth: 2.5,
          pointBackgroundColor: state.color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.15
        };
      });
    }

    // 1. Capital Outlay
    const capCtx = document.getElementById('chart-expcap-combined');
    if (capCtx) {
      const capKey = 'expcap-trajectory-combined';
      if (charts[capKey]) charts[capKey].destroy();

      charts[capKey] = new Chart(capCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: makeCombinedDataset('capital_outlay')
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 0.5,
              max: 4.5,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(1) + '%'; }
              },
              title: {
                display: true,
                text: "Capital Outlay (% of GSDP)",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`;
                }
              }
            }
          }
        }
      });
    }

    // 2. Committed Expenditure
    const commitCtx = document.getElementById('chart-expcommit-combined');
    if (commitCtx) {
      const commitKey = 'expcommit-trajectory-combined';
      if (charts[commitKey]) charts[commitKey].destroy();

      charts[commitKey] = new Chart(commitCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: makeCombinedDataset('committed_exp')
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 40,
              max: 70,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(0) + '%'; }
              },
              title: {
                display: true,
                text: "Committed Expenditure (% of Revenue Receipts)",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
                }
              }
            }
          }
        }
      });
    }

    // 3. Subsidies
    const subCtx = document.getElementById('chart-expsub-combined');
    if (subCtx) {
      const subKey = 'expsub-trajectory-combined';
      if (charts[subKey]) charts[subKey].destroy();

      charts[subKey] = new Chart(subCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
          datasets: makeCombinedDataset('subsidies')
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
          scales: {
            x: {
              grid: { color: t.gridColor },
              ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
            },
            y: {
              min: 0,
              max: 20,
              grid: { color: t.gridColor },
              ticks: {
                color: t.textSecondary,
                font: { size: 9, family: "'Outfit', sans-serif" },
                callback: function (value) { return value.toFixed(1) + '%'; }
              },
              title: {
                display: true,
                text: "Subsidy Expenditure (% of Revenue Receipts)",
                color: t.textSecondary,
                font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
              }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { size: 11, family: "'Outfit', sans-serif" },
                boxWidth: 12,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  return `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`;
                }
              }
            }
          }
        }
      });
    }
  }

  // --- Render Central Transfers Trajectory (Combined Single View) ---
  function renderTransfersTrajectoryTab(t) {
    const states = fiscalData.states;
    const canvasId = 'chart-transfers-combined';
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const chartKey = 'transfers-trajectory-combined';
    if (charts[chartKey]) charts[chartKey].destroy();

    const labels = [...fiscalData.years];
    const datasets = states.map(state => {
      const data = fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, "central_transfers", yearIdx));
      return {
        label: state.name,
        data: data,
        borderColor: state.color,
        backgroundColor: state.color + '0C', // Very light fill transparency or off
        borderWidth: 2.5,
        pointBackgroundColor: state.color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.15
      };
    });

    charts[chartKey] = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels.map(y => y.replace(" (RE)", "").replace(" (BE)", "")),
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
        scales: {
          x: {
            grid: { color: t.gridColor },
            ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } }
          },
          y: {
            min: 10,
            max: 70,
            grid: { color: t.gridColor },
            ticks: {
              color: t.textSecondary,
              font: { size: 9, family: "'Outfit', sans-serif" },
              callback: function (value) { return value.toFixed(0) + '%'; }
            },
            title: {
              display: true,
              text: "Central Transfers (% of Revenue Receipts)",
              color: t.textSecondary,
              font: { size: 10, weight: 600, family: "'Outfit', sans-serif" }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: t.textColor,
              font: { size: 11, family: "'Outfit', sans-serif" },
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipText,
            bodyColor: t.textColor,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                if (ctx.raw === null) return '';
                return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });

    // Federal Favoritism: Direct Central Investment & Projects
    buildTrajectoryChart(
      'chart-transfers-central-investment',
      'transfersCentralInvestment',
      'direct_central_investment_rr',
      'Direct Central Investment (% of Revenue Receipts)',
      0,
      80,
      2,
      t
    );

    // Section 3: Grants-in-Aid (Article 275)
    buildTrajectoryChart(
      'chart-transfers-grants',
      'transfersGrants',
      'grants_in_aid_rr',
      'Grants-in-Aid (% of Revenue Receipts)',
      0,
      30,
      2,
      t
    );

    // Section 4: Centrally Sponsored Schemes (CSS)
    buildTrajectoryChart(
      'chart-transfers-css',
      'transfersCSS',
      'css_schemes_rr',
      'Centrally Sponsored Schemes (% of Revenue Receipts)',
      0,
      40,
      2,
      t
    );

    // Section 5: Net Central Resource Transfers (Federal transfers minus state GST outflow)
    buildTrajectoryChart(
      'chart-transfers-contribution-return',
      'aggregateTransfers',
      'net_central_transfers',
      'Net Central Transfers (% of Revenue Receipts)',
      null,
      null,
      2,
      t
    );

    // Section 6: Total Generated Revenues (Rupees Billion)
    buildTrajectoryChart(
      'chart-transfers-gst-outflow',
      'transfersGSTOutflow',
      'absolute_generated_revenues',
      'Total Generated Revenues (Rupees Billion)',
      0,
      null,
      1,
      t
    );

    // Section 7: GST Transferred to Centre (% of Total Generated Revenues)
    buildTrajectoryChart(
      'chart-transfers-gst-share',
      'transfersGSTShare',
      'gst_share_of_generated',
      'GST Transferred to Centre (% of All State-Generated Tax Revenue)',
      0,
      60,
      2,
      t
    );

    // Section 8: Federal Transfers Received vs Total Taxes Paid (%)
    buildTrajectoryChart(
      'chart-transfers-dev-return',
      'transfersDevReturn',
      'devolution_to_gst_ratio',
      'Federal Budgetary Transfers Received vs Total Taxes Paid (%)',
      0,
      150,
      2,
      t
    );
  }

  // --- Render Education Efficacy & Retention Metrics Tab ---
  function renderEducationTab(t) {
    const stateId = activeStateId;
    const yearSelect = document.getElementById("education-year-select");
    const yearIdx = yearSelect ? parseInt(yearSelect.value) : (fiscalData.years.length - 1);
    const selectedYearName = fiscalData.years[yearIdx];

    // Helper: create a comparative bar chart for one education metric
    function createEduCompareChart(canvasId, chartKey, metricKey, label, unit, refLine) {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      if (charts[chartKey]) charts[chartKey].destroy();

      const statesList = [...fiscalData.states];
      const labels = statesList.map(s => s.name);
      const data = statesList.map(s => getMetricValue(s.id, metricKey, yearIdx));

      // Opacity styling: selected state is fully opaque, others are semi-transparent
      const bgColors = statesList.map(s => {
        if (s.id === stateId) return s.color;
        return s.color + '55'; // 33% opacity
      });

      const borderColors = statesList.map(s => {
        if (s.id === stateId) return '#ffffff'; // White border to highlight active state
        return s.color;
      });

      const borderWidths = statesList.map(s => {
        if (s.id === stateId) return 3;
        return 1;
      });

      const datasets = [{
        label: `${label} (${selectedYearName})`,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        maxBarThickness: 70,
        categoryPercentage: 1.0,
        barPercentage: 1.0,
        order: 1
      }];

      // Optional reference / target line
      if (refLine) {
        datasets.push({
          type: 'line',
          label: refLine.label,
          data: statesList.map(() => refLine.value),
          borderColor: refLine.color || 'rgba(99,102,241,0.6)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 0
        });
      }

      charts[chartKey] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t.textSecondary, font: { size: 10, weight: 500 } }
            },
            y: {
              grid: { color: t.gridColor },
              title: {
                display: true,
                text: unit,
                color: t.textSecondary,
                font: { weight: 600, family: "'Outfit', sans-serif" }
              },
              ticks: { color: t.textSecondary }
            }
          },
          plugins: {
            legend: {
              display: refLine ? true : false,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { family: "'Outfit', sans-serif", size: 10 },
                // Only show legend for line target datasets to keep clean
                filter: (item) => item.text && (item.text.includes('Target') || item.text.includes('Line') || item.text.includes('Norm'))
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.type === 'line') return `${ctx.dataset.label}: ${ctx.raw}`;
                  const stateName = ctx.label;
                  const val = ctx.raw;
                  if (unit.includes('Index') || unit.includes('Ratio')) return `${stateName}: ${val.toFixed(2)}`;
                  return `${stateName}: ${val.toFixed(1)}${unit.includes('%') ? '%' : ''}`;
                }
              }
            }
          }
        }
      });
    }

    // --- Chart 1: Secondary School Dropout Rate ---
    createEduCompareChart(
      'chart-edu-dropout', 'eduDropout', 'edu_dropout_secondary',
      'Secondary Dropout Rate', 'Dropout Rate (%)', null
    );

    // --- Chart 2: Gross Enrolment Ratio ---
    createEduCompareChart(
      'chart-edu-ger', 'eduGer', 'edu_ger_secondary',
      'Gross Enrolment Ratio (GER)', 'GER (%)',
      { value: 100, label: '100% Universal Target', color: 'rgba(16,185,129,0.5)' }
    );

    // --- Chart 3: Pupil-Teacher Ratio ---
    createEduCompareChart(
      'chart-edu-ptr', 'eduPtr', 'edu_ptr_secondary',
      'Pupil-Teacher Ratio', 'Pupils per Teacher',
      { value: 20, label: 'NEP 2020 Norm (20:1)', color: 'rgba(99,102,241,0.5)' }
    );

    // --- Chart 4: Net Enrolment Rate ---
    createEduCompareChart(
      'chart-edu-ner', 'eduNer', 'edu_ner_secondary',
      'Net Enrolment Rate (NER)', 'NER (%)',
      { value: 100, label: '100% Universal Target', color: 'rgba(16,185,129,0.5)' }
    );

    // --- Chart 5: Gender Parity Index ---
    createEduCompareChart(
      'chart-edu-gpi', 'eduGpi', 'edu_gpi_secondary',
      'Gender Parity Index', 'GPI (Index)',
      { value: 1.0, label: 'Parity Line (1.0)', color: 'rgba(168,85,247,0.5)' }
    );

    // --- Chart 6: Social Spending vs Dropout Bubble (All States for the selected year) ---
    const ctxMatrix = document.getElementById("chart-education-matrix");
    if (!ctxMatrix) return;
    if (charts["educationMatrix"]) charts["educationMatrix"].destroy();

    const bubbleDatasets = [];
    fiscalData.states.forEach(st => {
      const socialExp = getMetricValue(st.id, "edu_social_exp_gsdp", yearIdx);
      const dropout = getMetricValue(st.id, "edu_dropout_secondary", yearIdx);
      const gsdp = getMetricValue(st.id, "gsdp_absolute", yearIdx) || 0;
      if (socialExp === null || dropout === null) return;

      const r = Math.max(8, Math.min(30, (gsdp / 1000) * 1.5 + 6));
      const isSelected = st.id === stateId;
      bubbleDatasets.push({
        label: st.name,
        data: [{ x: socialExp, y: dropout, r: isSelected ? r * 1.3 : r }],
        backgroundColor: isSelected ? st.color : st.color + '88',
        borderColor: isSelected ? '#fff' : st.color,
        borderWidth: isSelected ? 3 : 1.5,
        hoverBackgroundColor: st.color,
        hoverBorderWidth: 2.5,
        stateId: st.id
      });
    });

    charts["educationMatrix"] = new Chart(ctxMatrix.getContext('2d'), {
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
              text: `Social Sector Expenditure (% of GSDP) - ${selectedYearName}`,
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: `Secondary School Dropout Rate (%) - ${selectedYearName}`,
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
              label: (ctx) => {
                const ds = ctx.dataset;
                return [
                  ds.label,
                  `Social Spending: ${ctx.raw.x.toFixed(1)}% GSDP`,
                  `Dropout Rate: ${ctx.raw.y.toFixed(1)}%`
                ];
              }
            }
          }
        }
      },
      plugins: [{
        id: "eduQuadrantLines",
        afterDraw(chart) {
          const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
          if (!x || !y) return;
          const xMidVal = 8.5;
          const yMidVal = 10.0;
          if (x.min === undefined || x.max === undefined || y.min === undefined || y.max === undefined) return;

          const xPx = x.getPixelForValue(xMidVal);
          const yPx = y.getPixelForValue(yMidVal);

          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";

          if (xPx >= left && xPx <= right) {
            ctx.beginPath();
            ctx.moveTo(xPx, top);
            ctx.lineTo(xPx, bottom);
            ctx.stroke();
          }
          if (yPx >= top && yPx <= bottom) {
            ctx.beginPath();
            ctx.moveTo(left, yPx);
            ctx.lineTo(right, yPx);
            ctx.stroke();
          }

          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✓ Efficient Low-Dropout", left + 10, bottom - 10);
          ctx.textAlign = "right";
          ctx.fillText("✓ Prudent High-Spending", right - 10, bottom - 10);
          ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✗ Vulnerable Low-Spending", left + 10, top + 15);
          ctx.textAlign = "right";
          ctx.fillText("⚠ Low Efficacy High-Spending", right - 10, top + 15);

          ctx.restore();
        }
      }]
    });
  }

  // --- Render Healthcare Efficacy & Life Quality Tab ---
  function renderHealthcareTab(t) {
    const stateId = activeStateId;
    const yearSelect = document.getElementById("healthcare-year-select");
    const yearIdx = yearSelect ? parseInt(yearSelect.value) : (fiscalData.years.length - 1);
    const selectedYearName = fiscalData.years[yearIdx];

    // Helper: create a comparative bar chart for one healthcare metric
    function createHealthCompareChart(canvasId, chartKey, metricKey, label, unit, refLine) {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      if (charts[chartKey]) charts[chartKey].destroy();

      const statesList = [...fiscalData.states];
      const labels = statesList.map(s => s.name);
      const data = statesList.map(s => getMetricValue(s.id, metricKey, yearIdx));

      // Opacity styling: selected state is fully opaque, others are semi-transparent
      const bgColors = statesList.map(s => {
        if (s.id === stateId) return s.color;
        return s.color + '55'; // 33% opacity
      });

      const borderColors = statesList.map(s => {
        if (s.id === stateId) return '#ffffff'; // White border to highlight active state
        return s.color;
      });

      const borderWidths = statesList.map(s => {
        if (s.id === stateId) return 3;
        return 1;
      });

      const datasets = [{
        label: `${label} (${selectedYearName})`,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        maxBarThickness: 70,
        categoryPercentage: 1.0,
        barPercentage: 1.0,
        order: 1
      }];

      // Optional reference / target line
      if (refLine) {
        datasets.push({
          type: 'line',
          label: refLine.label,
          data: statesList.map(() => refLine.value),
          borderColor: refLine.color || 'rgba(99,102,241,0.6)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 0
        });
      }

      charts[chartKey] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t.textSecondary, font: { size: 10, weight: 500 } }
            },
            y: {
              grid: { color: t.gridColor },
              title: {
                display: true,
                text: unit,
                color: t.textSecondary,
                font: { weight: 600, family: "'Outfit', sans-serif" }
              },
              ticks: { color: t.textSecondary }
            }
          },
          plugins: {
            legend: {
              display: refLine ? true : false,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { family: "'Outfit', sans-serif", size: 10 },
                filter: (item) => item.text && (item.text.includes('Target') || item.text.includes('Line') || item.text.includes('Norm'))
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.type === 'line') return `${ctx.dataset.label}: ${ctx.raw}`;
                  const stateName = ctx.label;
                  const val = ctx.raw;
                  if (metricKey === "health_life_expectancy") return `${stateName}: ${val.toFixed(1)} Years`;
                  if (metricKey === "health_mmr") return `${stateName}: ${Math.round(val)}`;
                  if (unit.includes('Index') || unit.includes('Ratio')) return `${stateName}: ${val.toFixed(2)}`;
                  return `${stateName}: ${val.toFixed(1)}${unit.includes('%') ? '%' : ''}`;
                }
              }
            }
          }
        }
      });
    }

    // --- Chart 1: Out-of-Pocket Expenditure (OOPE) ---
    createHealthCompareChart(
      'chart-health-oope', 'healthOope', 'health_oope',
      'Out-of-Pocket Expenditure', 'Share of Health Spend (%)', null
    );

    // --- Chart 2: Infant Mortality Rate (IMR) ---
    createHealthCompareChart(
      'chart-health-imr', 'healthImr', 'health_imr',
      'Infant Mortality Rate (IMR)', 'Deaths per 1,000 Live Births', null
    );

    // --- Chart 3: Maternal Mortality Ratio (MMR) ---
    createHealthCompareChart(
      'chart-health-mmr', 'healthMmr', 'health_mmr',
      'Maternal Mortality Ratio (MMR)', 'Deaths per 100,000 Live Births', null
    );

    // --- Chart 4: Institutional Deliveries (%) ---
    createHealthCompareChart(
      'chart-health-inst-deliveries', 'healthInstDeliveries', 'health_inst_deliveries',
      'Institutional Deliveries', 'Share of Deliveries (%)',
      { value: 100, label: '100% Universal Deliveries Target', color: 'rgba(16,185,129,0.5)' }
    );

    // --- Chart 5: Life Expectancy ---
    createHealthCompareChart(
      'chart-health-life-expectancy', 'healthLifeExpectancy', 'health_life_expectancy',
      'Life Expectancy at Birth', 'Years',
      { value: 70, label: 'National Target (70 Years)', color: 'rgba(99,102,241,0.5)' }
    );

    // --- Chart 6: Health Spending vs. OOPE Bubble (All States for the selected year) ---
    const ctxMatrix = document.getElementById("chart-health-matrix");
    if (!ctxMatrix) return;
    if (charts["healthMatrix"]) charts["healthMatrix"].destroy();

    const bubbleDatasets = [];
    fiscalData.states.forEach(st => {
      const healthSpend = getMetricValue(st.id, "health_spend_gsdp", yearIdx);
      const oope = getMetricValue(st.id, "health_oope", yearIdx);
      const gsdp = getMetricValue(st.id, "gsdp_absolute", yearIdx) || 0;
      if (healthSpend === null || oope === null) return;

      const r = Math.max(8, Math.min(30, (gsdp / 1000) * 1.5 + 6));
      const isSelected = st.id === stateId;
      bubbleDatasets.push({
        label: st.name,
        data: [{ x: healthSpend, y: oope, r: isSelected ? r * 1.3 : r }],
        backgroundColor: isSelected ? st.color : st.color + '88',
        borderColor: isSelected ? '#fff' : st.color,
        borderWidth: isSelected ? 3 : 1.5,
        hoverBackgroundColor: st.color,
        hoverBorderWidth: 2.5,
        stateId: st.id
      });
    });

    charts["healthMatrix"] = new Chart(ctxMatrix.getContext('2d'), {
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
              text: `Public Health Spending (% of GSDP) - ${selectedYearName}`,
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: `Out-of-Pocket Expenditure (OOPE) (%) - ${selectedYearName}`,
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
              label: (ctx) => {
                const ds = ctx.dataset;
                return [
                  ds.label,
                  `Public Spending: ${ctx.raw.x.toFixed(2)}% GSDP`,
                  `Out-of-Pocket (OOPE): ${ctx.raw.y.toFixed(1)}%`
                ];
              }
            }
          }
        }
      },
      plugins: [{
        id: "healthQuadrantLines",
        afterDraw(chart) {
          const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
          if (!x || !y) return;
          const xMidVal = 1.25; // 1.25% GSDP Health Spending
          const yMidVal = 50.0; // 50.0% OOPE
          if (x.min === undefined || x.max === undefined || y.min === undefined || y.max === undefined) return;

          const xPx = x.getPixelForValue(xMidVal);
          const yPx = y.getPixelForValue(yMidVal);

          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";

          if (xPx >= left && xPx <= right) {
            ctx.beginPath();
            ctx.moveTo(xPx, top);
            ctx.lineTo(xPx, bottom);
            ctx.stroke();
          }
          if (yPx >= top && yPx <= bottom) {
            ctx.beginPath();
            ctx.moveTo(left, yPx);
            ctx.lineTo(right, yPx);
            ctx.stroke();
          }

          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✓ High Efficiency (Low Cost)", left + 10, bottom - 10);
          ctx.textAlign = "right";
          ctx.fillText("✓ Strong Public Cover", right - 10, bottom - 10);
          ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✗ Underfunded (High OOPE)", left + 10, top + 15);
          ctx.textAlign = "right";
          ctx.fillText("⚠ Low Efficacy spending", right - 10, top + 15);

          ctx.restore();
        }
      }]
    });
  }

  // --- Render Nutrition & Social Safety Net Tab ---
  function renderSocialTab(t) {
    const stateId = activeStateId;
    const yearSelect = document.getElementById("social-year-select");
    const yearIdx = yearSelect ? parseInt(yearSelect.value) : (fiscalData.years.length - 1);
    const selectedYearName = fiscalData.years[yearIdx];

    // Helper: create a comparative bar chart for one social/nutrition metric
    function createSocialCompareChart(canvasId, chartKey, metricKey, label, unit, refLine) {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      if (charts[chartKey]) charts[chartKey].destroy();

      const statesList = [...fiscalData.states];
      const labels = statesList.map(s => s.name);
      const data = statesList.map(s => getMetricValue(s.id, metricKey, yearIdx));

      // Opacity styling: selected state is fully opaque, others are semi-transparent
      const bgColors = statesList.map(s => {
        if (s.id === stateId) return s.color;
        return s.color + '55'; // 33% opacity
      });

      const borderColors = statesList.map(s => {
        if (s.id === stateId) return '#ffffff'; // White border to highlight active state
        return s.color;
      });

      const borderWidths = statesList.map(s => {
        if (s.id === stateId) return 3;
        return 1;
      });

      const datasets = [{
        label: `${label} (${selectedYearName})`,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        maxBarThickness: 70,
        categoryPercentage: 1.0,
        barPercentage: 1.0,
        order: 1
      }];

      // Optional reference / target line
      if (refLine) {
        datasets.push({
          type: 'line',
          label: refLine.label,
          data: statesList.map(() => refLine.value),
          borderColor: refLine.color || 'rgba(99,102,241,0.6)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 0
        });
      }

      charts[chartKey] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t.textSecondary, font: { size: 10, weight: 500 } }
            },
            y: {
              grid: { color: t.gridColor },
              title: {
                display: true,
                text: unit,
                color: t.textSecondary,
                font: { weight: 600, family: "'Outfit', sans-serif" }
              },
              ticks: { color: t.textSecondary }
            }
          },
          plugins: {
            legend: {
              display: refLine ? true : false,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { family: "'Outfit', sans-serif", size: 10 },
                filter: (item) => item.text && (item.text.includes('Target') || item.text.includes('Line') || item.text.includes('Norm') || item.text.includes('Threshold'))
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.type === 'line') return `${ctx.dataset.label}: ${ctx.raw}`;
                  const stateName = ctx.label;
                  const val = ctx.raw;
                  if (unit.includes('Index') || unit.includes('Ratio')) return `${stateName}: ${val.toFixed(2)}`;
                  return `${stateName}: ${val.toFixed(1)}${unit.includes('%') ? '%' : ''}`;
                }
              }
            }
          }
        }
      });
    }

    // --- Chart 1: Child Stunting ---
    createSocialCompareChart(
      'chart-social-stunting', 'socialStunting', 'social_stunting',
      'Child Stunting (< 5 Yrs)', 'Prevalence (%)',
      { value: 20, label: 'WHO Target Threshold (< 20%)', color: 'rgba(16,185,129,0.5)' }
    );

    // --- Chart 2: Child Wasting ---
    createSocialCompareChart(
      'chart-social-wasting', 'socialWasting', 'social_wasting',
      'Child Wasting (< 5 Yrs)', 'Prevalence (%)',
      { value: 15, label: 'Worrying Severity Limit (> 15%)', color: 'rgba(239,68,68,0.5)' }
    );

    // --- Chart 3: Multidimensional Poverty (MPI) ---
    createSocialCompareChart(
      'chart-social-mpi', 'socialMpi', 'social_mpi',
      'Multidimensional Poverty (MPI)', 'Population in Poverty (%)', null
    );

    // --- Chart 4: Labor Force Participation Rate (LFPR) ---
    createSocialCompareChart(
      'chart-social-lfpr', 'socialLfpr', 'social_lfpr',
      'Labor Force Participation (LFPR)', 'Participation Rate (%)', null
    );

    // --- Chart 5: Female LFPR ---
    createSocialCompareChart(
      'chart-social-lfpr-female', 'socialLfprFemale', 'social_lfpr_female',
      'Female Labor Force Participation', 'FLFPR (%)', null
    );

    // --- Chart 6: Welfare Spend vs. MPI Bubble (All States for the selected year) ---
    const ctxMatrix = document.getElementById("chart-social-matrix");
    if (!ctxMatrix) return;
    if (charts["socialMatrix"]) charts["socialMatrix"].destroy();

    const bubbleDatasets = [];
    fiscalData.states.forEach(st => {
      const socialSpend = getMetricValue(st.id, "social_spend_gsdp", yearIdx);
      const mpi = getMetricValue(st.id, "social_mpi", yearIdx);
      const gsdp = getMetricValue(st.id, "gsdp_absolute", yearIdx) || 0;
      if (socialSpend === null || mpi === null) return;

      const r = Math.max(8, Math.min(30, (gsdp / 1000) * 1.5 + 6));
      const isSelected = st.id === stateId;
      bubbleDatasets.push({
        label: st.name,
        data: [{ x: socialSpend, y: mpi, r: isSelected ? r * 1.3 : r }],
        backgroundColor: isSelected ? st.color : st.color + '88',
        borderColor: isSelected ? '#fff' : st.color,
        borderWidth: isSelected ? 3 : 1.5,
        hoverBackgroundColor: st.color,
        hoverBorderWidth: 2.5,
        stateId: st.id
      });
    });

    charts["socialMatrix"] = new Chart(ctxMatrix.getContext('2d'), {
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
              text: `Welfare & Social Safety Net Spend (% of GSDP) - ${selectedYearName}`,
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: `Multidimensional Poverty Index (MPI) (%) - ${selectedYearName}`,
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
              label: (ctx) => {
                const ds = ctx.dataset;
                return [
                  ds.label,
                  `Welfare Spend: ${ctx.raw.x.toFixed(2)}% GSDP`,
                  `Poverty (MPI): ${ctx.raw.y.toFixed(1)}%`
                ];
              }
            }
          }
        }
      },
      plugins: [{
        id: "socialQuadrantLines",
        afterDraw(chart) {
          const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
          if (!x || !y) return;
          const xMidVal = 2.0; // 2.0% GSDP Welfare Spending
          const yMidVal = 15.0; // 15.0% MPI
          if (x.min === undefined || x.max === undefined || y.min === undefined || y.max === undefined) return;

          const xPx = x.getPixelForValue(xMidVal);
          const yPx = y.getPixelForValue(yMidVal);

          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";

          if (xPx >= left && xPx <= right) {
            ctx.beginPath();
            ctx.moveTo(xPx, top);
            ctx.lineTo(xPx, bottom);
            ctx.stroke();
          }
          if (yPx >= top && yPx <= bottom) {
            ctx.beginPath();
            ctx.moveTo(left, yPx);
            ctx.lineTo(right, yPx);
            ctx.stroke();
          }

          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✓ High Efficiency (Low Poverty)", left + 10, bottom - 10);
          ctx.textAlign = "right";
          ctx.fillText("✓ Strong Social Safety Net", right - 10, bottom - 10);
          ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✗ Vulnerable (High Poverty)", left + 10, top + 15);
          ctx.textAlign = "right";
          ctx.fillText("⚠ Low Efficacy Spending", right - 10, top + 15);

          ctx.restore();
        }
      }]
    });
  }

  // --- Render Fiscal Input Quality Tab ---
  function renderFiscalInputTab(t) {
    const stateId = activeStateId;
    const yearSelect = document.getElementById("fiscal-input-year-select");
    const yearIdx = yearSelect ? parseInt(yearSelect.value) : (fiscalData.years.length - 1);
    const selectedYearName = fiscalData.years[yearIdx];

    // Helper: create a comparative bar chart for one fiscal input metric
    function createFiscalInputCompareChart(canvasId, chartKey, metricKey, label, unit, refLine) {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      if (charts[chartKey]) charts[chartKey].destroy();

      const statesList = [...fiscalData.states];
      const labels = statesList.map(s => s.name);
      const data = statesList.map(s => getMetricValue(s.id, metricKey, yearIdx));

      // Opacity styling: selected state is fully opaque, others are semi-transparent
      const bgColors = statesList.map(s => {
        if (s.id === stateId) return s.color;
        return s.color + '55'; // 33% opacity
      });

      const borderColors = statesList.map(s => {
        if (s.id === stateId) return '#ffffff'; // White border to highlight active state
        return s.color;
      });

      const borderWidths = statesList.map(s => {
        if (s.id === stateId) return 3;
        return 1;
      });

      const datasets = [{
        label: `${label} (${selectedYearName})`,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        maxBarThickness: 70,
        categoryPercentage: 1.0,
        barPercentage: 1.0,
        order: 1
      }];

      // Optional reference / target line
      if (refLine) {
        datasets.push({
          type: 'line',
          label: refLine.label,
          data: statesList.map(() => refLine.value),
          borderColor: refLine.color || 'rgba(99,102,241,0.6)',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          order: 0
        });
      }

      charts[chartKey] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: t.textSecondary, font: { size: 10, weight: 500 } }
            },
            y: {
              grid: { color: t.gridColor },
              title: {
                display: true,
                text: unit,
                color: t.textSecondary,
                font: { weight: 600, family: "'Outfit', sans-serif" }
              },
              ticks: { color: t.textSecondary }
            }
          },
          plugins: {
            legend: {
              display: refLine ? true : false,
              position: 'top',
              labels: {
                color: t.textColor,
                font: { family: "'Outfit', sans-serif", size: 10 },
                filter: (item) => item.text && (item.text.includes('Target') || item.text.includes('Line') || item.text.includes('Norm') || item.text.includes('Benchmark'))
              }
            },
            tooltip: {
              backgroundColor: t.tooltipBg,
              titleColor: t.tooltipText,
              bodyColor: t.textColor,
              borderColor: t.tooltipBorder,
              borderWidth: 1,
              callbacks: {
                label: (ctx) => {
                  if (ctx.raw === null) return '';
                  if (ctx.dataset.type === 'line') return `${ctx.dataset.label}: ${ctx.raw}`;
                  const stateName = ctx.label;
                  const val = ctx.raw;
                  return `${stateName}: ${val.toFixed(1)}${unit.includes('%') ? '%' : ''}`;
                }
              }
            }
          }
        }
      });
    }

    // --- Chart 1: Developmental Expenditure to Total Expenditure ---
    createFiscalInputCompareChart(
      'chart-fiscal-input-dev', 'fiscalInputDev', 'input_dev_to_total',
      'Developmental Expenditure (% of Total Exp)', 'Share (%)',
      { value: 60, label: 'RBI Developmental Norm Benchmark (60%)', color: 'rgba(16,185,129,0.5)' }
    );

    // --- Chart 2: Social Sector Expenditure as a % of GSDP ---
    createFiscalInputCompareChart(
      'chart-fiscal-input-social', 'fiscalInputSocial', 'input_social_gsdp',
      'Social Sector Expenditure (% of GSDP)', 'Share of GSDP (%)',
      { value: 7.5, label: 'Social Expenditure Norm Benchmark (7.5%)', color: 'rgba(99,102,241,0.5)' }
    );

    // --- Chart 3: Public Spending priority matrix bubble chart ---
    const ctxMatrix = document.getElementById("chart-fiscal-input-matrix");
    if (!ctxMatrix) return;
    if (charts["fiscalInputMatrix"]) charts["fiscalInputMatrix"].destroy();

    const bubbleDatasets = [];
    fiscalData.states.forEach(st => {
      const devExp = getMetricValue(st.id, "input_dev_to_total", yearIdx);
      const socialExp = getMetricValue(st.id, "input_social_gsdp", yearIdx);
      const gsdp = getMetricValue(st.id, "gsdp_absolute", yearIdx) || 0;
      if (devExp === null || socialExp === null) return;

      const r = Math.max(8, Math.min(30, (gsdp / 1000) * 1.5 + 6));
      const isSelected = st.id === stateId;
      bubbleDatasets.push({
        label: st.name,
        data: [{ x: devExp, y: socialExp, r: isSelected ? r * 1.3 : r }],
        backgroundColor: isSelected ? st.color : st.color + '88',
        borderColor: isSelected ? '#fff' : st.color,
        borderWidth: isSelected ? 3 : 1.5,
        hoverBackgroundColor: st.color,
        hoverBorderWidth: 2.5,
        stateId: st.id
      });
    });

    charts["fiscalInputMatrix"] = new Chart(ctxMatrix.getContext('2d'), {
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
              text: `Developmental Expenditure (% of Total Exp) - ${selectedYearName}`,
              color: t.textSecondary,
              font: { weight: 600, family: "'Outfit', sans-serif" }
            },
            ticks: { color: t.textSecondary }
          },
          y: {
            grid: { color: t.gridColor },
            title: {
              display: true,
              text: `Social Sector Expenditure (% of GSDP) - ${selectedYearName}`,
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
              label: (ctx) => {
                const ds = ctx.dataset;
                return [
                  ds.label,
                  `Developmental Spend: ${ctx.raw.x.toFixed(1)}% of Exp`,
                  `Social Sector Spend: ${ctx.raw.y.toFixed(1)}% of GSDP`
                ];
              }
            }
          }
        }
      },
      plugins: [{
        id: "fiscalInputQuadrantLines",
        afterDraw(chart) {
          const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
          if (!x || !y) return;
          const xMidVal = 60.0; // 60% Developmental Spend
          const yMidVal = 7.5;  // 7.5% Social Sector Spend
          if (x.min === undefined || x.max === undefined || y.min === undefined || y.max === undefined) return;

          const xPx = x.getPixelForValue(xMidVal);
          const yPx = y.getPixelForValue(yMidVal);

          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";

          if (xPx >= left && xPx <= right) {
            ctx.beginPath();
            ctx.moveTo(xPx, top);
            ctx.lineTo(xPx, bottom);
            ctx.stroke();
          }
          if (yPx >= top && yPx <= bottom) {
            ctx.beginPath();
            ctx.moveTo(left, yPx);
            ctx.lineTo(right, yPx);
            ctx.stroke();
          }

          ctx.font = "bold 9px 'Outfit', sans-serif";
          ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✓ Infrastructure Focus", left + 10, bottom - 10);
          ctx.textAlign = "right";
          ctx.fillText("✓ Human Capital Focus", right - 10, bottom - 10);
          ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
          ctx.textAlign = "left";
          ctx.fillText("✗ Administrative Overhead Heavy", left + 10, top + 15);
          ctx.textAlign = "right";
          ctx.fillText("⚠ Revenue Constrained Welfare", right - 10, top + 15);

          ctx.restore();
        }
      }]
    });
  }

  // --- Helper: build a multi-state trajectory line chart ---
  function buildTrajectoryChart(canvasId, chartKey, metricKey, yAxisLabel, yMin, yMax, decimals, t) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (charts[chartKey]) charts[chartKey].destroy();

    const labels = fiscalData.years.map(y => y.replace(" (RE)", "").replace(" (BE)", ""));
    const datasets = fiscalData.states.map(state => ({
      label: state.name,
      data: fiscalData.years.map((_, yearIdx) => getMetricValue(state.id, metricKey, yearIdx)),
      borderColor: state.color,
      backgroundColor: state.color + '0C',
      borderWidth: 2.5,
      pointBackgroundColor: state.color,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1,
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.15,
      spanGaps: true
    }));

    const yScaleConfig = { grid: { color: t.gridColor }, ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" }, callback: v => v.toFixed(decimals) + (yAxisLabel.includes('%') ? '' : '') }, title: { display: true, text: yAxisLabel, color: t.textSecondary, font: { size: 10, weight: 600, family: "'Outfit', sans-serif" } } };
    if (yMin !== null) yScaleConfig.min = yMin;
    if (yMax !== null) yScaleConfig.max = yMax;

    charts[chartKey] = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 35, bottom: 30, left: 10, right: 10 } },
        scales: {
          x: { grid: { color: t.gridColor }, ticks: { color: t.textSecondary, font: { size: 9, family: "'Outfit', sans-serif" } } },
          y: yScaleConfig
        },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: t.textColor, font: { size: 11, family: "'Outfit', sans-serif" }, boxWidth: 12, usePointStyle: true } },
          tooltip: { backgroundColor: t.tooltipBg, titleColor: t.tooltipText, bodyColor: t.textColor, borderColor: t.tooltipBorder, borderWidth: 1, callbacks: { label: ctx => ctx.raw === null ? '' : `${ctx.dataset.label}: ${ctx.raw.toFixed(decimals)}` } }
        }
      }
    });
  }

  // --- Render Education Efficacy Trajectory Tab ---
  function renderEducationTrajectoryTab(t) {
    buildTrajectoryChart('chart-edu-traj-dropout', 'eduTrajDropout', 'edu_dropout_secondary',
      'Dropout Rate (%)', 0, 30, 1, t);
    buildTrajectoryChart('chart-edu-traj-ger', 'eduTrajGer', 'edu_ger_secondary',
      'GER (%)', 50, 100, 1, t);
    buildTrajectoryChart('chart-edu-traj-ner', 'eduTrajNer', 'edu_ner_secondary',
      'NER (%)', 35, 90, 1, t);
    buildTrajectoryChart('chart-edu-traj-gpi', 'eduTrajGpi', 'edu_gpi_secondary',
      'GPI (Index)', 0.7, 1.15, 2, t);
  }

  // --- Render Healthcare Efficacy Trajectory Tab ---
  function renderHealthcareTrajectoryTab(t) {
    buildTrajectoryChart('chart-health-traj-imr', 'healthTrajImr', 'health_imr',
      'IMR (per 1,000 live births)', 0, 65, 1, t);
    buildTrajectoryChart('chart-health-traj-mmr', 'healthTrajMmr', 'health_mmr',
      'MMR (per 100,000 births)', 0, 300, 0, t);
    buildTrajectoryChart('chart-health-traj-inst', 'healthTrajInst', 'health_inst_deliveries',
      'Institutional Deliveries (%)', 40, 100, 1, t);
    buildTrajectoryChart('chart-health-traj-life', 'healthTrajLife', 'health_life_expectancy',
      'Life Expectancy (Years)', 60, 75, 1, t);
  }

  // --- Render Safety Nets & Nutrition Trajectory Tab ---
  function renderSocialTrajectoryTab(t) {
    buildTrajectoryChart('chart-social-traj-stunting', 'socialTrajStunting', 'social_stunting',
      'Child Stunting (%)', 20, 55, 1, t);
    buildTrajectoryChart('chart-social-traj-wasting', 'socialTrajWasting', 'social_wasting',
      'Child Wasting (%)', 10, 26, 1, t);
    buildTrajectoryChart('chart-social-traj-mpi', 'socialTrajMpi', 'social_mpi',
      'MPI (%)', 0, 55, 1, t);
    buildTrajectoryChart('chart-social-traj-spend', 'socialTrajSpend', 'social_spend_gsdp',
      'Welfare Spend (% of GSDP)', 1.0, 4.0, 2, t);
  }

  // --- Render Fiscal Input Quality Trajectory Tab ---
  function renderFiscalInputTrajectoryTab(t) {
    buildTrajectoryChart('chart-fiscal-traj-devexp', 'fiscalTrajDevExp', 'input_dev_to_total',
      'Developmental Expenditure (% of Total)', 50, 72, 1, t);
    buildTrajectoryChart('chart-fiscal-traj-social', 'fiscalTrajSocial', 'input_social_gsdp',
      'Social Sector Spend (% of GSDP)', 5, 10, 1, t);
  }

  // --- Render Demographics Trajectory Tab ---
  function renderDemographicsTrajectoryTab(t) {
    buildTrajectoryChart('chart-demo-traj-popgrowth', 'demoTrajPopGrowth', 'demo_pop_growth',
      'Population Growth Rate (%)', 0, 3, 2, t);
    buildTrajectoryChart('chart-demo-traj-urban', 'demoTrajUrban', 'demo_urbanization',
      'Urban Population (%)', 20, 60, 1, t);
    buildTrajectoryChart('chart-demo-traj-workingage', 'demoTrajWorkingAge', 'demo_working_age',
      'Working-Age Population (15-64, %)', 55, 73, 1, t);
    buildTrajectoryChart('chart-demo-traj-oldagedep', 'demoTrajOldAgeDep', 'demo_old_age_dep',
      'Old-Age Dependency Ratio (per 100)', 6, 19, 1, t);
    buildTrajectoryChart('chart-demo-traj-tfr', 'demoTrajTfr', 'demo_tfr',
      'Total Fertility Rate (children per woman)', 1.2, 4.0, 2, t);
    buildTrajectoryChart('chart-demo-traj-literacy', 'demoTrajLiteracy', 'demo_literacy',
      'Literacy Rate (%)', 60, 92, 1, t);
  }

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
    if (key === "revenue_exp_to_sotr") {
      const revExp = getMetricValue(stateId, "revenue_exp_gsdp", yearIdx);
      const ownTax = fiscalData.metrics.own_tax_gsdp[stateId][yearIdx];
      if (revExp === null || ownTax === null || ownTax === 0) return null;
      return (revExp / ownTax) * 100;
    }
    if (key === "debt_own_tax") {
      const debt = fiscalData.metrics.debt_gsdp[stateId][yearIdx];
      const ownTax = fiscalData.metrics.own_tax_gsdp[stateId][yearIdx];
      return debt / ownTax;
    }
    if (key === "interest_to_own_revenue") {
      const interest_revenue_pct = fiscalData.metrics.interest_revenue[stateId][yearIdx];
      const trr_abs = getMetricValue(stateId, "total_revenue", yearIdx);
      const central_transfers_pct = fiscalData.metrics.central_transfers[stateId][yearIdx];
      if (interest_revenue_pct === null || trr_abs === null || central_transfers_pct === null) return null;
      const transfers_abs = (central_transfers_pct / 100) * trr_abs;
      const orr_abs = trr_abs - transfers_abs; // Own Revenue Receipts
      if (orr_abs === 0) return null;
      const interest_payments_abs = (interest_revenue_pct / 100) * trr_abs;
      return (interest_payments_abs / orr_abs) * 100;
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
    if (key === "grants_in_aid") {
      const stateBreakdown = centralInvestmentBreakdown[stateId];
      return stateBreakdown ? stateBreakdown.grants[yearIdx] : 0;
    }
    if (key === "css_schemes") {
      const stateBreakdown = centralInvestmentBreakdown[stateId];
      return stateBreakdown ? stateBreakdown.css[yearIdx] : 0;
    }
    if (key === "direct_central_investment_rr") {
      const val_gsdp = fiscalData.metrics.direct_central_investment[stateId][yearIdx];
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      if (val_gsdp === null || !budget || !gsdp_abs) return null;
      const rev_receipts = budget - fd_abs;
      if (rev_receipts === 0) return null;
      return val_gsdp * (gsdp_abs / rev_receipts);
    }
    if (key === "grants_in_aid_rr") {
      const stateBreakdown = centralInvestmentBreakdown[stateId];
      const val_gsdp = stateBreakdown ? stateBreakdown.grants[yearIdx] : 0;
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      if (val_gsdp === null || val_gsdp === undefined || !budget || !gsdp_abs) return null;
      const rev_receipts = budget - fd_abs;
      if (rev_receipts === 0) return null;
      return val_gsdp * (gsdp_abs / rev_receipts);
    }
    if (key === "css_schemes_rr") {
      const stateBreakdown = centralInvestmentBreakdown[stateId];
      const val_gsdp = stateBreakdown ? stateBreakdown.css[yearIdx] : 0;
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      if (val_gsdp === null || val_gsdp === undefined || !budget || !gsdp_abs) return null;
      const rev_receipts = budget - fd_abs;
      if (rev_receipts === 0) return null;
      return val_gsdp * (gsdp_abs / rev_receipts);
    }
    if (key === "aggregate_central_transfers") {
      const dev = getMetricValue(stateId, "central_transfers", yearIdx);
      const direct = getMetricValue(stateId, "direct_central_investment_rr", yearIdx);
      const grants = getMetricValue(stateId, "grants_in_aid_rr", yearIdx);
      const css = getMetricValue(stateId, "css_schemes_rr", yearIdx);
      if (dev === null || direct === null || grants === null || css === null) return null;
      return dev + direct + grants + css;
    }
    if (key === "net_central_transfers") {
      const dev = getMetricValue(stateId, "central_transfers", yearIdx);
      const direct = getMetricValue(stateId, "direct_central_investment_rr", yearIdx);
      const grants = getMetricValue(stateId, "grants_in_aid_rr", yearIdx);
      const css = getMetricValue(stateId, "css_schemes_rr", yearIdx);

      // GST sent to Centre expressed as % of Revenue Receipts
      const gst_gsdp = fiscalData.metrics.gst_sent_to_centre[stateId][yearIdx];
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];

      if (dev === null || direct === null || grants === null || css === null) return null;
      if (gst_gsdp === null || !budget || !gsdp_abs) return null;

      const rev_receipts = budget - fd_abs;
      if (rev_receipts === 0) return null;

      const gst_as_pct_rr = (gst_gsdp / 100.0) * gsdp_abs / rev_receipts * 100.0;
      return (dev + direct + grants + css) - gst_as_pct_rr;
    }
    if (key === "absolute_generated_revenues") {
      const gst_gsdp = fiscalData.metrics.gst_sent_to_centre[stateId][yearIdx];
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const ct_abs = getMetricValue(stateId, "central_transfers_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];

      if (gst_gsdp === null || !budget || !gsdp_abs || ct_abs === null) return null;

      const rev_receipts = budget - fd_abs;
      const own_revenues = rev_receipts - ct_abs;
      const gst_abs = (gst_gsdp / 100.0) * gsdp_abs;
      const generated_revenues = own_revenues + gst_abs;

      return generated_revenues / 100.0; // Return in Rupees Billion
    }
    if (key === "gst_share_of_generated") {
      const gst_gsdp = fiscalData.metrics.gst_sent_to_centre[stateId][yearIdx];
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const ct_abs = getMetricValue(stateId, "central_transfers_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const ctc_pct = centralTaxContribution[stateId][yearIdx];

      if (gst_gsdp === null || ctc_pct === null || !budget || !gsdp_abs || ct_abs === null) return null;

      const rev_receipts = budget - fd_abs;
      const own_revenues = rev_receipts - ct_abs;
      const gst_abs = (gst_gsdp / 100.0) * gsdp_abs;
      const ctc_abs = (ctc_pct / 100.0) * gsdp_abs;
      // Denominator: State's Own Revenue Receipts + ALL Central Taxes collected from state (income tax, corporate tax, customs, excise, GST)
      const total_collected = own_revenues + ctc_abs;

      if (total_collected === 0) return null;
      return (gst_abs / total_collected) * 100.0;
    }
    if (key === "devolution_to_gst_ratio") {
      const budget = fiscalData.metrics.total_budget[stateId][yearIdx];
      const fd_abs = getMetricValue(stateId, "fiscal_deficit_abs", yearIdx);
      const ct_abs = getMetricValue(stateId, "central_transfers_abs", yearIdx);
      const gsdp_abs = fiscalData.metrics.gsdp_absolute[stateId][yearIdx];
      const ctc_pct = centralTaxContribution[stateId][yearIdx];

      if (ctc_pct === null || !budget || !gsdp_abs || ct_abs === null) return null;

      const rev_receipts = budget - fd_abs;
      const own_revenues = rev_receipts - ct_abs;
      const ctc_abs = (ctc_pct / 100.0) * gsdp_abs;
      // Denominator: everything collected from the state's economy
      const total_collected = own_revenues + ctc_abs;

      // Numerator: only budgetary constitutional transfers — Tax Devolution + Grants-in-Aid + CSS (NO direct investment)
      const grants_abs = getMetricValue(stateId, "grants_in_aid_rr", yearIdx) / 100.0 * rev_receipts;
      const css_abs = getMetricValue(stateId, "css_schemes_rr", yearIdx) / 100.0 * rev_receipts;
      const total_received = ct_abs + grants_abs + css_abs;

      if (total_collected === 0) return null;
      return (total_received / total_collected) * 100.0;
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
    if (key === "revenue_exp_to_sotr") {
      return { name: "Revenue Expenditure (% of State's Own Tax Revenue)", shortName: "Rev Exp to SOTR" };
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
      gsdp_growth: "GSDP Growth",
      edu_dropout_secondary: "Secondary Dropout",
      edu_ger_secondary: "Secondary GER",
      edu_ptr_secondary: "Secondary PTR",
      edu_social_exp_gsdp: "Social Spend (% GSDP)",
      edu_ner_secondary: "Secondary NER",
      edu_gpi_secondary: "Gender Parity Index",
      health_oope: "Out-of-Pocket Exp",
      health_imr: "Infant Mortality Rate",
      health_mmr: "Maternal Mortality Ratio",
      health_inst_deliveries: "Inst. Deliveries",
      health_life_expectancy: "Life Expectancy",
      health_spend_gsdp: "Health Spend (% GSDP)",
      social_stunting: "Child Stunting",
      social_wasting: "Child Wasting",
      social_mpi: "Multidimensional Poverty",
      social_lfpr: "Labor Participation (LFPR)",
      social_lfpr_female: "Female Labor Participation",
      social_spend_gsdp: "Welfare Spend (% GSDP)",
      input_dev_to_total: "Developmental Exp (% Total)",
      input_social_gsdp: "Social Sector Exp (% GSDP)"
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
    if (key === "edu_ptr_secondary") {
      return `${value.toFixed(1)}:1`;
    }
    if (key === "edu_dropout_secondary" || key === "edu_ger_secondary" || key === "edu_social_exp_gsdp" || key === "edu_ner_secondary" || key === "health_oope" || key === "health_inst_deliveries" || key === "health_spend_gsdp" || key === "social_stunting" || key === "social_wasting" || key === "social_mpi" || key === "social_lfpr" || key === "social_lfpr_female" || key === "social_spend_gsdp" || key === "input_dev_to_total" || key === "input_social_gsdp" || key === "revenue_exp_to_sotr") {
      return `${value.toFixed(1)}%`;
    }
    if (key === "edu_gpi_secondary") {
      return value.toFixed(2);
    }
    if (key === "health_imr") {
      return `${value.toFixed(1)}`;
    }
    if (key === "health_mmr") {
      return `${Math.round(value)}`;
    }
    if (key === "health_life_expectancy") {
      return `${value.toFixed(1)} Years`;
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


  // --- Finance Commission Vertical Devolution Tab ---
  function renderDevolutionTab() {
    const FC_DATA = {
      metric_tracked: "Vertical Devolution Percentage",
      historical_timeline: [
        {
          finance_commission: "11th",
          chairman: "A.M. Khusro",
          operational_years: "2000-2005",
          vertical_share_pct: 29.5,
          macro_context: "Interim framework tracking the transition to the alternative scheme of devolution introduced post-80th Constitutional Amendment (2000). First commission to recommend shares under the consolidated divisible pool concept."
        },
        {
          finance_commission: "12th",
          chairman: "C. Rangarajan",
          operational_years: "2005-2010",
          vertical_share_pct: 30.5,
          macro_context: "First commission to operate fully under the post-80th Constitutional Amendment regime, which pooled all central taxes (income tax, corporation tax, and excise duties) into a single divisible pool. The 30.5% reflected incremental enhancement over the 11th FC baseline."
        },
        {
          finance_commission: "13th",
          chairman: "Vijay Kelkar",
          operational_years: "2010-2015",
          vertical_share_pct: 32.0,
          macro_context: "Incremental 1.5 percentage point increase from 30.5% to 32% to enhance the predictability of revenue streams for states and reduce their dependence on discretionary grants. Introduced outcome-based conditionality for certain grants."
        },
        {
          finance_commission: "14th",
          chairman: "Y.V. Reddy",
          operational_years: "2015-2020",
          vertical_share_pct: 42.0,
          macro_context: "Historic 10 percentage point structural leap from 32% to 42% — the single largest increase in India's fiscal federalism history. The rationale was to prioritize unconditional tax devolution over tied, scheme-based central grants (CSS), granting states significantly greater fiscal autonomy and expenditure flexibility."
        },
        {
          finance_commission: "15th",
          chairman: "N.K. Singh",
          operational_years: "2020-2026",
          vertical_share_pct: 41.0,
          macro_context: "Marginal reduction from 42% to 41% to formally account for the reorganization of the erstwhile state of Jammu & Kashmir into the Union Territories of J&K and Ladakh in 2019. UTs are centrally funded and thus excluded from the divisible pool formula, requiring a downward normalization."
        },
        {
          finance_commission: "16th",
          chairman: "Arvind Panagariya",
          operational_years: "2026-2031",
          vertical_share_pct: 41.0,
          macro_context: "Expected to maintain status quo at 41% to preserve macroeconomic stability and balance central sovereign obligations (defence, debt service) against state expenditure needs. States continue to advocate for a higher share to fund SDG-linked social sector spending."
        }
      ]
    };

    const timeline = FC_DATA.historical_timeline;

    // --- Build Chart ---
    const ctx = document.getElementById('chart-devolution-trend');
    if (!ctx) return;
    if (charts['devolution']) charts['devolution'].destroy();

    // Build stepped data: each FC period spans multiple years, plot by start year
    const labels = timeline.map(d => d.operational_years.split('-')[0]);
    const values = timeline.map(d => d.vertical_share_pct);
    const isLandmark = timeline.map(d => d.vertical_share_pct === 42.0);

    // Area fill gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99,179,237,0.35)');
    gradient.addColorStop(1, 'rgba(99,179,237,0.02)');

    const pointColors = timeline.map(d =>
      d.vertical_share_pct === 42.0 ? '#ffaa00' :
      d.operational_years.startsWith('2026') ? '#a78bfa' : '#63b3ed'
    );
    const pointRadius = timeline.map(d => d.vertical_share_pct === 42.0 ? 10 : 7);
    const pointBorderWidth = timeline.map(d => d.vertical_share_pct === 42.0 ? 3 : 2);

    charts['devolution'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Vertical Devolution (%)',
          data: values,
          borderColor: '#63b3ed',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0,        // stepped look
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: pointRadius,
          pointHoverRadius: 12,
          pointBorderWidth: pointBorderWidth
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const fc = timeline[idx];
                return `${fc.finance_commission} Finance Commission (${fc.operational_years})`;
              },
              label: (item) => {
                return `Vertical Share: ${item.raw}%`;
              },
              afterLabel: (item) => {
                const idx = item.dataIndex;
                const fc = timeline[idx];
                return [`Chairman: ${fc.chairman}`, '', fc.macro_context];
              }
            },
            backgroundColor: 'rgba(15,23,42,0.97)',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            padding: 14,
            cornerRadius: 8,
            boxPadding: 4,
            titleFont: { weight: '700', size: 13 },
            bodyFont: { size: 11 },
            maxWidth: 360
          },
          annotation: {
            annotations: {
              landmark14: {
                type: 'point',
                xValue: labels.indexOf('2015'),
                yValue: 42.0,
                backgroundColor: 'rgba(255,170,0,0.15)',
                borderColor: '#ffaa00',
                borderWidth: 2,
                radius: 22
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: (val, idx) => {
                const fc = timeline[idx];
                return fc ? [`${fc.finance_commission} FC`, fc.operational_years] : '';
              }
            }
          },
          y: {
            min: 25,
            max: 48,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: v => v + '%'
            },
            title: {
              display: true,
              text: 'Vertical Devolution Share (%)',
              color: '#94a3b8',
              font: { size: 11 }
            }
          }
        }
      }
    });

    // --- Annotate the 14th FC leap manually with a custom plugin (fallback label) ---
    // Draw a reference line at y=42 via a dataset annotation
    // (chartjs-plugin-annotation not loaded; use a second dataset as a dashed reference)
    // Add a dashed threshold line at 42%
    const refDataset = {
      label: '14th FC Landmark (42%)',
      data: labels.map(() => 42.0),
      borderColor: 'rgba(255,170,0,0.25)',
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      tension: 0
    };
    charts['devolution'].data.datasets.push(refDataset);
    charts['devolution'].update();

    // --- Build Reference Table ---
    const tbody = document.getElementById('fc-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    timeline.forEach((fc, idx) => {
      const prev = idx > 0 ? timeline[idx - 1].vertical_share_pct : null;
      const delta = prev !== null ? (fc.vertical_share_pct - prev) : null;
      const deltaStr = delta === null ? '—' :
        delta > 0 ? `<span style="color:#4ade80;">+${delta.toFixed(1)}pp &#x25B2;</span>` :
        delta < 0 ? `<span style="color:#f87171;">${delta.toFixed(1)}pp &#x25BC;</span>` :
        `<span style="color:#94a3b8;">=</span>`;

      const isLandmarkRow = fc.finance_commission === '14th';
      const rowBg = isLandmarkRow ? 'rgba(255,170,0,0.07)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)');

      const row = document.createElement('tr');
      row.style.cssText = `border-bottom:1px solid rgba(255,255,255,0.06); background:${rowBg}; transition:background 0.15s;`;
      row.innerHTML = `
        <td style="padding:0.65rem 0.8rem; font-weight:700; color:${isLandmarkRow ? '#ffaa00' : 'var(--accent-color)'}; white-space:nowrap;">${fc.finance_commission} FC</td>
        <td style="padding:0.65rem 0.8rem; color:var(--text-primary); white-space:nowrap;">${fc.chairman}</td>
        <td style="padding:0.65rem 0.8rem; color:var(--text-secondary); white-space:nowrap;">${fc.operational_years}</td>
        <td style="padding:0.65rem 0.8rem; text-align:center; font-weight:700; font-size:1.05rem; color:${isLandmarkRow ? '#ffaa00' : 'var(--text-primary)'}">${fc.vertical_share_pct.toFixed(1)}%</td>
        <td style="padding:0.65rem 0.8rem; text-align:center;">${deltaStr}</td>
        <td style="padding:0.65rem 0.8rem; color:var(--text-secondary); font-size:0.78rem; line-height:1.45;">${fc.macro_context}</td>
      `;
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(99,179,237,0.07)');
      row.addEventListener('mouseleave', () => row.style.background = rowBg);
      tbody.appendChild(row);
    });

    // --- Step-function timeline chart (year-by-year) ---
    // Build a year-for-year label array 2000–2031, each year gets its FC's share
    const FC_PERIODS = [
      { start: 2000, end: 2005, share: 29.5, fc: '11th', chairman: 'A.M. Khusro' },
      { start: 2005, end: 2010, share: 30.5, fc: '12th', chairman: 'C. Rangarajan' },
      { start: 2010, end: 2015, share: 32.0, fc: '13th', chairman: 'Vijay Kelkar' },
      { start: 2015, end: 2020, share: 42.0, fc: '14th', chairman: 'Y.V. Reddy' },
      { start: 2020, end: 2026, share: 41.0, fc: '15th', chairman: 'N.K. Singh' },
      { start: 2026, end: 2031, share: 41.0, fc: '16th', chairman: 'Arvind Panagariya' }
    ];

    const stepLabels = [];
    const stepValues = [];
    const stepColors = [];
    const stepFCs = [];
    for (const period of FC_PERIODS) {
      for (let yr = period.start; yr < period.end; yr++) {
        stepLabels.push(`${yr}-${String(yr + 1).slice(-2)}`);
        stepValues.push(period.share);
        stepColors.push(
          period.fc === '14th' ? 'rgba(255,170,0,0.85)' :
          period.fc === '16th' ? 'rgba(167,139,250,0.85)' :
          'rgba(99,179,237,0.85)'
        );
        stepFCs.push(period);
      }
    }

    const stepCtx = document.getElementById('chart-devolution-step');
    if (stepCtx) {
      if (charts['devolutionStep']) charts['devolutionStep'].destroy();
      const stepGrad = stepCtx.getContext('2d').createLinearGradient(0, 0, 0, 350);
      stepGrad.addColorStop(0, 'rgba(99,179,237,0.22)');
      stepGrad.addColorStop(1, 'rgba(99,179,237,0.01)');

      charts['devolutionStep'] = new Chart(stepCtx, {
        type: 'line',
        data: {
          labels: stepLabels,
          datasets: [{
            label: 'Vertical Devolution (%)',
            data: stepValues,
            borderColor: '#63b3ed',
            backgroundColor: stepGrad,
            borderWidth: 2,
            fill: true,
            stepped: 'before',
            pointBackgroundColor: stepColors,
            pointBorderColor: stepColors,
            pointRadius: 4,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const p = stepFCs[idx];
                  return `FY ${stepLabels[idx]}  |  ${p.fc} Finance Commission`;
                },
                label: (item) => `Vertical Share: ${item.raw}%`,
                afterLabel: (item) => {
                  const p = stepFCs[item.dataIndex];
                  return `Chairman: ${p.chairman}`;
                }
              },
              backgroundColor: 'rgba(15,23,42,0.97)',
              titleColor: '#e2e8f0',
              bodyColor: '#94a3b8',
              padding: 12,
              cornerRadius: 8
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: {
                color: '#94a3b8',
                font: { size: 10 },
                maxRotation: 45,
                autoSkip: true,
                maxTicksLimit: 16
              }
            },
            y: {
              min: 26,
              max: 46,
              grid: { color: 'rgba(255,255,255,0.06)' },
              ticks: {
                color: '#94a3b8',
                font: { size: 11 },
                callback: v => v + '%'
              },
              title: {
                display: true,
                text: 'Vertical Devolution Share (%)',
                color: '#94a3b8',
                font: { size: 11 }
              }
            }
          }
        }
      });

      // Add FC period boundary vertical lines as a second dataset (dashed segments at transitions)
      const boundaryData = stepLabels.map((_, i) => {
        const curFC = stepFCs[i]?.fc;
        const prevFC = i > 0 ? stepFCs[i - 1]?.fc : null;
        return curFC !== prevFC ? stepValues[i] : null;
      });
      charts['devolutionStep'].data.datasets.push({
        label: 'FC Transition',
        data: boundaryData,
        borderColor: 'rgba(255,255,255,0.25)',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointBackgroundColor: 'rgba(255,255,255,0.7)',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: false,
        stepped: false,
        tension: 0
      });
      charts['devolutionStep'].update();
    }

    // --- Delta bar chart: pp change at each FC transition ---
    const deltaCtx = document.getElementById('chart-devolution-delta');
    if (deltaCtx) {
      if (charts['devolutionDelta']) charts['devolutionDelta'].destroy();

      const deltaLabels = [];
      const deltaValues = [];
      const deltaBarColors = [];
      const deltaMeta = [];

      for (let i = 0; i < timeline.length; i++) {
        const fc = timeline[i];
        const prev = i > 0 ? timeline[i - 1] : null;
        const delta = prev ? fc.vertical_share_pct - prev.vertical_share_pct : null;
        deltaLabels.push(`${fc.finance_commission} FC\n${fc.operational_years}`);
        deltaValues.push(delta);
        deltaMeta.push({ fc, delta, prev });
        deltaBarColors.push(
          delta === null ? 'rgba(148,163,184,0.5)' :
          delta > 5 ? 'rgba(255,170,0,0.85)' :
          delta > 0 ? 'rgba(74,222,128,0.8)' :
          delta < 0 ? 'rgba(248,113,113,0.8)' :
          'rgba(148,163,184,0.5)'
        );
      }

      charts['devolutionDelta'] = new Chart(deltaCtx, {
        type: 'bar',
        data: {
          labels: deltaLabels,
          datasets: [{
            label: 'Change (pp)',
            data: deltaValues,
            backgroundColor: deltaBarColors,
            borderColor: deltaBarColors.map(c => c.replace('0.8', '1').replace('0.85', '1')),
            borderWidth: 1.5,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const idx = items[0].dataIndex;
                  const m = deltaMeta[idx];
                  return `${m.fc.finance_commission} Finance Commission (${m.fc.operational_years})`;
                },
                label: (item) => {
                  const m = deltaMeta[item.dataIndex];
                  if (m.delta === null) return 'Baseline (first FC)';
                  const sign = m.delta >= 0 ? '+' : '';
                  return `Change: ${sign}${m.delta.toFixed(1)} pp  →  ${m.fc.vertical_share_pct}%`;
                },
                afterLabel: (item) => {
                  const m = deltaMeta[item.dataIndex];
                  return [
                    `Chairman: ${m.fc.chairman}`,
                    '',
                    m.fc.macro_context
                  ];
                }
              },
              backgroundColor: 'rgba(15,23,42,0.97)',
              titleColor: '#e2e8f0',
              bodyColor: '#94a3b8',
              padding: 14,
              cornerRadius: 8,
              titleFont: { weight: '700', size: 13 },
              bodyFont: { size: 11 },
              maxWidth: 380
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.06)' },
              ticks: {
                color: '#94a3b8',
                font: { size: 11 },
                callback: v => (v >= 0 ? '+' : '') + v + ' pp'
              },
              title: {
                display: true,
                text: 'Change vs previous FC (percentage points)',
                color: '#94a3b8',
                font: { size: 11 }
              }
            }
          }
        }
      });
    }

    // --- GTR 100% Composition: Stacked Bar + Centre Retention dotted line ---
    const CESS_DATA = [
      { finance_commission: '11th', operational_years: '2000-2005', chairman: 'A.M. Khusro',
        statutory_share_pct: 29.5, divisible_pool_of_gtr_pct: 90.2, effective_devolution_of_gtr_pct: 26.6,
        macro_context: 'Inaugural period of the unified divisible pool. Cesses & surcharges were <5% of GTR. The divisible pool covered ~90% of collections, keeping the gap between statutory and effective rates minimal (~3 pp).' },
      { finance_commission: '12th', operational_years: '2005-2010', chairman: 'C. Rangarajan',
        statutory_share_pct: 30.5, divisible_pool_of_gtr_pct: 88.5, effective_devolution_of_gtr_pct: 27.0,
        macro_context: 'The Education Cess (2%+1%) introduced in 2004 began the structural expansion of non-shareable levies. Pool shrank to ~88.5% of GTR; Centre retained ~73% of every ₹100 collected.' },
      { finance_commission: '13th', operational_years: '2010-2015', chairman: 'Vijay Kelkar',
        statutory_share_pct: 32.0, divisible_pool_of_gtr_pct: 87.5, effective_devolution_of_gtr_pct: 28.0,
        macro_context: 'Cesses and surcharges accounted for ~10-12% of GTR. States got a modest bump to 32% statutory share. The Centre retained ~72% of gross collections — roughly ₹72 out of every ₹100.' },
      { finance_commission: '14th', operational_years: '2015-2020', chairman: 'Y.V. Reddy',
        statutory_share_pct: 42.0, divisible_pool_of_gtr_pct: 84.1, effective_devolution_of_gtr_pct: 35.3,
        macro_context: 'The landmark 10 pp statutory jump to 42% was the best outcome for states. However, the Centre simultaneously expanded Swachh Bharat and Krishi Kalyan cesses, shrinking the pool to ~84%. States' best era: Centre retained only ~65 of every ₹100.' },
      { finance_commission: '15th', operational_years: '2020-2026', chairman: 'N.K. Singh',
        statutory_share_pct: 41.0, divisible_pool_of_gtr_pct: 79.2, effective_devolution_of_gtr_pct: 32.5,
        macro_context: 'Pandemic-era fiscal stress triggered an explosion of non-shareable cesses — AIDC on fuel, GST Compensation Cess, health surcharges. The pool fell to ~79% of GTR. Centre clawed back to retaining ~67.5 of every ₹100.' },
      { finance_commission: '16th', operational_years: '2026-2031', chairman: 'Arvind Panagariya',
        statutory_share_pct: 41.0, divisible_pool_of_gtr_pct: 78.5, effective_devolution_of_gtr_pct: 32.2,
        macro_context: 'Statutory share held at 41%, but the divisible pool continues to shrink as fuel and infrastructure cesses persist. Centre retains ~68 out of every ₹100. States advocate for including cesses in the divisible pool.' }
    ];

    const cessCtx = document.getElementById('chart-devolution-cess');
    if (cessCtx) {
      if (charts['devolutionCess']) charts['devolutionCess'].destroy();

      // Compute three segments for each FC period (sum = 100% of GTR)
      // ① stateDevolution  = effective_devolution_of_gtr_pct
      // ② centrePool       = divisible_pool_of_gtr_pct × (1 - statutory_share_pct/100)
      // ③ cesses           = 100 - divisible_pool_of_gtr_pct
      // dotted line        = centrePool + cesses = 100 - stateDevolution
      const seg_state    = CESS_DATA.map(d => parseFloat(d.effective_devolution_of_gtr_pct.toFixed(1)));
      const seg_cPool    = CESS_DATA.map(d => parseFloat(((d.divisible_pool_of_gtr_pct / 100) * (1 - d.statutory_share_pct / 100) * 100).toFixed(1)));
      const seg_cess     = CESS_DATA.map(d => parseFloat((100 - d.divisible_pool_of_gtr_pct).toFixed(1)));
      const dotted_centre = CESS_DATA.map(d => parseFloat((100 - d.effective_devolution_of_gtr_pct).toFixed(1)));

      const cessLabels = CESS_DATA.map(d => `${d.finance_commission} FC\n${d.operational_years}`);

      charts['devolutionCess'] = new Chart(cessCtx, {
        type: 'bar',
        data: {
          labels: cessLabels,
          datasets: [
            {
              // ① Green — States' effective devolution
              label: 'States\' Effective Devolution (% of GTR)',
              data: seg_state,
              backgroundColor: 'rgba(74,222,128,0.80)',
              borderColor: 'rgba(74,222,128,1)',
              borderWidth: 1,
              borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 5, bottomRight: 5 },
              borderSkipped: 'bottom',
              stack: 'gtr',
              order: 3
            },
            {
              // ② Blue — Centre retains from divisible pool
              label: 'Centre Retains from Divisible Pool (% of GTR)',
              data: seg_cPool,
              backgroundColor: 'rgba(96,165,250,0.70)',
              borderColor: 'rgba(96,165,250,1)',
              borderWidth: 1,
              borderRadius: 0,
              borderSkipped: true,
              stack: 'gtr',
              order: 3
            },
            {
              // ③ Orange — Cesses & surcharges (top segment, growing over time)
              label: 'Cesses & Surcharges — Centre only, not shared (% of GTR)',
              data: seg_cess,
              backgroundColor: 'rgba(251,146,60,0.80)',
              borderColor: 'rgba(251,146,60,1)',
              borderWidth: 1,
              borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
              borderSkipped: 'bottom',
              stack: 'gtr',
              order: 3
            },
            {
              // Dotted line — Centre's total retention
              label: 'Centre\'s Total Retention (dotted line, % of GTR)',
              type: 'line',
              data: dotted_centre,
              borderColor: '#f87171',
              backgroundColor: 'transparent',
              borderWidth: 2.5,
              borderDash: [7, 4],
              pointBackgroundColor: '#f87171',
              pointBorderColor: '#f87171',
              pointRadius: 6,
              pointHoverRadius: 9,
              tension: 0.3,
              fill: false,
              stack: undefined,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#94a3b8',
                font: { size: 11 },
                usePointStyle: true,
                pointStyleWidth: 14,
                padding: 20,
                filter: (item) => item.datasetIndex < 4  // show all 4 legend items
              }
            },
            tooltip: {
              callbacks: {
                title: (items) => {
                  const d = CESS_DATA[items[0].dataIndex];
                  return `${d.finance_commission} Finance Commission (${d.operational_years})  —  ${d.chairman}`;
                },
                label: (item) => {
                  const d = CESS_DATA[item.dataIndex];
                  const labels = {
                    0: `🟢 States receive: ${seg_state[item.dataIndex]}% of GTR`,
                    1: `🔵 Centre pool retained: ${seg_cPool[item.dataIndex]}% of GTR`,
                    2: `🟠 Cesses & surcharges: ${seg_cess[item.dataIndex]}% of GTR`,
                    3: `⟶ Centre total retention: ${dotted_centre[item.dataIndex]}% of GTR`
                  };
                  return labels[item.datasetIndex] ?? item.formattedValue + '%';
                },
                afterBody: (items) => {
                  const d = CESS_DATA[items[0].dataIndex];
                  const stateShare = seg_state[items[0].dataIndex];
                  const cessShare = seg_cess[items[0].dataIndex];
                  return [
                    '',
                    `📐 Divisible Pool: ${d.divisible_pool_of_gtr_pct}% of GTR`,
                    `📐 Statutory share (of pool): ${d.statutory_share_pct}%`,
                    '',
                    d.macro_context
                  ];
                }
              },
              backgroundColor: 'rgba(15,23,42,0.97)',
              titleColor: '#e2e8f0',
              bodyColor: '#94a3b8',
              padding: 14,
              cornerRadius: 8,
              titleFont: { weight: '700', size: 13 },
              bodyFont: { size: 11 },
              maxWidth: 440
            }
          },
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { color: '#94a3b8', font: { size: 10 } }
            },
            y: {
              stacked: true,
              min: 0,
              max: 100,
              grid: { color: 'rgba(255,255,255,0.06)' },
              ticks: {
                color: '#94a3b8',
                font: { size: 11 },
                stepSize: 10,
                callback: v => v + '%'
              },
              title: {
                display: true,
                text: '% of Gross Tax Revenue (GTR)',
                color: '#94a3b8',
                font: { size: 11 }
              }
            }
          }
        }
      });
    }
  }

  // Run initialization
  init();
});
