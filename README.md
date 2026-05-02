# Co-pilot — Educational Portfolio Simulator

An educational tool for beginner investors. Stress-test hypothetical portfolios against real historical scenarios — 2008 crisis, 2020 COVID crash, 2022 inflation shock — with proper Monte Carlo math and AI-powered plain-language explanations.

**This is an educational simulation tool, not a registered investment advisor. It does not connect to brokerage accounts and does not provide personalized financial advice.**

**Built by:** Parth Mitesh Shah · MS Finance, UT Dallas

---

## What's new in v2

This version was built specifically to be **defensible in front of fintech interviewers, investors, and people who actually do this for a living.** Major upgrades from v1:

### 1. Real historical data layer
- Pulls 10 years of weekly historical price data for 8 ETFs from Stooq (free, reliable)
- Computes annualized returns, volatilities, and the full correlation matrix from real data
- GitHub Actions workflow refreshes the data weekly (Mondays at 6am UTC)
- Baseline data file ships with the repo, so the app works immediately even before the first refresh

### 2. Proper Monte Carlo simulation
- 2,000 simulated paths per projection (was: weighted-vol shortcut)
- Geometric Brownian Motion per asset
- **Cholesky-decomposed correlated random shocks** — this captures how assets actually move together during stress events. Without proper correlation, simulations dramatically understate portfolio risk.
- Outputs proper percentile bands (10th, 25th, 50th, 75th, 90th), not just expected/optimistic/pessimistic

### 3. Historical backtesting
- Three real historical events baked in: 2008 financial crisis, 2020 COVID crash, 2022 inflation shock
- For each event, we compute what your hypothetical portfolio would have **actually returned** during that period using real asset class returns
- This is real history, not simulation — defensible math you can show to anyone

### 4. Educational, not advisory framing
- All scenario language rewritten from "you should do X" (advisory) to "investors generally consider X" (educational)
- Clear disclaimers throughout: top banner, scenario cards, footer, About modal
- Explicit non-affiliation with any registered investment advisor
- Compliant with the educational/calculator side of the SEC line

### 5. Validation infrastructure
- Plausible Analytics integration with custom event tracking (scenario clicks, completion rates, feedback)
- Per-scenario thumbs up/down feedback widget
- Open Graph metadata for social sharing
- About modal explaining methodology and limitations

---

## What it does

**Three screens, end to end:**

1. **Onboarding (5 questions)** → Risk profile + starting allocation
2. **Dashboard** → Hypothetical portfolio with Monte Carlo projection (2,000 paths, 80% confidence band)
3. **Scenario Stress Test** → Pick a scenario, see simulated impact + real historical backtest + AI-generated educational explanation

**6 built-in scenarios:**
- 📉 Market crashes 30% (with 2020 COVID backtest)
- 💰 Need $20K in 3 months
- 🔥 Inflation jumps to 8% (with 2022 backtest)
- ☔ Recession hits next year (with 2008 backtest)
- 🏠 Buying a house in 2 years
- 👶 Just had a kid

---

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Optional: AI explanations via Claude

The app works fully without an API key — it falls back to pre-written educational content. To enable LLM-generated explanations:

```bash
cp .env.example .env
# Edit .env and add your Anthropic key
```

Get a key at: https://console.anthropic.com/

The app uses `claude-haiku-4-5` (fast, ~$0.0002 per scenario click).

---

## Refreshing market data

The data file at `data/market_data.json` ships with the repo, so the app works immediately. To refresh manually:

```bash
pip install pandas numpy requests
python scripts/fetch_market_data.py
```

The GitHub Actions workflow does this automatically every Monday at 6am UTC. Set it up by:

1. Push the repo to GitHub
2. Go to Settings → Actions → General → Workflow permissions → "Read and write permissions"
3. The workflow will run weekly. You can also trigger it manually from the Actions tab.

---

## Deploy to Vercel

```bash
git push origin main
```

Then go to [vercel.com/new](https://vercel.com/new), import your repo, click Deploy.

If using the AI layer, add `VITE_ANTHROPIC_API_KEY` to Vercel environment variables (Project → Settings → Environment Variables).

If using Plausible Analytics, edit `index.html` and replace `your-domain.com` with your actual domain.

---

## Architecture

```
copilot-v2/
├── data/
│   └── market_data.json           ← Refreshed weekly by GitHub Actions
├── scripts/
│   └── fetch_market_data.py       ← Pulls historical data from Stooq
├── .github/workflows/
│   └── refresh-market-data.yml    ← Weekly cron job
├── src/
│   ├── engine.js                  ← All financial logic (MC, backtest, scenarios)
│   ├── App.jsx                    ← All UI (4 screens)
│   ├── main.jsx                   ← React entry
│   └── index.css                  ← Fonts + Tailwind
├── index.html                     ← Plausible analytics + OG metadata
└── ...config files
```

The `engine.js` file is the brain. Everything testable lives there. The UI is a thin presentation layer over it.

---

## Tech stack

- Vite + React 18
- Tailwind CSS
- Recharts
- Lucide React
- Anthropic Claude API (haiku-4-5) for explanations
- Plausible Analytics (privacy-friendly, no cookie banner needed)
- Python (pandas, numpy, requests) for the data fetcher
- GitHub Actions for the weekly refresh

---

## Disclaimers

This tool is provided for **educational purposes only**. It is not investment, financial, tax, or legal advice. The author is not a registered investment advisor (RIA), broker-dealer, or fiduciary. The tool does not connect to any real brokerage account and cannot execute trades.

Recommendations and considerations shown are general educational principles drawn from financial research, not specific advice for any individual's situation. Past performance does not predict future results. Monte Carlo projections are simulations based on historical statistics and may differ significantly from actual outcomes.

Consult a licensed financial advisor before making investment decisions. The author bears no responsibility for outcomes from decisions made based on this tool.
