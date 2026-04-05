// ============================================================
//  PocketSense — data.js   (load BEFORE app.js)
//  All data lives inside window.FF_DATA to avoid conflicts
// ============================================================
(function () {

  var CATEGORIES = [
    { id: "food",       label: "Food & Dining",  icon: "🍽️",  color: "#f472b6" },
    { id: "transport",  label: "Transport",       icon: "🚗",  color: "#60a5fa" },
    { id: "shopping",   label: "Shopping",        icon: "🛍️",  color: "#fb923c" },
    { id: "utilities",  label: "Utilities",       icon: "💡",  color: "#fbbf24" },
    { id: "entertain",  label: "Entertainment",   icon: "🎬",  color: "#a78bfa" },
    { id: "health",     label: "Healthcare",      icon: "💊",  color: "#34d399" },
    { id: "salary",     label: "Salary",          icon: "💼",  color: "#22d3ee" },
    { id: "freelance",  label: "Freelance",       icon: "🧑‍💻", color: "#a3e635" },
    { id: "investment", label: "Investment",      icon: "📈",  color: "#4ade80" },
    { id: "other",      label: "Other",           icon: "📦",  color: "#94a3b8" },
  ];

  var CAT_MAP = {};
  CATEGORIES.forEach(function(c){ CAT_MAP[c.label] = c; });

  var CHART_COLORS = CATEGORIES.map(function(c){ return c.color; });

  var SEED_TRANSACTIONS = [
    { date:"2025-01-03", desc:"Monthly Salary",        category:"Salary",        type:"income",  amount:85000 },
    { date:"2025-01-05", desc:"Grocery Store",          category:"Food & Dining", type:"expense", amount:3200  },
    { date:"2025-01-07", desc:"Electricity Bill",       category:"Utilities",     type:"expense", amount:1800  },
    { date:"2025-01-10", desc:"Freelance Project UI",   category:"Freelance",     type:"income",  amount:22000 },
    { date:"2025-01-12", desc:"Netflix",                category:"Entertainment", type:"expense", amount:649   },
    { date:"2025-01-15", desc:"Petrol",                 category:"Transport",     type:"expense", amount:2500  },
    { date:"2025-01-18", desc:"Medical Checkup",        category:"Healthcare",    type:"expense", amount:1200  },
    { date:"2025-01-20", desc:"Amazon Shopping",        category:"Shopping",      type:"expense", amount:4300  },
    { date:"2025-01-22", desc:"Mutual Fund SIP",        category:"Investment",    type:"expense", amount:10000 },
    { date:"2025-01-28", desc:"Restaurant Dinner",      category:"Food & Dining", type:"expense", amount:1800  },
    { date:"2025-02-01", desc:"Monthly Salary",         category:"Salary",        type:"income",  amount:85000 },
    { date:"2025-02-03", desc:"Grocery Store",          category:"Food & Dining", type:"expense", amount:2900  },
    { date:"2025-02-06", desc:"Internet & Water Bill",  category:"Utilities",     type:"expense", amount:2200  },
    { date:"2025-02-08", desc:"Uber Rides",             category:"Transport",     type:"expense", amount:1100  },
    { date:"2025-02-10", desc:"Freelance Consulting",   category:"Freelance",     type:"income",  amount:15000 },
    { date:"2025-02-14", desc:"Valentine's Dinner",     category:"Food & Dining", type:"expense", amount:3500  },
    { date:"2025-02-17", desc:"Clothes",                category:"Shopping",      type:"expense", amount:5600  },
    { date:"2025-02-20", desc:"Gym Membership",         category:"Healthcare",    type:"expense", amount:2000  },
    { date:"2025-02-22", desc:"Stock Gain",             category:"Investment",    type:"income",  amount:8500  },
    { date:"2025-02-25", desc:"Movie Tickets",          category:"Entertainment", type:"expense", amount:900   },
    { date:"2025-03-01", desc:"Monthly Salary",         category:"Salary",        type:"income",  amount:85000 },
    { date:"2025-03-04", desc:"Grocery Store",          category:"Food & Dining", type:"expense", amount:3400  },
    { date:"2025-03-07", desc:"Electricity Bill",       category:"Utilities",     type:"expense", amount:2100  },
    { date:"2025-03-10", desc:"Petrol",                 category:"Transport",     type:"expense", amount:2800  },
    { date:"2025-03-12", desc:"Freelance App Dev",      category:"Freelance",     type:"income",  amount:30000 },
    { date:"2025-03-15", desc:"Pharmacy",               category:"Healthcare",    type:"expense", amount:1500  },
    { date:"2025-03-18", desc:"Online Shopping",        category:"Shopping",      type:"expense", amount:8900  },
    { date:"2025-03-21", desc:"Spotify Premium",        category:"Entertainment", type:"expense", amount:119   },
    { date:"2025-03-24", desc:"Mutual Fund SIP",        category:"Investment",    type:"expense", amount:10000 },
    { date:"2025-03-28", desc:"Food Delivery",          category:"Food & Dining", type:"expense", amount:1200  },
    { date:"2025-04-01", desc:"Monthly Salary",         category:"Salary",        type:"income",  amount:88000 },
    { date:"2025-04-04", desc:"Grocery Store",          category:"Food & Dining", type:"expense", amount:3100  },
    { date:"2025-04-06", desc:"Utility Bills",          category:"Utilities",     type:"expense", amount:1950  },
    { date:"2025-04-09", desc:"Cab & Auto",             category:"Transport",     type:"expense", amount:1400  },
    { date:"2025-04-11", desc:"Freelance Design",       category:"Freelance",     type:"income",  amount:45000 },
    { date:"2025-04-14", desc:"Clothing Haul",          category:"Shopping",      type:"expense", amount:6200  },
    { date:"2025-04-17", desc:"Doctor Visit",           category:"Healthcare",    type:"expense", amount:800   },
    { date:"2025-04-19", desc:"Cricket Tickets",        category:"Entertainment", type:"expense", amount:2500  },
    { date:"2025-04-22", desc:"Stock Dividend",         category:"Investment",    type:"income",  amount:3200  },
    { date:"2025-04-27", desc:"Birthday Dinner",        category:"Food & Dining", type:"expense", amount:4500  },
    { date:"2025-05-01", desc:"Monthly Salary",         category:"Salary",        type:"income",  amount:88000 },
    { date:"2025-05-04", desc:"Grocery Store",          category:"Food & Dining", type:"expense", amount:2750  },
    { date:"2025-05-06", desc:"Electricity & Internet", category:"Utilities",     type:"expense", amount:2400  },
    { date:"2025-05-09", desc:"Petrol",                 category:"Transport",     type:"expense", amount:3100  },
    { date:"2025-05-12", desc:"Freelance Design Work",  category:"Freelance",     type:"income",  amount:18000 },
    { date:"2025-05-15", desc:"Home Appliances",        category:"Shopping",      type:"expense", amount:12000 },
    { date:"2025-05-17", desc:"Dental Checkup",         category:"Healthcare",    type:"expense", amount:2200  },
    { date:"2025-05-20", desc:"Disney+ Subscription",   category:"Entertainment", type:"expense", amount:299   },
    { date:"2025-05-23", desc:"Mutual Fund SIP",        category:"Investment",    type:"expense", amount:10000 },
    { date:"2025-05-28", desc:"Restaurant Lunch",       category:"Food & Dining", type:"expense", amount:1600  },
    { date:"2025-06-01", desc:"Monthly Salary",         category:"Salary",        type:"income",  amount:88000 },
    { date:"2025-06-04", desc:"Grocery Store",          category:"Food & Dining", type:"expense", amount:3300  },
    { date:"2025-06-06", desc:"Internet + Mobile",      category:"Utilities",     type:"expense", amount:1600  },
    { date:"2025-06-09", desc:"Metro & Buses",          category:"Transport",     type:"expense", amount:900   },
    { date:"2025-06-11", desc:"Freelance Project",      category:"Freelance",     type:"income",  amount:27000 },
    { date:"2025-06-13", desc:"Gaming Setup",           category:"Shopping",      type:"expense", amount:15000 },
    { date:"2025-06-16", desc:"Gym + Supplements",      category:"Healthcare",    type:"expense", amount:3500  },
    { date:"2025-06-19", desc:"Concert Tickets",        category:"Entertainment", type:"expense", amount:4000  },
    { date:"2025-06-22", desc:"Stock Gain",             category:"Investment",    type:"income",  amount:11000 },
    { date:"2025-06-27", desc:"Swiggy / Zomato",        category:"Food & Dining", type:"expense", amount:2100  },
  ];

  // ── Helpers ──────────────────────────────────────────────
  function fmtCurrency(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }
  function fmtDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  }
  function fmtMonth(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-IN", { month:"short", year:"numeric" });
  }
  function getCat(catLabel) {
    return CAT_MAP[catLabel] || { icon:"📦", color:"#94a3b8", label: catLabel || "Other" };
  }

  // ── Expose as single global namespace ────────────────────
  window.FF_DATA = {
    CATEGORIES: CATEGORIES,
    CAT_MAP: CAT_MAP,
    CHART_COLORS: CHART_COLORS,
    SEED_TRANSACTIONS: SEED_TRANSACTIONS,
    fmtCurrency: fmtCurrency,
    fmtDate: fmtDate,
    fmtMonth: fmtMonth,
    getCat: getCat
  };

})();