// =============================================================================
// PORTFOLIO ENGINE V2
// =============================================================================
// Loads real historical data, runs proper Monte Carlo simulations with
// correlated returns (Cholesky decomposition), supports historical backtesting
// against actual market events (2008, 2020, 2022).
//
// IMPORTANT: This is an educational simulation tool. The recommendations and
// scenarios are illustrative, not personalized investment advice. Users should
// consult a licensed financial advisor for advice on their specific situation.
//
// Author: Parth Mitesh Shah
// =============================================================================

import marketData from '@data/market_data.json';

// =============================================================================
// MARKET DATA — loaded from data/market_data.json (refreshed weekly)
// =============================================================================
export const ASSETS_META = [
  { ticker: 'VTI',  color: '#0F4C3A' },
  { ticker: 'VXUS', color: '#3D7A5C' },
  { ticker: 'VWO',  color: '#7BA889' },
  { ticker: 'BND',  color: '#B45309' },
  { ticker: 'BNDX', color: '#D97706' },
  { ticker: 'TIP',  color: '#F59E0B' },
  { ticker: 'VNQ',  color: '#6B5B47' },
  { ticker: 'CASH', color: '#9CA3AF' },
];

export const ASSETS = ASSETS_META.map(meta => {
  const data = marketData.assets[meta.ticker];
  return {
    ticker: meta.ticker,
    name: data.name,
    class: data.asset_class,
    expReturn: data.expected_return,
    vol: data.volatility,
    latestPrice: data.latest_price,
    monthReturn: data.month_return,
    color: meta.color,
  };
});

export const HISTORICAL_SCENARIOS = marketData.historical_scenarios;
export const DATA_GENERATED_AT = marketData.generated_at;
export const DATA_SOURCE_NOTE = marketData.data_source;

// =============================================================================
// CORRELATION MATRIX — convert dictionary form to ordered array
// =============================================================================
const TICKERS_FOR_MATRIX = ['VTI', 'VXUS', 'VWO', 'BND', 'BNDX', 'TIP', 'VNQ'];

function buildCorrelationMatrix() {
  const n = TICKERS_FOR_MATRIX.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = TICKERS_FOR_MATRIX[i];
      const b = TICKERS_FOR_MATRIX[j];
      matrix[i][j] = marketData.correlation_matrix[a]?.[b] ?? (i === j ? 1 : 0);
    }
  }
  return matrix;
}

const CORRELATION_MATRIX = buildCorrelationMatrix();

