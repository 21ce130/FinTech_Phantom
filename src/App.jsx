import { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Line, ComposedChart,
} from 'recharts';
import {
  TrendingDown, Wallet, Flame, CloudRain, Home, Baby,
  ArrowRight, ArrowLeft, Sparkles, AlertCircle, CheckCircle2, Activity,
  Info, ThumbsUp, ThumbsDown, X,
} from 'lucide-react';
import {
  ASSETS, SCENARIOS, HISTORICAL_SCENARIOS, DATA_GENERATED_AT,
  computeRiskProfile, getTargetAllocation,
  monteCarloSimulation, backtestHistorical,
  runScenario, generateExplanation,
  fmtMoney, fmtPct, fmtSignedPct,
} from './engine.js';

const ICONS = { TrendingDown, Wallet, Flame, CloudRain, Home, Baby };

// Plausible event tracking helper
function track(event, props = {}) {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(event, { props });
  }
}

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  const [showAbout, setShowAbout] = useState(false);
  const [inputs, setInputs] = useState({
    age: 28,
    principal: 25000,
    horizon: 'long',
    drawdownReaction: 'hold',
    goal: 'retirement',
  });
  const [activeScenario, setActiveScenario] = useState(null);

  const riskProfile = useMemo(() => computeRiskProfile(inputs), [inputs]);
  const allocation = useMemo(() => getTargetAllocation(riskProfile.profile), [riskProfile.profile]);

  return (
    <div className="font-body min-h-screen" style={{ background: '#FAF7F2', color: '#1A1A1A' }}>
      {/* TOP BAR */}
      <header className="border-b" style={{ borderColor: '#1A1A1A' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => { setScreen('onboarding'); setShowAbout(false); }}
            className="flex items-center gap-3 hover:opacity-70 transition-opacity"
          >
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: '#0F4C3A', color: '#FAF7F2' }}>
              <Activity size={16} />
            </div>
            <div className="text-left">
              <div className="font-display text-lg leading-none" style={{ fontWeight: 500 }}>Co-pilot</div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: '#6B5B47' }}>Educational Portfolio Simulator</div>
            </div>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAbout(true)}
              className="text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-60 transition-opacity"
              style={{ color: '#6B5B47' }}
            >
              <Info size={12} /> About
            </button>
            {screen !== 'onboarding' && (
              <button
                onClick={() => setScreen(screen === 'scenario' ? 'dashboard' : 'onboarding')}
                className="text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-60 transition-opacity"
                style={{ color: '#6B5B47' }}
              >
                <ArrowLeft size={14} />
                {screen === 'scenario' ? 'Back' : 'Restart'}
              </button>
            )}
          </div>
        </div>

        {/* Educational disclaimer banner */}
        <div className="border-t" style={{ borderColor: '#D4CFC4', background: '#F0EBE0' }}>
          <div className="max-w-6xl mx-auto px-6 py-2 text-[11px] flex items-center justify-center gap-2" style={{ color: '#6B5B47' }}>
            <Info size={11} />
            <span>Educational tool. Not personalized investment advice. Not affiliated with any registered investment advisor.</span>
          </div>
        </div>
      </header>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {screen === 'onboarding' && (
        <Onboarding
          inputs={inputs}
          setInputs={setInputs}
          riskProfile={riskProfile}
          onSubmit={() => { track('onboarding_completed', { profile: riskProfile.profile }); setScreen('dashboard'); }}
        />
      )}
      {screen === 'dashboard' && (
        <Dashboard
          inputs={inputs}
          riskProfile={riskProfile}
          allocation={allocation}
          onScenarioSelect={(s) => {
            track('scenario_clicked', { scenario: s.id });
            setActiveScenario(s);
            setScreen('scenario');
          }}
        />
      )}
      {screen === 'scenario' && activeScenario && (
        <ScenarioView
          scenario={activeScenario}
          currentAlloc={allocation}
          portfolioValue={inputs.principal}
          riskProfile={riskProfile}
          onBack={() => setScreen('dashboard')}
        />
      )}

      <footer className="border-t mt-16 py-8" style={{ borderColor: '#D4CFC4' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-between gap-4 text-xs uppercase tracking-widest mb-4" style={{ color: '#6B5B47' }}>
            <span>Co-pilot · Built by Parth Mitesh Shah</span>
            <button onClick={() => setShowAbout(true)} className="hover:opacity-60 transition-opacity">
              About this tool
            </button>
            <span>Data refreshed weekly</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#6B5B47' }}>
            This is an educational simulation tool designed to help beginner investors understand portfolio risk and historical market behavior.
            It does not provide personalized financial, investment, tax, or legal advice. It does not connect to any brokerage account and cannot
            execute trades. Recommendations shown are general educational principles, not specific advice for your situation. Past performance does not
            predict future results. Consult a licensed financial advisor before making investment decisions. The author is not a registered investment advisor.
          </p>
        </div>
      </footer>
    </div>
  );
}

