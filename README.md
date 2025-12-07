# Operator Blueprints – LTV Calculator Tool

A minimalist OperatorOS-style LTV calculator built as a static web app (HTML/CSS/JS), matching the Revenue Forecast Tool’s Style A layout.

## Features

- Per-customer LTV (revenue and gross margin)
- Cohort-level gross-margin LTV
- Churn-based retention curve
- Optional discount rate per period
- Optional CAC input with:
  - LTV:CAC ratio
  - Payback period within the modeled horizon
- Dual-axis chart (active cohort % + cumulative margin LTV per customer)
- CSV export of the full LTV curve

## Stack

- Static HTML
- Vanilla CSS (Style A · Minimalist Operator Dashboard)
- Vanilla JS
- Chart.js via CDN

## Local Setup

```bash
# in an empty folder
# add index.html, styles.css, script.js, README.md

# if using git
git init
git add .
git commit -m "Initial commit – Operator LTV Calculator"
