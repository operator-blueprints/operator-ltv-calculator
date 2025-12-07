let ltvChart = null;

function parseNumber(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = String(el.value || "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "–";
  return (
    "$" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "–";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatRatio(value) {
  if (!Number.isFinite(value) || value <= 0) return "–";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + "x";
}

function timeUnitLabel(unit, plural = true) {
  if (unit === "week") return plural ? "weeks" : "week";
  if (unit === "year") return plural ? "years" : "year";
  return plural ? "months" : "month";
}

function syncHorizonLabel(value) {
  const n = Number(value) || 0;
  const unit = document.getElementById("timeUnit").value || "month";
  const label = document.getElementById("horizonLabel");
  if (label) {
    label.textContent = `${n} ${timeUnitLabel(unit, n !== 1)}`;
  }
}

function resetSummary() {
  document.getElementById("ltvRevenuePerCustomer").textContent = "–";
  document.getElementById("ltvMarginPerCustomer").textContent = "–";
  document.getElementById("ltvCACRatio").textContent = "–";
  document.getElementById("ltvMarginCohort").textContent = "–";

  document.getElementById("kpiHorizonLabel").textContent = "–";
  document.getElementById("kpiMarginLabel").textContent = "–";
  document.getElementById("ltvCACNote").textContent =
    "Add CAC to see LTV:CAC and payback.";

  const summaryList = document.getElementById("summaryList");
  if (summaryList) {
    summaryList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "Run the LTV model to populate your summary.";
    summaryList.appendChild(li);
  }

  if (ltvChart) {
    ltvChart.data.labels = [];
    ltvChart.data.datasets[0].data = [];
    ltvChart.data.datasets[1].data = [];
    ltvChart.update();
  }
}

function runLTV() {
  const cohortSize = Math.max(parseNumber("cohortSize"), 1);
  const aov = parseNumber("aov");
  const ordersPerPeriod = parseNumber("ordersPerPeriod") || 0;
  const grossMarginPct = parseNumber("grossMargin");
  const churnPct = parseNumber("churnRate");
  const horizon = Math.max(parseNumber("horizon"), 1);
  const discountPct = parseNumber("discountRate");
  const cac = parseNumber("cac");

  const unit = document.getElementById("timeUnit").value || "month";

  // Basic validation
  if (aov <= 0 || ordersPerPeriod <= 0 || grossMarginPct < 0 || grossMarginPct > 100) {
    resetSummary();
    return;
  }
  if (churnPct < 0 || churnPct >= 100) {
    resetSummary();
    return;
  }

  const churn = churnPct / 100;
  const marginRate = grossMarginPct / 100;
  const discountRate = discountPct > 0 ? discountPct / 100 : 0;

  let activeCustomers = 1; // per-customer basis
  let cumulativeRevenuePerCustomer = 0;
  let cumulativeMarginPerCustomer = 0;

  const labels = [];
  const activeSeries = [];
  const ltvSeries = [];

  let paybackPeriod = null;
  let runningMarginVsCAC = 0;

  for (let t = 1; t <= horizon; t++) {
    const periodLabel = `${t}`;
    labels.push(periodLabel);

    if (t === 1) {
      activeCustomers = 1;
    } else {
      activeCustomers = activeCustomers * (1 - churn);
    }

    const orders = activeCustomers * ordersPerPeriod;
    const revenue = orders * aov;
    const margin = revenue * marginRate;

    const discountFactor = discountRate > 0 ? 1 / Math.pow(1 + discountRate, t - 1) : 1;
    const discountedRevenue = revenue * discountFactor;
    const discountedMargin = margin * discountFactor;

    cumulativeRevenuePerCustomer += discountedRevenue;
    cumulativeMarginPerCustomer += discountedMargin;

    activeSeries.push(activeCustomers * 100); // % of original cohort
    ltvSeries.push(cumulativeMarginPerCustomer);

    if (cac > 0 && paybackPeriod === null) {
      runningMarginVsCAC += discountedMargin;
      if (runningMarginVsCAC >= cac) {
        paybackPeriod = t;
      }
    }
  }

  const ltvRevenuePerCustomer = cumulativeRevenuePerCustomer;
  const ltvMarginPerCustomer = cumulativeMarginPerCustomer;
  const ltvMarginCohort = ltvMarginPerCustomer * cohortSize;

  // Update KPIs
  document.getElementById("ltvRevenuePerCustomer").textContent =
    formatCurrency(ltvRevenuePerCustomer);
  document.getElementById("ltvMarginPerCustomer").textContent =
    formatCurrency(ltvMarginPerCustomer);
  document.getElementById("ltvMarginCohort").textContent =
    formatCurrency(ltvMarginCohort);

  document.getElementById("kpiHorizonLabel").textContent =
    `${horizon} ${timeUnitLabel(unit, horizon !== 1)}`;
  document.getElementById("kpiMarginLabel").textContent =
    `${grossMarginPct.toFixed(1)}%`;

  const ltvCACRatioValue =
    cac > 0 ? ltvMarginPerCustomer / cac : NaN;
  document.getElementById("ltvCACRatio").textContent =
    cac > 0 ? formatRatio(ltvCACRatioValue) : "–";

  const ltvCACNoteEl = document.getElementById("ltvCACNote");
  if (cac > 0) {
    if (paybackPeriod !== null) {
      ltvCACNoteEl.textContent = `Payback reached in ~${paybackPeriod} ${timeUnitLabel(
        unit,
        paybackPeriod !== 1
      )}.`;
    } else {
      ltvCACNoteEl.textContent = `Payback not reached within ${horizon} ${timeUnitLabel(
        unit,
        horizon !== 1
      )}.`;
    }
  } else {
    ltvCACNoteEl.textContent = "Add CAC to see LTV:CAC and payback.";
  }

  // Summary list
  const summaryList = document.getElementById("summaryList");
  summaryList.innerHTML = "";

  const li1 = document.createElement("li");
  li1.textContent = `Over ${horizon} ${timeUnitLabel(
    unit,
    horizon !== 1
  )}, LTV per customer (revenue) is ${formatCurrency(ltvRevenuePerCustomer)}, with gross-margin LTV of ${formatCurrency(
    ltvMarginPerCustomer
  )}.`;
  summaryList.appendChild(li1);

  const li2 = document.createElement("li");
  li2.textContent = `Your model assumes ${ordersPerPeriod.toFixed(
    2
  )} orders per ${timeUnitLabel(unit)} at an AOV of ${formatCurrency(aov)}, with ${grossMarginPct.toFixed(
    1
  )}% gross margin.`;
  summaryList.appendChild(li2);

  const li3 = document.createElement("li");
  li3.textContent = `Churn is ${churnPct.toFixed(
    1
  )}% per ${timeUnitLabel(unit)}, meaning only ${formatNumber(
    activeSeries[activeSeries.length - 1]
  )}% of the original cohort remains active by the end of the horizon.`;
  summaryList.appendChild(li3);

  if (cac > 0) {
    const li4 = document.createElement("li");
    const ratioText = formatRatio(ltvCACRatioValue);
    if (paybackPeriod !== null) {
      li4.textContent = `With CAC at ${formatCurrency(
        cac
      )}, your LTV:CAC is ${ratioText}, and you hit payback around period ${paybackPeriod}.`;
    } else {
      li4.textContent = `With CAC at ${formatCurrency(
        cac
      )}, your LTV:CAC is ${ratioText}, but payback is not reached within the modeled horizon.`;
    }
    summaryList.appendChild(li4);
  }

  // Chart
  renderLtvChart(labels, activeSeries, ltvSeries, unit);
}

function renderLtvChart(labels, activeSeries, ltvSeries, unit) {
  const ctx = document.getElementById("ltvChart");
  if (!ctx) return;

  if (!ltvChart) {
    ltvChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Active Customers (% of Cohort)",
            data: activeSeries,
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.2)",
            borderWidth: 2,
            tension: 0.25,
            yAxisID: "y",
          },
          {
            label: "Cumulative Gross-Margin LTV per Customer (USD)",
            data: ltvSeries,
            borderColor: "#a855f7",
            backgroundColor: "rgba(168, 85, 247, 0.15)",
            borderWidth: 2,
            tension: 0.25,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: "#e5e7eb",
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const label = context.dataset.label || "";
                const value = context.parsed.y;
                if (label.includes("LTV")) {
                  return `${label}: ${formatCurrency(value)}`;
                }
                return `${label}: ${value.toFixed(1)}%`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#9ca3af",
            },
            grid: {
              color: "rgba(55, 65, 81, 0.6)",
            },
            title: {
              display: true,
              text: `Period (${timeUnitLabel(unit)})`,
              color: "#9ca3af",
              font: { size: 11 },
            },
          },
          y: {
            position: "left",
            ticks: {
              color: "#9ca3af",
              callback: (value) => `${value.toFixed(0)}%`,
            },
            grid: {
              color: "rgba(31, 41, 55, 0.7)",
            },
          },
          y1: {
            position: "right",
            ticks: {
              color: "#9ca3af",
              callback: (value) => "$" + value.toFixed(0),
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  } else {
    ltvChart.data.labels = labels;
    ltvChart.data.datasets[0].data = activeSeries;
    ltvChart.data.datasets[1].data = ltvSeries;
    ltvChart.options.scales.x.title.text = `Period (${timeUnitLabel(unit)})`;
    ltvChart.update();
  }
}

function resetLTVInputs() {
  const form = document.getElementById("ltv-form");
  if (form) form.reset();

  // Restore defaults
  document.getElementById("cohortSize").value = "100";
  document.getElementById("aov").value = "80";
  document.getElementById("ordersPerPeriod").value = "1";
  document.getElementById("grossMargin").value = "65";
  document.getElementById("churnRate").value = "8";
  document.getElementById("horizon").value = "24";
  document.getElementById("timeUnit").value = "month";

  syncHorizonLabel(24);
  resetSummary();
}

function downloadLTVCsv() {
  const cohortSize = Math.max(parseNumber("cohortSize"), 1);
  const aov = parseNumber("aov");
  const ordersPerPeriod = parseNumber("ordersPerPeriod") || 0;
  const grossMarginPct = parseNumber("grossMargin");
  const churnPct = parseNumber("churnRate");
  const horizon = Math.max(parseNumber("horizon"), 1);
  const discountPct = parseNumber("discountRate");
  const cac = parseNumber("cac");
  const unit = document.getElementById("timeUnit").value || "month";

  if (aov <= 0 || ordersPerPeriod <= 0 || grossMarginPct < 0 || grossMarginPct > 100) {
    return;
  }
  if (churnPct < 0 || churnPct >= 100) {
    return;
  }

  const churn = churnPct / 100;
  const marginRate = grossMarginPct / 100;
  const discountRate = discountPct > 0 ? discountPct / 100 : 0;

  let activeCustomers = 1;
  let cumulativeRevenuePerCustomer = 0;
  let cumulativeMarginPerCustomer = 0;

  let csv =
    "Period,Active Customers (% of cohort),Revenue per Customer,Gross Margin per Customer,Cumulative Margin per Customer,Cumulative Margin per Cohort\n";

  for (let t = 1; t <= horizon; t++) {
    if (t === 1) {
      activeCustomers = 1;
    } else {
      activeCustomers = activeCustomers * (1 - churn);
    }

    const orders = activeCustomers * ordersPerPeriod;
    const revenue = orders * aov;
    const margin = revenue * marginRate;

    const discountFactor = discountRate > 0 ? 1 / Math.pow(1 + discountRate, t - 1) : 1;
    const discountedRevenue = revenue * discountFactor;
    const discountedMargin = margin * discountFactor;

    cumulativeRevenuePerCustomer += discountedRevenue;
    cumulativeMarginPerCustomer += discountedMargin;

    const cumulativeMarginCohort = cumulativeMarginPerCustomer * cohortSize;

    csv += [
      t,
      (activeCustomers * 100).toFixed(2),
      discountedRevenue.toFixed(2),
      discountedMargin.toFixed(2),
      cumulativeMarginPerCustomer.toFixed(2),
      cumulativeMarginCohort.toFixed(2),
    ].join(",") + "\n";
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ltv_calculator_output.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  // Initial label sync
  const horizonInput = document.getElementById("horizon");
  if (horizonInput) {
    syncHorizonLabel(horizonInput.value);
  }

  // Live recalc on change
  const inputsToWatch = [
    "cohortSize",
    "aov",
    "ordersPerPeriod",
    "grossMargin",
    "churnRate",
    "horizon",
    "timeUnit",
    "discountRate",
    "cac",
  ];

  inputsToWatch.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => runLTV());
    el.addEventListener("change", () => runLTV());
  });

  // First render
  resetSummary();
  runLTV();
});
