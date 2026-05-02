"""
Historical Market Data Fetcher
==============================
Pulls 10 years of weekly historical price data for our ETF universe from Stooq
(a free, reliable, non-rate-limited data source widely used in academic finance).

Computes:
- Annualized expected returns per asset
- Annualized volatilities per asset
- Correlation matrix across all assets
- Historical scenario data (2008 crash, 2020 COVID, 2022 inflation)

Writes everything to data/market_data.json which the React app imports at build time.

Run via GitHub Actions every Monday at 6am UTC, or manually:
    python scripts/fetch_market_data.py

Author: Parth Mitesh Shah
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from io import StringIO

# =============================================================================
# CONFIGURATION
# =============================================================================
ASSETS = [
    {"ticker": "VTI",  "stooq_symbol": "vti.us",  "name": "US Total Stock Market",     "asset_class": "us_equity"},
    {"ticker": "VXUS", "stooq_symbol": "vxus.us", "name": "International Developed",   "asset_class": "intl_equity"},
    {"ticker": "VWO",  "stooq_symbol": "vwo.us",  "name": "Emerging Markets",          "asset_class": "em_equity"},
    {"ticker": "BND",  "stooq_symbol": "bnd.us",  "name": "US Total Bond Market",      "asset_class": "us_bond"},
    {"ticker": "BNDX", "stooq_symbol": "bndx.us", "name": "International Bonds",       "asset_class": "intl_bond"},
    {"ticker": "TIP",  "stooq_symbol": "tip.us",  "name": "Inflation-Protected Bonds", "asset_class": "tips"},
    {"ticker": "VNQ",  "stooq_symbol": "vnq.us",  "name": "Real Estate",               "asset_class": "reit"},
    # Cash modeled as 3-month T-bill proxy. We don't fetch it; we use a constant 4.5% annualized return.
]

LOOKBACK_YEARS = 10
TRADING_DAYS_PER_YEAR = 252

# Historical scenarios — defined as date ranges. We'll extract actual asset returns
# during these windows from the historical data.
HISTORICAL_SCENARIOS = [
    {
        "id": "2008_crash",
        "label": "2008 Financial Crisis",
        "start": "2008-09-01",
        "end": "2009-03-09",
        "description": "Lehman Brothers collapse through market bottom. The textbook example of a financial crisis."
    },
    {
        "id": "2020_covid",
        "label": "COVID Crash (2020)",
        "start": "2020-02-19",
        "end": "2020-03-23",
        "description": "Fastest 35% drawdown in S&P 500 history. Total market panic over 5 weeks."
    },
    {
        "id": "2022_inflation",
        "label": "2022 Inflation Shock",
        "start": "2022-01-03",
        "end": "2022-10-12",
        "description": "Worst year for the 60/40 portfolio in 100+ years. Stocks AND bonds fell together as the Fed hiked aggressively."
    },
]


# =============================================================================
# DATA FETCHING
# =============================================================================
def fetch_stooq_history(stooq_symbol, start_date, end_date):
    """
    Fetch historical daily OHLC data from Stooq. Free, no API key, no rate limits.
    Returns a pandas DataFrame indexed by date with a 'close' column.
    """
    url = f"https://stooq.com/q/d/l/?s={stooq_symbol}&d1={start_date.strftime('%Y%m%d')}&d2={end_date.strftime('%Y%m%d')}&i=d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/csv,application/csv,*/*;q=0.8",
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        if "No data" in response.text or len(response.text.strip()) < 100:
            print(f"  ! Stooq returned no data for {stooq_symbol}", file=sys.stderr)
            return None
        df = pd.read_csv(StringIO(response.text))
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.set_index("Date").sort_index()
        return df[["Close"]].rename(columns={"Close": "close"})
    except Exception as e:
        print(f"  ! Failed to fetch {stooq_symbol}: {e}", file=sys.stderr)
        return None


def compute_returns(price_series):
    """Daily log returns from a price series."""
    return np.log(price_series / price_series.shift(1)).dropna()


# =============================================================================
# STATISTICS
# =============================================================================
def annualized_return(daily_log_returns):
    """Convert daily log returns to annualized arithmetic return."""
    mean_daily = daily_log_returns.mean()
    return float(np.exp(mean_daily * TRADING_DAYS_PER_YEAR) - 1)


def annualized_volatility(daily_log_returns):
    """Annualized standard deviation of returns."""
    return float(daily_log_returns.std() * np.sqrt(TRADING_DAYS_PER_YEAR))


def compute_correlation_matrix(returns_df):
    """Pearson correlation matrix across all assets."""
    return returns_df.corr().round(4).to_dict()


# =============================================================================
# HISTORICAL SCENARIO EXTRACTION
# =============================================================================
def extract_scenario_returns(price_data, scenario):
    """
    Given a scenario date range, compute the total return for each asset
    over that window. Returns a dict of {asset_class: cumulative_return}.
    """
    start = pd.Timestamp(scenario["start"])
    end = pd.Timestamp(scenario["end"])
    returns_by_class = {}

    for ticker, prices in price_data.items():
        # Find closest available trading days
        before = prices.loc[:start]
        after = prices.loc[end:]
        if before.empty or after.empty:
            continue
        start_price = before["close"].iloc[-1]
        end_price = after["close"].iloc[0]
        cumulative_return = float((end_price / start_price) - 1)

        # Map ticker to asset class
        asset_meta = next((a for a in ASSETS if a["ticker"] == ticker), None)
        if asset_meta:
            returns_by_class[asset_meta["asset_class"]] = round(cumulative_return, 4)

    return returns_by_class


# =============================================================================
# MAIN
# =============================================================================
def main():
    end_date = datetime.now()
    start_date = end_date - timedelta(days=LOOKBACK_YEARS * 365 + 60)  # buffer for holidays

    print(f"Fetching {LOOKBACK_YEARS} years of historical data ({start_date.date()} to {end_date.date()})...")
    print()

    price_data = {}
    for asset in ASSETS:
        print(f"  Fetching {asset['ticker']:5s} ({asset['name']})...")
        df = fetch_stooq_history(asset["stooq_symbol"], start_date, end_date)
        if df is not None and len(df) > 100:
            price_data[asset["ticker"]] = df
            print(f"    ✓ {len(df)} days of data, latest close: ${df['close'].iloc[-1]:.2f}")
        else:
            print(f"    ✗ Insufficient data")

    if len(price_data) < len(ASSETS) - 1:  # allow 1 missing
        print(f"\nERROR: Only {len(price_data)}/{len(ASSETS)} assets fetched successfully.", file=sys.stderr)
        print("Keeping existing baseline data. The app will continue to work.", file=sys.stderr)
        sys.exit(1)

    # Build aligned returns DataFrame
    print("\nComputing returns and statistics...")
    returns_dict = {ticker: compute_returns(df["close"]) for ticker, df in price_data.items()}
    returns_df = pd.DataFrame(returns_dict).dropna()

    # Per-asset statistics
    asset_stats = {}
    for ticker in returns_dict:
        asset_meta = next(a for a in ASSETS if a["ticker"] == ticker)
        latest_price = float(price_data[ticker]["close"].iloc[-1])
        prior_price = float(price_data[ticker]["close"].iloc[-22]) if len(price_data[ticker]) >= 22 else latest_price
        month_return = (latest_price / prior_price) - 1

        asset_stats[ticker] = {
            "name": asset_meta["name"],
            "asset_class": asset_meta["asset_class"],
            "expected_return": round(annualized_return(returns_df[ticker]), 4),
            "volatility": round(annualized_volatility(returns_df[ticker]), 4),
            "latest_price": round(latest_price, 2),
            "month_return": round(month_return, 4),
        }
        print(f"  {ticker:5s}: μ={asset_stats[ticker]['expected_return']:.2%}  σ={asset_stats[ticker]['volatility']:.2%}")

    # Add cash as a synthetic asset (3-month T-bill proxy, ~4.5% annualized as of 2024-2025)
    asset_stats["CASH"] = {
        "name": "Cash & Equivalents",
        "asset_class": "cash",
        "expected_return": 0.045,
        "volatility": 0.005,
        "latest_price": 1.00,
        "month_return": 0.004,
    }

    # Correlation matrix (excludes cash since it's a constant)
    correlation_matrix = compute_correlation_matrix(returns_df)

    # Historical scenarios
    print("\nExtracting historical scenarios...")
    scenarios_data = []
    for scenario in HISTORICAL_SCENARIOS:
        returns = extract_scenario_returns(price_data, scenario)
        # Add cash baseline (cash earned ~0% during these stress periods on a short-window basis)
        returns["cash"] = 0.0
        scenarios_data.append({
            **scenario,
            "asset_class_returns": returns,
        })
        equity_return = returns.get("us_equity", 0) * 100
        print(f"  {scenario['label']:30s}: US equity {equity_return:+.1f}%")

    # Assemble final output
    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "lookback_years": LOOKBACK_YEARS,
        "data_source": "Stooq.com — free historical market data",
        "assets": asset_stats,
        "correlation_matrix": correlation_matrix,
        "historical_scenarios": scenarios_data,
    }

    output_path = Path(__file__).parent.parent / "data" / "market_data.json"
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Wrote {output_path}")
    print(f"  Generated at: {output['generated_at']}")
    print(f"  Assets: {len(output['assets'])}")
    print(f"  Historical scenarios: {len(output['historical_scenarios'])}")


if __name__ == "__main__":
    main()
