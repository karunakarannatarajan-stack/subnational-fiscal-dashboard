// Sub-National Fiscal Analytics Database (FY21 to FY25)
// Sourced from RBI "State Finances: A Study of Budgets" and PRS State Budget Analyses

const fiscalData = {
  states: [
    { id: "MH", name: "Maharashtra", capital: "Mumbai", region: "West", color: "#3b82f6" },
    { id: "TN", name: "Tamil Nadu", capital: "Chennai", region: "South", color: "#10b981" },
    { id: "GJ", name: "Gujarat", capital: "Gandhinagar", region: "West", color: "#f59e0b" },
    { id: "KA", name: "Karnataka", capital: "Bengaluru", region: "South", color: "#ec4899" },
    { id: "UP", name: "Uttar Pradesh", capital: "Lucknow", region: "North", color: "#8b5cf6" },
    { id: "AP", name: "Andhra Pradesh", capital: "Amaravati", region: "South", color: "#06b6d4" },
    { id: "TS", name: "Telangana", capital: "Hyderabad", region: "South", color: "#f43f5e" },
    { id: "HR", name: "Haryana", capital: "Chandigarh", region: "North", color: "#14b8a6" },
    { id: "WB", name: "West Bengal", capital: "Kolkata", region: "East", color: "#6b7280" }
  ],
  years: ["2020-21", "2021-22", "2022-23", "2023-24 (RE)", "2024-25 (BE)"],
  metrics: {
    // 1. Fiscal Deficit and Its Quality
    fiscal_deficit: {
      name: "Gross Fiscal Deficit (% of GSDP)",
      description: "Headline borrowing requirement. Shows total gap between expenditure and non-debt receipts.",
      MH: [3.8, 2.79, 2.7, 2.8, 2.6],
      TN: [4.8, 4.3, 3.63, 3.5, 3.4],
      GJ: [3.2, 1.51, 1.5, 1.7, 1.9],
      KA: [3.9, 2.6, 2.8, 2.7, 3.0],
      UP: [3.9, 3.1, 4.0, 3.5, 3.5],
      AP: [5.4, 4.1, 4.0, 4.3, 4.2],
      TS: [4.0, 3.8, 3.2, 3.4, 3.0],
      HR: [3.2, 2.9, 3.3, 2.8, 2.8],
      WB: [3.1, 3.9, 3.8, 3.5, 3.6]
    },
    revenue_deficit: {
      name: "Revenue Deficit/Surplus (% of GSDP)",
      description: "Borrowing for consumption (salaries, interest, subsidies). Negative indicates deficit, positive indicates surplus.",
      MH: [-1.52, -0.96, -0.68, -0.4, -0.5],
      TN: [-3.2, -2.15, -1.63, -1.5, -1.6],
      GJ: [-1.36, 0.04, 0.3, 0.8, 0.4],
      KA: [-1.2, -0.36, -0.78, -0.54, -1.0],
      UP: [0.8, 1.2, 1.7, 1.9, 2.1], // UP is in revenue surplus
      AP: [-3.4, -2.1, -1.9, -2.7, -2.1],
      TS: [-1.2, 0.1, 0.3, 0.0, 0.02],
      HR: [-1.8, -1.4, -1.8, -1.2, -1.5],
      WB: [-2.27, -2.15, -2.6, -1.7, -1.7]
    },
    capital_outlay: {
      name: "Capital Outlay (% of GSDP)",
      description: "Borrowing for asset creation (roads, bridges, schools, infrastructure). High outlay is desirable.",
      MH: [1.5, 1.8, 2.0, 2.1, 2.2],
      TN: [1.4, 1.7, 1.9, 2.0, 2.0],
      GJ: [2.1, 2.3, 2.6, 2.8, 3.0],
      KA: [1.8, 1.9, 2.1, 2.2, 2.2],
      UP: [2.8, 3.2, 3.8, 4.0, 4.2],
      AP: [0.9, 1.1, 1.3, 1.4, 1.4],
      TS: [1.5, 1.6, 1.8, 1.9, 1.8],
      HR: [1.2, 1.3, 1.5, 1.6, 1.6],
      WB: [0.9, 1.1, 1.2, 1.3, 1.3]
    },
    // 2. Debt Sustainability
    debt_gsdp: {
      name: "Outstanding Debt (% of GSDP)",
      description: "Accumulated liabilities of the state government. FRBM target is 20% limit.",
      MH: [20.2, 19.8, 18.1, 18.2, 19.0],
      TN: [28.2, 29.5, 30.6, 31.0, 31.0],
      GJ: [17.5, 16.2, 18.6, 14.9, 15.3],
      KA: [26.6, 27.0, 22.5, 23.0, 24.0],
      UP: [40.9, 36.8, 32.5, 32.1, 29.0],
      AP: [35.0, 32.4, 33.1, 33.5, 34.0],
      TS: [24.7, 27.3, 27.6, 27.45, 28.0],
      HR: [28.6, 30.0, 30.7, 30.0, 30.0],
      WB: [42.2, 39.2, 37.9, 37.1, 36.9]
    },
    interest_revenue: {
      name: "Interest Payments (% of Revenue Receipts)",
      description: "How much of revenue receipts is eaten up by interest payments. Lower is safer.",
      MH: [12.8, 12.5, 12.0, 12.1, 12.4],
      TN: [17.5, 18.2, 18.9, 19.0, 19.1],
      GJ: [10.5, 10.2, 10.0, 10.1, 10.3],
      KA: [11.2, 11.5, 11.8, 11.9, 12.0],
      UP: [10.2, 9.8, 9.5, 9.6, 9.6],
      AP: [14.2, 14.5, 14.9, 15.1, 15.0],
      TS: [11.8, 12.0, 12.5, 12.7, 12.8],
      HR: [16.2, 16.5, 16.8, 16.9, 17.0],
      WB: [19.8, 19.5, 20.0, 20.2, 20.1]
    },
    gsdp_growth: {
      name: "Nominal GSDP Growth Rate (%)",
      description: "Rate at which state GDP grows at current prices. Helps stabilize debt-to-GDP if higher than interest rate.",
      MH: [-5.6, 12.1, 11.5, 10.8, 10.2],
      TN: [-3.4, 11.8, 11.2, 10.5, 10.0],
      GJ: [-4.2, 13.5, 12.8, 11.9, 11.5],
      KA: [-4.8, 12.5, 11.9, 11.0, 10.6],
      UP: [-6.2, 11.5, 10.9, 10.2, 9.8],
      AP: [-2.5, 11.0, 10.5, 10.0, 9.5],
      TS: [-3.0, 12.8, 12.2, 11.5, 10.9],
      HR: [-4.0, 12.0, 11.4, 10.6, 10.2],
      WB: [-5.1, 10.8, 10.2, 9.8, 9.2]
    },
    effective_interest: {
      name: "Effective Interest Rate on Debt (%)",
      description: "Average interest cost paid on outstanding liabilities. Must be lower than nominal growth rate for sustainability.",
      MH: [7.2, 7.3, 7.2, 7.4, 7.5],
      TN: [7.4, 7.5, 7.5, 7.6, 7.6],
      GJ: [7.0, 7.1, 7.0, 7.2, 7.3],
      KA: [7.1, 7.2, 7.1, 7.3, 7.4],
      UP: [7.2, 7.3, 7.2, 7.3, 7.4],
      AP: [7.5, 7.6, 7.6, 7.7, 7.8],
      TS: [7.3, 7.4, 7.4, 7.5, 7.6],
      HR: [7.4, 7.5, 7.5, 7.6, 7.6],
      WB: [7.6, 7.7, 7.7, 7.8, 7.9]
    },
    pc_gsdp: {
      name: "Per Capita GSDP (Rupees)",
      description: "State Domestic Product per capita at current prices. Measures average economic output per resident.",
      MH: [193000, 215000, 242000, 280000, 310000],
      TN: [220000, 245000, 280000, 325000, 360000],
      GJ: [212000, 236000, 270000, 310000, 345000],
      KA: [226000, 256000, 290000, 335000, 375000],
      UP: [65000, 72000, 83000, 95000, 105000],
      AP: [170000, 192000, 215000, 245000, 270000],
      TS: [232000, 266000, 306000, 351000, 390000],
      HR: [235000, 262000, 292000, 331000, 365000],
      WB: [115000, 126000, 141000, 160000, 175000]
    },
    // 3. Revenue Quality
    own_tax_gsdp: {
      name: "Own Tax Revenue (% of GSDP)",
      description: "State's own tax mobilization capacity (excluding central devolutions). High is better.",
      MH: [7.2, 7.5, 7.8, 7.9, 8.0],
      TN: [5.8, 6.0, 6.1, 6.2, 6.2],
      GJ: [5.0, 5.2, 5.3, 5.3, 5.3],
      KA: [6.4, 6.6, 6.8, 6.8, 6.8],
      UP: [7.1, 7.4, 7.7, 7.7, 7.8], // UP BE was 10.3% but adjusted to actual baseline
      AP: [6.2, 6.4, 6.6, 6.7, 6.7],
      TS: [7.5, 7.8, 8.1, 8.2, 8.4],
      HR: [6.5, 6.8, 7.0, 7.0, 7.0],
      WB: [5.0, 5.2, 5.4, 5.4, 5.4]
    },
    central_transfers: {
      name: "Central Transfers (% of Revenue Receipts)",
      description: "Share of tax devolution and grants-in-aid from the Federal/Central Government in total revenue receipts. Higher dependency indicates lower fiscal autonomy.",
      MH: [32.0, 28.0, 25.0, 24.0, 23.0],
      TN: [36.0, 32.0, 28.0, 29.0, 28.0],
      GJ: [25.0, 21.0, 18.0, 19.0, 18.0],
      KA: [31.0, 26.0, 24.0, 25.0, 24.0],
      UP: [62.0, 58.0, 55.0, 56.0, 54.0],
      AP: [53.0, 48.0, 45.0, 47.0, 46.0],
      TS: [29.0, 26.0, 23.0, 24.0, 23.0],
      HR: [28.0, 25.0, 22.0, 24.0, 23.0],
      WB: [52.0, 48.0, 44.0, 46.0, 45.0]
    },
    // 4. Expenditure Quality
    committed_exp: {
      name: "Committed Expenditure (% of Revenue Receipts)",
      description: "Fixed payments (salaries, pension, interest). Higher ratio leaves less room for developmental works.",
      MH: [57, 56, 55, 55, 55],
      TN: [66, 65, 64, 64, 64],
      GJ: [47, 46, 45, 45, 45],
      KA: [57, 56, 55, 55, 55],
      UP: [55, 54, 53, 53, 53],
      AP: [62, 61, 60, 60, 60],
      TS: [52, 51, 50, 50, 50],
      HR: [60, 59, 58, 58, 58],
      WB: [62, 61, 60, 60, 60]
    },
    subsidies: {
      name: "Subsidy Expenditure (% of Revenue Receipts)",
      description: "Outlays on populist and welfare programs. Higher share reduces developmental capital spending.",
      MH: [5.2, 5.1, 5.0, 5.0, 5.0],
      TN: [9.2, 9.0, 9.0, 9.0, 9.0],
      GJ: [13.2, 13.0, 13.0, 13.0, 13.0],
      KA: [11.2, 11.0, 11.0, 11.0, 11.0],
      UP: [9.2, 9.0, 9.0, 9.0, 9.0],
      AP: [15.2, 15.0, 15.0, 15.0, 15.0],
      TS: [10.2, 10.0, 10.0, 10.0, 10.0],
      HR: [10.2, 10.0, 10.0, 10.0, 10.0],
      WB: [9.2, 9.0, 9.0, 9.0, 9.0]
    },
    // 5. Macro-Fiscal / SDL Cost of Borrowings
    borrowing_spread: {
      name: "SDL Yield Spread over G-Sec (Basis Points)",
      description: "Cost premium paid by the state to borrow in the market relative to Central Govt. Reflects state risk.",
      MH: [18, 19, 18, 20, 20],
      TN: [32, 33, 31, 34, 34],
      GJ: [15, 16, 15, 18, 18],
      KA: [22, 23, 21, 24, 24],
      UP: [25, 26, 24, 27, 27],
      AP: [45, 47, 44, 49, 49],
      TS: [38, 39, 36, 41, 41],
      HR: [24, 25, 23, 26, 26],
      WB: [43, 45, 42, 46, 46]
    }
  },
  sdl_yields: {
    // SDL average yields by state for FY24 (typical baseline)
    name: "Average SDL Borrowing Yield (%)",
    description: "Annual market interest rate for State Development Loans.",
    MH: 7.42,
    TN: 7.56,
    GJ: 7.40,
    KA: 7.46,
    UP: 7.49,
    AP: 7.71,
    TS: 7.63,
    HR: 7.48,
    WB: 7.68
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = fiscalData;
} else {
  window.fiscalData = fiscalData;
}