// =============================================================================
// ABOUT MODAL
// =============================================================================
function AboutModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(26, 26, 26, 0.7)' }}>
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: '#FAF7F2', border: '1px solid #1A1A1A' }}>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] mb-2" style={{ color: '#0F4C3A' }}>About this tool</div>
              <h2 className="font-display text-3xl leading-tight" style={{ fontWeight: 500 }}>What is Co-pilot?</h2>
            </div>
            <button onClick={onClose} className="hover:opacity-60 transition-opacity">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              Co-pilot is an <strong>educational simulation tool</strong> for beginner investors. It helps you understand how a hypothetical portfolio might behave under different scenarios — market crashes, recessions, inflation shocks, and major life events — using real historical data and proper portfolio math.
            </p>

            <h3 className="font-display text-lg pt-2" style={{ fontWeight: 600 }}>What it is NOT</h3>
            <ul className="list-disc list-inside space-y-1" style={{ color: '#3A3A3A' }}>
              <li>It is not a registered investment advisor.</li>
              <li>It does not connect to your real brokerage account.</li>
              <li>It cannot execute trades.</li>
              <li>It does not give personalized advice for your situation.</li>
              <li>It does not predict the future.</li>
            </ul>

            <h3 className="font-display text-lg pt-2" style={{ fontWeight: 600 }}>The methodology</h3>
            <p>
              <strong>Risk profiling:</strong> Five questions assigned to a 0-100 risk score, mapped to four profiles (Conservative, Balanced, Growth, Aggressive). Each profile maps to a target allocation across 8 asset classes.
            </p>
            <p>
              <strong>Monte Carlo projection:</strong> 2,000 simulated future paths over your time horizon, using Geometric Brownian Motion with correlated random shocks. Cross-asset correlations are computed via Cholesky decomposition of the historical correlation matrix — this matters because it captures how assets move together during stress events, not just independently.
            </p>
            <p>
              <strong>Historical backtesting:</strong> We apply the actual asset class returns from real events (2008 crisis, 2020 COVID crash, 2022 inflation shock) to your hypothetical portfolio. This is real history, not simulation.
            </p>
            <p>
              <strong>AI explanation layer:</strong> When configured, Anthropic's Claude API generates plain-language explanations for why investors generally consider specific actions in each scenario. Without an API key, the tool falls back to pre-written educational content.
            </p>

            <h3 className="font-display text-lg pt-2" style={{ fontWeight: 600 }}>Data sources</h3>
            <p>
              Historical price data is refreshed weekly from public market sources. Asset returns, volatilities, and correlations are computed from 10 years of trailing data. The data file shipping with this app was generated on{' '}
              <strong>{new Date(DATA_GENERATED_AT).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
            </p>

            <h3 className="font-display text-lg pt-2" style={{ fontWeight: 600 }}>About the author</h3>
            <p>
              Built by <strong>Parth Mitesh Shah</strong>, MS Finance student at UT Dallas, as a personal project to explore the intersection of quantitative finance, behavioral economics, and accessible UX. Feedback welcome.
            </p>
          </div>

          <button
            onClick={onClose}
            className="mt-8 px-6 py-3 text-sm uppercase tracking-widest"
            style={{ background: '#1A1A1A', color: '#FAF7F2' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 1: ONBOARDING
// =============================================================================
function Onboarding({ inputs, setInputs, riskProfile, onSubmit }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 animate-fade-in">
      <div className="text-xs uppercase tracking-[0.3em] mb-4" style={{ color: '#0F4C3A' }}>Step 1 of 3 · Tell us about you</div>
      <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mb-4" style={{ fontWeight: 400 }}>
        Let's start with the <em style={{ color: '#0F4C3A' }}>basics</em>.
      </h1>
      <p className="font-display text-xl leading-snug mb-12" style={{ fontWeight: 300, fontStyle: 'italic', color: '#3A3A3A' }}>
        Five quick questions. No jargon. We'll build a hypothetical portfolio that fits your profile — and show you how it might hold up when life happens.
      </p>

      <div className="space-y-10">
        <Field label="How old are you?">
          <input type="number" min="18" max="100" value={inputs.age}
            onChange={(e) => setInputs({ ...inputs, age: parseInt(e.target.value) || 0 })}
            className="font-display text-4xl bg-transparent border-b w-32 outline-none"
            style={{ borderColor: '#1A1A1A', fontWeight: 500 }} />
        </Field>

        <Field label="How much would you hypothetically invest?">
          <div className="flex items-center gap-2">
            <span className="font-display text-4xl" style={{ fontWeight: 500 }}>$</span>
            <input type="number" min="100" step="100" value={inputs.principal}
              onChange={(e) => setInputs({ ...inputs, principal: parseInt(e.target.value) || 0 })}
              className="font-display text-4xl bg-transparent border-b w-64 outline-none font-mono-num"
              style={{ borderColor: '#1A1A1A', fontWeight: 500 }} />
          </div>
        </Field>

        <Field label="When would you need this money?">
          <ChoiceRow value={inputs.horizon} onChange={(v) => setInputs({ ...inputs, horizon: v })} options={[
            { value: 'short', label: 'Within 3 years' },
            { value: 'medium', label: '3 to 10 years' },
            { value: 'long', label: '10+ years' },
          ]} />
        </Field>

        <Field label="If your portfolio dropped 30% next month, what would you do?">
          <ChoiceRow value={inputs.drawdownReaction} onChange={(v) => setInputs({ ...inputs, drawdownReaction: v })} options={[
            { value: 'sell', label: 'Sell everything' },
            { value: 'hold', label: 'Hold steady' },
            { value: 'buy', label: 'Buy more' },
          ]} />
        </Field>

        <Field label="What's the goal?">
          <ChoiceRow value={inputs.goal} onChange={(v) => setInputs({ ...inputs, goal: v })} options={[
            { value: 'retirement', label: 'Retirement' },
            { value: 'house', label: 'Down payment' },
            { value: 'wealth', label: 'Build wealth' },
            { value: 'emergency', label: 'Cushion' },
          ]} />
        </Field>
      </div>

      <div className="mt-16 p-8 border" style={{ borderColor: '#1A1A1A', background: '#FFFFFF' }}>
        <div className="text-xs uppercase tracking-[0.25em] mb-3" style={{ color: '#0F4C3A' }}>Your profile, so far</div>
        <div className="flex items-baseline justify-between flex-wrap gap-4">
          <h2 className="font-display text-4xl" style={{ fontWeight: 500 }}>{riskProfile.label}</h2>
          <div className="font-display font-mono-num text-3xl" style={{ color: '#0F4C3A' }}>{riskProfile.score}<span className="text-base ml-1" style={{ color: '#6B5B47' }}>/100</span></div>
        </div>
        <p className="font-display text-lg mt-3 leading-snug" style={{ fontWeight: 300, fontStyle: 'italic', color: '#3A3A3A' }}>
          {riskProfile.description}
        </p>
      </div>

      <button onClick={onSubmit} className="mt-10 px-8 py-4 text-sm uppercase tracking-widest flex items-center gap-3 hover:gap-5 transition-all"
        style={{ background: '#1A1A1A', color: '#FAF7F2' }}>
        See My Hypothetical Portfolio <ArrowRight size={16} />
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: '#6B5B47' }}>{label}</div>
      {children}
    </div>
  );
}