// =============================================================================
// CHOLESKY DECOMPOSITION
// =============================================================================
// Decomposes a positive-definite matrix M into L · L^T where L is lower triangular.
// Used to generate correlated random samples from independent normal samples.
// This is the math that makes Monte Carlo simulation realistic — without it,
// asset returns would be uncorrelated, which would massively understate
// portfolio risk during market stress events.
//
// Reference: Press et al., Numerical Recipes 3rd Ed., Section 2.9
// =============================================================================
function cholesky(matrix) {
  const n = matrix.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];

      if (i === j) {
        const val = matrix[i][i] - sum;
        // Numerical safety: clamp at small positive to handle near-singular matrices
        L[i][j] = Math.sqrt(Math.max(val, 1e-10));
      } else {
        L[i][j] = (matrix[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

const CHOLESKY_L = cholesky(CORRELATION_MATRIX);

// =============================================================================
// RANDOM NUMBER GENERATION (Box-Muller transform)
// =============================================================================
// Convert two uniform [0,1] randoms into one standard normal random
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Generate a vector of n correlated standard normal samples using Cholesky
function correlatedNormals() {
  const n = TICKERS_FOR_MATRIX.length;
  const independent = Array.from({ length: n }, () => randn());
  const correlated = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      correlated[i] += CHOLESKY_L[i][j] * independent[j];
    }
  }
  return correlated;
}

// =============================================================================
// MONTE CARLO SIMULATION
// =============================================================================
// Simulates many possible future portfolio paths using:
// - Geometric Brownian Motion for each asset
// - Correlated random shocks via Cholesky decomposition
// - User's actual allocation weights
// Returns percentile bands and full path data for visualization.
// =============================================================================
export function monteCarloSimulation(allocation, principal, years, numPaths = 2000) {
  const dt = 1 / 12;  // monthly steps
  const numSteps = years * 12;
  const paths = [];

  // Get drift (μ - σ²/2) and vol arrays in matrix order
  const drifts = TICKERS_FOR_MATRIX.map(t => {
    const a = ASSETS.find(x => x.ticker === t);
    return a.expReturn - 0.5 * a.vol * a.vol;
  });
  const vols = TICKERS_FOR_MATRIX.map(t => {
    const a = ASSETS.find(x => x.ticker === t);
    return a.vol;
  });
  const weights = TICKERS_FOR_MATRIX.map(t => (allocation[t] || 0) / 100);
  const cashWeight = (allocation.CASH || 0) / 100;
  const cashAsset = ASSETS.find(x => x.ticker === 'CASH');

  for (let p = 0; p < numPaths; p++) {
    // Each asset starts at value 1 (we'll multiply by weight at end)
    const assetValues = Array(TICKERS_FOR_MATRIX.length).fill(1);
    let cashValue = 1;
    const path = [principal];

    for (let step = 1; step <= numSteps; step++) {
      const shocks = correlatedNormals();
      for (let i = 0; i < TICKERS_FOR_MATRIX.length; i++) {
        const exponent = drifts[i] * dt + vols[i] * Math.sqrt(dt) * shocks[i];
        assetValues[i] *= Math.exp(exponent);
      }
      // Cash: deterministic compound growth (low volatility approximation)
      cashValue *= Math.exp(cashAsset.expReturn * dt);

      // Compute portfolio value at this step
      let portfolioValue = cashWeight * cashValue;
      for (let i = 0; i < TICKERS_FOR_MATRIX.length; i++) {
        portfolioValue += weights[i] * assetValues[i];
      }
      path.push(principal * portfolioValue);
    }
    paths.push(path);
  }

  // Compute percentile bands at each time step
  const bands = [];
  for (let step = 0; step <= numSteps; step++) {
    const valuesAtStep = paths.map(p => p[step]).sort((a, b) => a - b);
    bands.push({
      year: step / 12,
      p10: valuesAtStep[Math.floor(numPaths * 0.10)],
      p25: valuesAtStep[Math.floor(numPaths * 0.25)],
      p50: valuesAtStep[Math.floor(numPaths * 0.50)],
      p75: valuesAtStep[Math.floor(numPaths * 0.75)],
      p90: valuesAtStep[Math.floor(numPaths * 0.90)],
    });
  }

  // Final-year statistics
  const finalValues = paths.map(p => p[numSteps]);
  finalValues.sort((a, b) => a - b);

  return {
    bands,
    numPaths,
    finalStats: {
      median: finalValues[Math.floor(numPaths * 0.5)],
      p10: finalValues[Math.floor(numPaths * 0.1)],
      p90: finalValues[Math.floor(numPaths * 0.9)],
      best: finalValues[finalValues.length - 1],
      worst: finalValues[0],
    },
  };
}

// =============================================================================
// HISTORICAL BACKTESTING
// =============================================================================
// Apply ACTUAL historical asset class returns from a real event (2008, 2020,
// 2022) to the user's portfolio. This shows how their hypothetical portfolio
// would have performed during the actual event — not a simulation, but real
// historical math.
// =============================================================================
export function backtestHistorical(allocation, principal, scenarioId) {
  const scenario = HISTORICAL_SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) return null;

  let totalReturn = 0;
  ASSETS.forEach(asset => {
    const weight = (allocation[asset.ticker] || 0) / 100;
    const assetReturn = scenario.asset_class_returns[asset.class] || 0;
    totalReturn += weight * assetReturn;
  });

  return {
    scenario,
    portfolioReturn: totalReturn,
    dollarChange: principal * totalReturn,
    finalValue: principal * (1 + totalReturn),
    durationLabel: getDurationLabel(scenario.start, scenario.end),
  };
}

function getDurationLabel(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const months = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 12) return `${months} months`;
  const years = (months / 12).toFixed(1);
  return `${years} years`;
}

