# CORTEX Web (`cortex-web/`)

React 18 + Vite web frontend for the CORTEX microservices.

## Setup
1. Install dependencies:
   - `npm install`
2. Run dev server:
   - `npm run dev`

## Dashboard Metric Note
- Sales chart uses daily transaction revenue.
- Profit chart uses `sales - cogs`.
- Turnover chart uses `cogs / inventory_value`.

With these formulas, shapes are expected to be similar when cost ratios stay stable.  
Verification query on current 30-day data produced high pairwise correlations:
- `corr(sales, profit) = 0.999862`
- `corr(sales, turnover) = 0.905339`
- `corr(profit, turnover) = 0.898169`