function ChoiceRow({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className="px-5 py-2.5 text-sm transition-all"
          style={{
            background: value === opt.value ? '#1A1A1A' : 'transparent',
            color: value === opt.value ? '#FAF7F2' : '#1A1A1A',
            border: '1px solid #1A1A1A',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// SCREEN 2: DASHBOARD with Monte Carlo Projection
// =============================================================================
function Dashboard({ inputs, riskProfile, allocation, onScenarioSelect }) {
  const yearsToHorizon = inputs.horizon === 'long' ? 20 : inputs.horizon === 'medium' ? 7 : 2;

  const allocationData = ASSETS
    .filter(a => allocation[a.ticker] > 0)
    .map(a => ({ name: a.name, ticker: a.ticker, value: allocation[a.ticker], color: a.color }));

  // Run Monte Carlo simulation (2000 paths)
  const mc = useMemo(
    () => monteCarloSimulation(allocation, inputs.principal, yearsToHorizon, 2000),
    [allocation, inputs.principal, yearsToHorizon]
  );

  // Projection chart data — sample every 6 months for clarity
  const projectionChart = mc.bands.filter((_, i) => i % 6 === 0 || i === mc.bands.length - 1);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-fade-in">
      <div className="mb-12">
        <div className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: '#0F4C3A' }}>
          Step 2 · Hypothetical portfolio · {riskProfile.label}
        </div>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95]" style={{ fontWeight: 400 }}>
          Here's a <em style={{ color: '#0F4C3A' }}>simulated</em> view.
        </h1>
        <p className="font-display text-lg mt-3" style={{ fontWeight: 300, fontStyle: 'italic', color: '#3A3A3A' }}>
          Based on your inputs, this is the hypothetical portfolio and projection. Real outcomes will differ.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px mb-12" style={{ background: '#1A1A1A' }}>
        <StatCard label="Starting Value" value={fmtMoney(inputs.principal)} />
        <StatCard label={`Median Outcome at Year ${yearsToHorizon}`} value={fmtMoney(mc.finalStats.median)}
          subtext="50th percentile of 2,000 simulated paths" />
        <StatCard label="Range (10th – 90th percentile)" value={`${fmtMoney(mc.finalStats.p10)} – ${fmtMoney(mc.finalStats.p90)}`}
          subtext="80% confidence band" small />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        {/* ALLOCATION DONUT */}
        <div className="p-8 border" style={{ borderColor: '#1A1A1A', background: '#FFFFFF' }}>
          <div className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: '#0F4C3A' }}>Asset Mix</div>
          <h3 className="font-display text-2xl mb-6" style={{ fontWeight: 500 }}>How the simulated portfolio is invested</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie data={allocationData} dataKey="value" innerRadius={60} outerRadius={100} stroke="#FAF7F2" strokeWidth={2}>
                  {allocationData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1A1A1A', color: '#FAF7F2', border: 'none', fontSize: '12px', fontFamily: 'Manrope' }}
                  formatter={(v) => [`${v}%`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 text-sm w-full">
              {allocationData.map(d => (
                <div key={d.ticker} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3" style={{ background: d.color }}></span>
                    <span>{d.name}</span>
                  </div>
                  <span className="font-mono-num" style={{ fontWeight: 500 }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MONTE CARLO PROJECTION */}
        <div className="p-8 border" style={{ borderColor: '#1A1A1A', background: '#FFFFFF' }}>
          <div className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: '#0F4C3A' }}>Monte Carlo Projection</div>
          <h3 className="font-display text-2xl mb-6" style={{ fontWeight: 500 }}>{yearsToHorizon}-year range of outcomes</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={projectionChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#D4CFC4" vertical={false} />
              <XAxis dataKey="year" stroke="#1A1A1A" tick={{ fontSize: 11, fontFamily: 'Manrope', fill: '#6B5B47' }}
                tickFormatter={(v) => `Yr ${Math.round(v)}`} />
              <YAxis stroke="#1A1A1A" tick={{ fontSize: 11, fontFamily: 'Manrope', fill: '#6B5B47' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#1A1A1A', color: '#FAF7F2', border: 'none', fontSize: '12px', fontFamily: 'Manrope' }}
                formatter={(v) => [fmtMoney(v), '']}
                labelFormatter={(l) => `Year ${l.toFixed(1)}`} />
              <Area type="monotone" dataKey="p90" stroke="none" fill="#0F4C3A" fillOpacity={0.08} />
              <Area type="monotone" dataKey="p10" stroke="none" fill="#FAF7F2" fillOpacity={1} />
              <Area type="monotone" dataKey="p75" stroke="none" fill="#0F4C3A" fillOpacity={0.18} />
              <Area type="monotone" dataKey="p25" stroke="none" fill="#FAF7F2" fillOpacity={1} />
              <Line type="monotone" dataKey="p50" stroke="#0F4C3A" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: '#6B5B47' }}>
            Each band shows a percentile range. Solid line: median outcome. Lighter band: 25th-75th percentile. Darkest fill: 10th-90th percentile. Computed from 2,000 simulated paths.
          </p>
        </div>
      </div>

      {/* HEALTH CHECK */}
      <div className="p-8 border mb-16" style={{ borderColor: '#1A1A1A', background: '#FFFFFF' }}>
        <div className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: '#0F4C3A' }}>Health Check</div>
        <h3 className="font-display text-2xl mb-6" style={{ fontWeight: 500 }}>How this hypothetical portfolio looks</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HealthIndicator status="good" label="Diversification" detail="Spread across stocks, bonds, and real estate" />
          <HealthIndicator status="good" label="Risk match" detail={`Aligned with ${riskProfile.label.toLowerCase()} profile`} />
          <HealthIndicator status={(allocation.CASH || 0) >= 5 ? 'good' : 'warn'} label="Cash buffer"
            detail={(allocation.CASH || 0) >= 5 ? 'Includes liquidity reserve' : 'Low cash allocation; consider building emergency reserve separately'} />
        </div>
      </div>

      {/* SCENARIOS */}
      <div className="mb-12">
        <div className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: '#0F4C3A' }}>Step 3 · Stress test</div>
        <h2 className="font-display text-4xl mb-3" style={{ fontWeight: 400 }}>What if <em style={{ color: '#0F4C3A' }}>life happens</em>?</h2>
        <p className="font-display text-lg leading-snug mb-8 max-w-2xl" style={{ fontWeight: 300, fontStyle: 'italic', color: '#3A3A3A' }}>
          Tap any scenario. We'll show the simulated impact, run a real historical backtest where applicable, and explain what investors generally consider in plain English.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: '#1A1A1A' }}>
          {SCENARIOS.map(s => {
            const Icon = ICONS[s.icon];
            return (
              <button key={s.id} onClick={() => onScenarioSelect(s)} className="p-6 text-left transition-all hover:opacity-90 group"
                style={{ background: '#FAF7F2' }}>
                <Icon size={20} style={{ color: '#0F4C3A' }} className="mb-4" />
                <h4 className="font-display text-xl leading-tight mb-2" style={{ fontWeight: 500 }}>{s.title}</h4>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#6B5B47' }}>{s.description}</p>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest" style={{ color: '#0F4C3A' }}>
                  Run scenario <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, small }) {
  return (
    <div className="p-8" style={{ background: '#FAF7F2' }}>
      <div className="text-xs uppercase tracking-widest mb-3" style={{ color: '#6B5B47' }}>{label}</div>
      <div className={`font-display font-mono-num leading-none mb-2 ${small ? 'text-2xl' : 'text-4xl'}`} style={{ fontWeight: 500 }}>
        {value}
      </div>
      {subtext && <div className="text-xs" style={{ color: '#6B5B47' }}>{subtext}</div>}
    </div>
  );
}

function HealthIndicator({ status, label, detail }) {
  const Icon = status === 'good' ? CheckCircle2 : AlertCircle;
  const color = status === 'good' ? '#0F4C3A' : '#B45309';
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} style={{ color }} />
        <span className="text-sm uppercase tracking-widest" style={{ fontWeight: 500 }}>{label}</span>
      </div>
      <p className="text-sm" style={{ color: '#6B5B47' }}>{detail}</p>
    </div>
  );
}

// =============================================================================
// SCREEN 3: SCENARIO RESULT with Historical Backtest
// =============================================================================
function ScenarioView({ scenario, currentAlloc, portfolioValue, riskProfile, onBack }) {
  const [aiExplanation, setAiExplanation] = useState(null);
  const [loadingAI, setLoadingAI] = useState(true);
  const [feedback, setFeedback] = useState(null);  // 'helpful' | 'not_helpful' | null

  const result = useMemo(
    () => runScenario(scenario, currentAlloc, portfolioValue, riskProfile),
    [scenario, currentAlloc, portfolioValue, riskProfile]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingAI(true);
    setFeedback(null);
    generateExplanation(scenario, currentAlloc, result.suggestedAllocation, riskProfile, result.impact)
      .then(text => { if (!cancelled) { setAiExplanation(text); setLoadingAI(false); } })
      .catch(() => { if (!cancelled) { setAiExplanation(null); setLoadingAI(false); } });
    return () => { cancelled = true; };
  }, [scenario, currentAlloc, riskProfile, result.impact, result.suggestedAllocation]);

  const Icon = ICONS[scenario.icon];

  const beforeData = ASSETS.filter(a => currentAlloc[a.ticker] > 0).map(a => ({ name: a.ticker, value: currentAlloc[a.ticker], color: a.color }));
  const afterData = ASSETS.filter(a => result.suggestedAllocation[a.ticker] > 0).map(a => ({ name: a.ticker, value: result.suggestedAllocation[a.ticker], color: a.color }));

  const handleFeedback = (kind) => {
    setFeedback(kind);
    track('scenario_feedback', { scenario: scenario.id, feedback: kind });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-fade-in">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <Icon size={24} style={{ color: '#0F4C3A' }} />
          <div className="text-xs uppercase tracking-[0.3em]" style={{ color: '#0F4C3A' }}>Scenario · Educational stress test</div>
        </div>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95]" style={{ fontWeight: 400 }}>
          {scenario.title}
        </h1>
        <p className="font-display text-xl mt-4 leading-snug max-w-3xl" style={{ fontWeight: 300, fontStyle: 'italic', color: '#3A3A3A' }}>
          {scenario.description}
        </p>
      </div>

      {/* SIMULATED IMPACT */}
      {result.impact && (
        <>
          <div className="text-xs uppercase tracking-[0.25em] mb-3" style={{ color: '#0F4C3A' }}>Simulated impact (illustrative)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px mb-12" style={{ background: '#1A1A1A' }}>
            <StatCard label="Starting Value" value={fmtMoney(portfolioValue)} />
            <StatCard label="After This Scenario" value={fmtMoney(result.impact.newValue)}
              subtext={fmtSignedPct(result.impact.pctChange)} />
            <StatCard label="Dollar Change"
              value={(result.impact.dollarChange >= 0 ? '+' : '−') + fmtMoney(Math.abs(result.impact.dollarChange))} />
          </div>
        </>
      )}

      {/* HISTORICAL BACKTEST — the differentiator */}
      {result.historical && (
        <div className="mb-12">
          <div className="text-xs uppercase tracking-[0.25em] mb-3" style={{ color: '#0F4C3A' }}>What actually happened in {result.historical.scenario.label}</div>
          <div className="p-10 border" style={{ borderColor: '#0F4C3A', background: '#FFFFFF', borderWidth: '2px' }}>
            <p className="text-sm leading-relaxed mb-6" style={{ color: '#6B5B47' }}>
              {result.historical.scenario.description} Duration: <strong>{result.historical.durationLabel}</strong>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-6 border-b" style={{ borderColor: '#D4CFC4' }}>
              <div>
                <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B5B47' }}>Your portfolio would have</div>
                <div className="font-display font-mono-num text-4xl" style={{ fontWeight: 500, color: result.historical.portfolioReturn < 0 ? '#B45309' : '#0F4C3A' }}>
                  {fmtSignedPct(result.historical.portfolioReturn)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B5B47' }}>Dollar change on {fmtMoney(portfolioValue)}</div>
                <div className="font-display font-mono-num text-4xl" style={{ fontWeight: 500 }}>
                  {result.historical.dollarChange < 0 ? '−' : '+'}{fmtMoney(Math.abs(result.historical.dollarChange))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B5B47' }}>Ending value</div>
                <div className="font-display font-mono-num text-4xl" style={{ fontWeight: 500 }}>
                  {fmtMoney(result.historical.finalValue)}
                </div>
              </div>
            </div>
            <p className="text-xs mt-4 leading-relaxed" style={{ color: '#6B5B47' }}>
              Real historical asset class returns from {new Date(result.historical.scenario.start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} to{' '}
              {new Date(result.historical.scenario.end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}, applied to your hypothetical allocation. This is real history, not simulation.
              Past performance does not predict future results.
            </p>
          </div>
        </div>
      )}

      {/* AI / EDUCATIONAL EXPLANATION */}
      <div className="p-10 border mb-12" style={{ borderColor: '#0F4C3A', background: '#FFFFFF', borderWidth: '2px' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: '#0F4C3A' }} />
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: '#0F4C3A' }}>
            {aiExplanation ? 'AI-generated educational explanation' : 'Educational explanation'}
          </div>
        </div>
        {loadingAI ? (
          <div className="font-display text-2xl leading-snug" style={{ fontWeight: 400, fontStyle: 'italic', color: '#6B5B47' }}>
            Thinking through this for you…
          </div>
        ) : (
          <p className="font-display text-2xl leading-snug" style={{ fontWeight: 400, fontStyle: 'italic' }}>
            &ldquo;{aiExplanation || result.educationalNote}&rdquo;
          </p>
        )}
      </div>

      {/* GENERAL CONSIDERATIONS + ALLOCATION SHIFT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
        <div className="p-8 border" style={{ borderColor: '#1A1A1A', background: '#FFFFFF' }}>
          <div className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: '#0F4C3A' }}>General considerations</div>
          <h3 className="font-display text-2xl mb-6" style={{ fontWeight: 500 }}>What investors generally think about</h3>
          <ol className="space-y-4">
            {result.considerations.map((item, i) => (
              <li key={i} className="flex gap-4">
                <div className="font-display text-2xl leading-none" style={{ fontWeight: 500, color: '#0F4C3A' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <p className="text-base leading-relaxed pt-1">{item}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs mt-6 leading-relaxed pt-4 border-t" style={{ color: '#6B5B47', borderColor: '#D4CFC4' }}>
            These are general principles drawn from financial research, not personalized advice. Your situation may warrant different actions. Consult a licensed advisor.
          </p>
        </div>

        <div className="p-8 border" style={{ borderColor: '#1A1A1A', background: '#FFFFFF' }}>
          <div className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: '#0F4C3A' }}>Hypothetical allocation shift</div>
          <h3 className="font-display text-2xl mb-6" style={{ fontWeight: 500 }}>Before vs. After (illustrative)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#6B5B47' }}>Current</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={beforeData} dataKey="value" innerRadius={40} outerRadius={70} stroke="#FAF7F2" strokeWidth={1}>
                    {beforeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#0F4C3A' }}>Suggested</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={afterData} dataKey="value" innerRadius={40} outerRadius={70} stroke="#FAF7F2" strokeWidth={1}>
                    {afterData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 space-y-2 text-sm">
            {ASSETS.filter(a => (currentAlloc[a.ticker] || 0) !== (result.suggestedAllocation[a.ticker] || 0)).map(a => {
              const before = currentAlloc[a.ticker] || 0;
              const after = result.suggestedAllocation[a.ticker] || 0;
              const diff = after - before;
              return (
                <div key={a.ticker} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5" style={{ background: a.color }}></span>
                    <span>{a.name}</span>
                  </div>
                  <div className="font-mono-num text-sm" style={{ fontWeight: 500, color: diff > 0 ? '#0F4C3A' : '#B45309' }}>
                    {before}% → {after}% <span className="text-xs ml-1">({diff > 0 ? '+' : ''}{diff}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FEEDBACK WIDGET */}
      <div className="p-8 border mb-12" style={{ borderColor: '#D4CFC4', background: '#FFFFFF' }}>
        {!feedback ? (
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: '#6B5B47' }}>Quick feedback</div>
              <p className="text-base">Was this scenario explanation helpful?</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleFeedback('helpful')} className="px-5 py-2.5 text-sm flex items-center gap-2 transition-all hover:opacity-80"
                style={{ background: '#0F4C3A', color: '#FAF7F2' }}>
                <ThumbsUp size={14} /> Helpful
              </button>
              <button onClick={() => handleFeedback('not_helpful')} className="px-5 py-2.5 text-sm flex items-center gap-2 transition-all"
                style={{ border: '1px solid #1A1A1A' }}>
                <ThumbsDown size={14} /> Not helpful
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <CheckCircle2 size={20} style={{ color: '#0F4C3A' }} className="mx-auto mb-2" />
            <p className="text-base">Thanks for the feedback!</p>
          </div>
        )}
      </div>

      <button onClick={onBack} className="px-8 py-4 text-sm uppercase tracking-widest flex items-center gap-3 hover:gap-5 transition-all"
        style={{ background: '#1A1A1A', color: '#FAF7F2' }}>
        <ArrowLeft size={16} /> Try Another Scenario
      </button>
    </div>
  );
}