// =============================================================================
// RISK PROFILING
// =============================================================================
export function computeRiskProfile(inputs) {
  const { age, horizon, drawdownReaction, goal } = inputs;
  let score = 50;

  if (age < 30) score += 15;
  else if (age < 45) score += 8;
  else if (age < 60) score -= 5;
  else score -= 15;

  if (horizon === 'long') score += 15;
  else if (horizon === 'medium') score += 0;
  else score -= 20;

  if (drawdownReaction === 'buy') score += 15;
  else if (drawdownReaction === 'hold') score += 0;
  else score -= 15;

  if (goal === 'wealth') score += 5;
  else if (goal === 'retirement') score += 0;
  else if (goal === 'house') score -= 10;
  else if (goal === 'emergency') score -= 15;

  score = Math.max(0, Math.min(100, score));

  let profile, label, description;
  if (score < 30) {
    profile = 'conservative';
    label = 'Conservative';
    description = 'You prioritize capital preservation. Steady, predictable growth matters more than chasing returns.';
  } else if (score < 55) {
    profile = 'balanced';
    label = 'Balanced';
    description = 'You want growth but not at the cost of sleep. A blended portfolio fits your temperament.';
  } else if (score < 80) {
    profile = 'growth';
    label = 'Growth';
    description = 'You can tolerate volatility for long-term returns. Time is on your side.';
  } else {
    profile = 'aggressive';
    label = 'Aggressive';
    description = 'You are comfortable with risk for higher long-term returns. You understand markets fluctuate.';
  }

  return { score, profile, label, description };
}

const ALLOCATIONS = {
  conservative: { VTI: 20, VXUS: 5,  VWO: 0,  BND: 45, BNDX: 10, TIP: 10, VNQ: 0,  CASH: 10 },
  balanced:     { VTI: 35, VXUS: 15, VWO: 5,  BND: 25, BNDX: 5,  TIP: 5,  VNQ: 5,  CASH: 5  },
  growth:       { VTI: 45, VXUS: 20, VWO: 10, BND: 12, BNDX: 3,  TIP: 0,  VNQ: 7,  CASH: 3  },
  aggressive:   { VTI: 55, VXUS: 22, VWO: 13, BND: 3,  BNDX: 0,  TIP: 0,  VNQ: 5,  CASH: 2  },
};

export function getTargetAllocation(profile) {
  return ALLOCATIONS[profile] || ALLOCATIONS.balanced;
}

// =============================================================================
// SCENARIO ENGINE — EDUCATIONAL FRAMING
// =============================================================================
// Each scenario describes a market situation and what investors GENERALLY
// consider doing — framed as education, not personalized advice. The language
// throughout uses "investors generally" / "many investors choose" / "in
// situations like this" rather than "you should."
// =============================================================================
export const SCENARIOS = [
  {
    id: 'crash',
    title: 'Market crashes 30%',
    icon: 'TrendingDown',
    description: 'Equities drop 30% over 6 months. A scenario like 2008 or COVID 2020.',
    historicalRef: '2020_covid',
    shocks: { us_equity: -0.30, intl_equity: -0.32, em_equity: -0.40, reit: -0.35, us_bond: 0.05, intl_bond: 0.03, tips: 0.02, cash: 0 },
    rebalanceLogic: 'maintain',
  },
  {
    id: 'cash_need',
    title: 'I need $20K in 3 months',
    icon: 'Wallet',
    description: 'Sudden cash need on the horizon. How do investors typically prepare without locking in losses?',
    shocks: null,
    rebalanceLogic: 'liquidity',
  },
  {
    id: 'inflation',
    title: 'Inflation jumps to 8%',
    icon: 'Flame',
    description: 'Persistent inflation. Real returns get squeezed. Comparable to 2022.',
    historicalRef: '2022_inflation',
    shocks: { us_equity: -0.08, intl_equity: -0.05, em_equity: 0.02, us_bond: -0.12, intl_bond: -0.10, tips: 0.04, reit: 0.05, cash: -0.05 },
    rebalanceLogic: 'inflation_hedge',
  },
  {
    id: 'recession',
    title: 'Recession hits next year',
    icon: 'CloudRain',
    description: 'Economic contraction, rising unemployment, declining corporate profits.',
    historicalRef: '2008_crash',
    shocks: { us_equity: -0.22, intl_equity: -0.20, em_equity: -0.30, reit: -0.18, us_bond: 0.08, intl_bond: 0.06, tips: 0.03, cash: 0 },
    rebalanceLogic: 'defensive',
  },
  {
    id: 'house',
    title: 'Buying a house in 2 years',
    icon: 'Home',
    description: 'Major liquidity event coming. Time horizon shortens dramatically for a portion of your savings.',
    shocks: null,
    rebalanceLogic: 'short_horizon',
  },
  {
    id: 'baby',
    title: 'I just had a kid',
    icon: 'Baby',
    description: 'Long-term goals shift. Investors typically reconsider emergency reserves, insurance, and college planning.',
    shocks: null,
    rebalanceLogic: 'family_planning',
  },
];

export function runScenario(scenario, currentAlloc, portfolioValue, riskProfile) {
  const result = {
    impact: null,
    educationalNote: null,
    suggestedAllocation: { ...currentAlloc },
    considerations: [],
    historical: null,
  };

  // Compute simulated impact (not actual market reality)
  if (scenario.shocks) {
    let totalImpact = 0;
    ASSETS.forEach(a => {
      const w = (currentAlloc[a.ticker] || 0) / 100;
      const shock = scenario.shocks[a.class] || 0;
      totalImpact += w * shock;
    });
    result.impact = {
      pctChange: totalImpact,
      dollarChange: portfolioValue * totalImpact,
      newValue: portfolioValue * (1 + totalImpact),
    };
  }

  // If there's a historical reference, run the actual backtest
  if (scenario.historicalRef) {
    result.historical = backtestHistorical(currentAlloc, portfolioValue, scenario.historicalRef);
  }

  // Educational language for each scenario type
  switch (scenario.rebalanceLogic) {
    case 'maintain':
      result.suggestedAllocation = getTargetAllocation(riskProfile.profile);
      result.considerations = [
        'Many long-term investors continue holding their positions during downturns. Selling into a falling market converts paper losses into realized losses.',
        'Some investors rebalance back to target weights during crashes — this naturally buys assets at lower prices.',
        'Investors with regular contribution plans (401k, automated IRA) often continue them through volatility.',
      ];
      result.educationalNote = 'In a typical 30% drawdown scenario, the investors who fared best historically were those who held positions or continued contributing. Those who sold near the bottom typically missed the recovery. This is general behavior research, not advice for your specific situation.';
      break;

    case 'liquidity':
      result.suggestedAllocation = { ...currentAlloc };
      const equityKeys = ['VTI', 'VXUS', 'VWO'];
      let toMove = 25;
      equityKeys.forEach(k => {
        const reduce = Math.min((currentAlloc[k] || 0) * 0.4, toMove / 3);
        result.suggestedAllocation[k] = Math.max(0, (currentAlloc[k] || 0) - reduce);
        result.suggestedAllocation.CASH = (result.suggestedAllocation.CASH || 0) + reduce;
      });
      result.considerations = [
        'When investors know about an upcoming cash need, many shift the relevant amount to cash or short-term bonds before that need arrives.',
        'Selling equities during a downturn to cover near-term expenses tends to lock in losses.',
        'Tax-aware investors typically pull from highest-cost-basis lots first in taxable accounts.',
      ];
      result.educationalNote = 'A common framework: for any money needed within 1 year, many investors hold it in cash or short-term bonds rather than equities. The timing of the cash need matters more than the size.';
      break;

    case 'inflation_hedge':
      result.suggestedAllocation = { ...currentAlloc };
      const bondReduction = (currentAlloc.BND || 0) * 0.4;
      result.suggestedAllocation.BND = (currentAlloc.BND || 0) - bondReduction;
      result.suggestedAllocation.TIP = (currentAlloc.TIP || 0) + bondReduction * 0.6;
      result.suggestedAllocation.VNQ = (currentAlloc.VNQ || 0) + bondReduction * 0.4;
      result.considerations = [
        'During the 2022 inflation shock, nominal bonds (BND) fell roughly 16% while TIPS (TIP) outperformed.',
        'Real assets like real estate (VNQ) historically provide some protection because rents and property values tend to adjust with inflation.',
        'Cash is often considered the worst place to be in inflation — it loses real value at the inflation rate.',
      ];
      result.educationalNote = 'In persistent inflation, the goal shifts from preserving nominal capital to preserving real (inflation-adjusted) purchasing power. TIPS and real assets are common tools investors use for this. The 2022 backtest below shows what this looked like in practice.';
      break;

    case 'defensive':
      result.suggestedAllocation = { ...currentAlloc };
      ['VTI', 'VXUS', 'VWO'].forEach(k => {
        const reduce = (currentAlloc[k] || 0) * 0.20;
        result.suggestedAllocation[k] = (currentAlloc[k] || 0) - reduce;
        result.suggestedAllocation.BND = (result.suggestedAllocation.BND || 0) + reduce * 0.7;
        result.suggestedAllocation.CASH = (result.suggestedAllocation.CASH || 0) + reduce * 0.3;
      });
      result.considerations = [
        'In recessionary periods, investors often build emergency cash reserves (typically 3-6 months of expenses) before adjusting their portfolio.',
        'Reducing equity exposure modestly is more common than going to all-cash; staying invested matters for participating in recoveries.',
        'Investors anticipating a recession sometimes pause new debt and preserve job-loss flexibility.',
      ];
      result.educationalNote = 'The 2008 backtest below shows what a recession looked like for the asset classes in your portfolio. History suggests recessions are when defensive positioning matters most — but going all-cash often costs more than it saves.';
      break;

    case 'short_horizon':
      result.suggestedAllocation = ALLOCATIONS.conservative;
      result.considerations = [
        'For money needed within 2-3 years, many investors shift the relevant portion to bonds and cash to reduce the risk of a market drop just before purchase.',
        'A 30% equity drawdown 6 months before a down payment can delay home buying by years.',
        'After the purchase, investors typically rebuild their portfolio toward their long-term risk profile.',
      ];
      result.educationalNote = 'Short time horizons fundamentally change risk tolerance. Stocks have averaged ~10% annual returns historically — but they can also drop 50% in a year. The math of compounding favors stocks long-term but punishes them short-term.';
      break;

    case 'family_planning':
      result.suggestedAllocation = { ...currentAlloc };
      ['VTI', 'VXUS'].forEach(k => {
        const reduce = (currentAlloc[k] || 0) * 0.10;
        result.suggestedAllocation[k] = (currentAlloc[k] || 0) - reduce;
        result.suggestedAllocation.BND = (result.suggestedAllocation.BND || 0) + reduce * 0.5;
        result.suggestedAllocation.CASH = (result.suggestedAllocation.CASH || 0) + reduce * 0.5;
      });
      result.considerations = [
        'New parents often build a 6-month emergency fund (in cash, not invested) as their first priority.',
        '529 plans offer tax advantages for college savings; small monthly contributions starting early benefit from compounding.',
        'Term life insurance becomes more important when others depend on your income.',
        'Modest reduction in equity risk reflects the new financial obligations.',
      ];
      result.educationalNote = 'Major life events often shift the priority hierarchy: emergency cash, then insurance, then long-term investing. The portfolio adjustment is usually smaller than people expect — the bigger moves are non-portfolio.';
      break;

    default:
      result.educationalNote = 'No specific portfolio adjustment indicated.';
  }

  Object.keys(result.suggestedAllocation).forEach(k => {
    result.suggestedAllocation[k] = Math.round(result.suggestedAllocation[k]);
  });

  return result;
}

// =============================================================================
// LLM EXPLANATION LAYER (Claude API)
// =============================================================================
export async function generateExplanation(scenario, currentAlloc, newAlloc, riskProfile, impact) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const userPrompt = `Scenario: ${scenario.title}
Description: ${scenario.description}
User risk profile: ${riskProfile.label} (score ${riskProfile.score}/100)
Simulated portfolio impact: ${impact ? `${(impact.pctChange * 100).toFixed(1)}% change` : 'No immediate market impact, but the situation calls for portfolio reconsideration'}
Current allocation: ${JSON.stringify(currentAlloc)}
Suggested new allocation: ${JSON.stringify(newAlloc)}

Explain in 2-3 short sentences why investors generally make this kind of adjustment in this scenario.`;

  const systemPrompt = `You are a calm, jargon-free financial educator for beginner investors. Your job is to explain general investing principles in plain English.

CRITICAL RULES:
- This is EDUCATION, not personalized advice. Use phrases like "investors generally consider," "many people in this situation choose," "a common approach is" — never "you should."
- No financial jargon (no "alpha," "beta," "Sharpe ratio," "duration," "convexity," etc.).
- Speak in second person ("you may want to consider...") but always frame as general principles.
- Be calm and reassuring, not alarming. Even during a market crash, your job is to lower their cortisol, not raise it.
- 2-3 sentences maximum. Brevity is trust.
- Always include a soft reminder this is general education, not personalized advice for their situation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) throw new Error(`API failure: ${response.status}`);
    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    return textBlock?.text?.trim() || null;
  } catch (err) {
    console.warn('LLM explanation failed, falling back to static:', err);
    return null;
  }
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================
export const fmtMoney = (n) => '$' + Math.round(n).toLocaleString();
export const fmtPct = (n, decimals = 1) => `${(n * 100).toFixed(decimals)}%`;
export const fmtSignedPct = (n, decimals = 1) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(decimals)}%`;
