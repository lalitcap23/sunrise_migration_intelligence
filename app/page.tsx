import Link from "next/link";

const features = [
  {
    icon: "📊",
    title: "Market Demand Score",
    description:
      "7-day & 30-day trading volume, active trader count, and volume concentration from top wallets — judge real demand before committing.",
    badge: "Module 01",
    color: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/20",
    badgeColor: "text-violet-400 bg-violet-500/10",
  },
  {
    icon: "👥",
    title: "Holder Distribution",
    description:
      "Total holder count, top wallet concentration %, and a centralization risk flag. Know if bootstrapping liquidity is safe.",
    badge: "Module 02",
    color: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/20",
    badgeColor: "text-blue-400 bg-blue-500/10",
  },
  {
    icon: "⚡",
    title: "Liquidity Profile",
    description:
      "Total liquidity across all venues, market depth at 1%, 5%, and 10% slippage — plan your liquidity provision before you launch.",
    badge: "Module 03",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "border-cyan-500/20",
    badgeColor: "text-cyan-400 bg-cyan-500/10",
  },
  {
    icon: "🔁",
    title: "Cross-Chain Bridge Risk",
    description:
      "Compatible bridges (Wormhole, CCIP, LayerZero), estimated transfer cost, finality time, and a safety rating per route.",
    badge: "Module 04",
    color: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/20",
    badgeColor: "text-amber-400 bg-amber-500/10",
  },
  {
    icon: "📈",
    title: "Migration Strategy",
    description:
      "AI-recommended approach: canonical launch, wrapped token, LP-based migration, or liquidity bootstrapping — backed by real data.",
    badge: "Module 05",
    color: "from-green-500/20 to-green-500/5",
    border: "border-green-500/20",
    badgeColor: "text-green-400 bg-green-500/10",
  },
  {
    icon: "🏆",
    title: "Migration Readiness Score",
    description:
      "A composite 0–100 score across all categories. One number that tells you if the asset is ready for Solana.",
    badge: "Module 06",
    color: "from-rose-500/20 to-rose-500/5",
    border: "border-rose-500/20",
    badgeColor: "text-rose-400 bg-rose-500/10",
  },
];

const steps = [
  {
    step: "01",
    title: "Input Token Address",
    description:
      "Paste any ERC-20, BEP-20, or Polygon token address and select the source chain.",
  },
  {
    step: "02",
    title: "Run the Analysis",
    description:
      "Our engine queries on-chain data, DEX APIs, bridge endpoints, and holder registries in parallel.",
  },
  {
    step: "03",
    title: "Get Your Report",
    description:
      "View full charts, risk flags, strategy recommendations, and submit for Sunrise team review.",
  },
];

const stats = [
  { label: "Data Sources", value: "12+" },
  { label: "Chains Supported", value: "5" },
  { label: "Bridges Assessed", value: "3" },
  { label: "Analysis Modules", value: "6" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#050508]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-bold">
            S
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">
            Sunrise<span className="text-violet-400"> Intelligence</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#about" className="hover:text-white transition-colors">
            About
          </a>
        </div>
        <Link
          href="/analyze"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          Launch App
        </Link>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[300px] h-[300px] bg-violet-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Sunrise Hackathon — Migration Tooling
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
            <span className="text-white">Is Your Token</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Solana Ready?
            </span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 leading-relaxed mb-10">
            The{" "}
            <span className="text-white font-medium">
              Migration Readiness Analyzer
            </span>{" "}
            evaluates any token from Ethereum, BSC or Polygon and tells you
            exactly <em className="text-violet-300 not-italic">if</em> and{" "}
            <em className="text-cyan-300 not-italic">how</em> to migrate it to
            Solana successfully.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/analyze"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-base transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              Analyze a Token
              <span className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium text-base transition-all"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Fake terminal / score preview */}
        <div className="relative max-w-3xl mx-auto mt-16">
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden shadow-2xl shadow-black/50">
            {/* Terminal top bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0a0a10]">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-zinc-600 font-mono">
                migration-analyzer — analysis result
              </span>
            </div>
            {/* Fake output */}
            <div className="p-6 font-mono text-sm space-y-3">
              <div className="text-zinc-500">
                $ analyze --token 0xA0b86991c... --chain ethereum
              </div>
              <div className="text-green-400">
                ✓ Fetching market data... done
              </div>
              <div className="text-green-400">
                ✓ Scanning holder distribution... done
              </div>
              <div className="text-green-400">
                ✓ Profiling liquidity... done
              </div>
              <div className="text-green-400">
                ✓ Assessing bridge routes... done
              </div>
              <div className="mt-4 p-4 rounded-xl bg-[#0a0a10] border border-white/5">
                <div className="text-zinc-400 mb-3 text-xs uppercase tracking-widest">
                  Migration Readiness Report
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Demand", score: 82, color: "text-green-400" },
                    { label: "Liquidity", score: 68, color: "text-yellow-400" },
                    { label: "Holders", score: 55, color: "text-yellow-400" },
                    { label: "Bridge Risk", score: 45, color: "text-orange-400" },
                    { label: "Strategy", score: 78, color: "text-green-400" },
                    { label: "Overall", score: 62, color: "text-violet-400" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/3"
                    >
                      <span className="text-zinc-500 text-xs">
                        {item.label}
                      </span>
                      <span className={`font-bold text-sm ${item.color}`}>
                        {item.score}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-violet-300">
                  → Recommendation: LP-Based Migration with Wormhole bridge
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-white/5 bg-white/2 py-8 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-xs font-medium mb-4">
              Analysis Modules
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Six layers of intelligence
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-lg">
              Every token gets a full-stack evaluation across demand, liquidity,
              risk, and strategy before you commit resources.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`group relative rounded-2xl border ${feature.border} bg-gradient-to-b ${feature.color} p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-1`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{feature.icon}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-mono font-medium ${feature.badgeColor}`}
                  >
                    {feature.badge}
                  </span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="py-24 px-6 border-t border-white/5"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 text-xs font-medium mb-4">
              Workflow
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              From address to decision
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto text-lg">
              Three steps stand between you and a full migration readiness
              report.
            </p>
          </div>

          <div className="relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-10 left-[calc(16.66%-1px)] right-[calc(16.66%-1px)] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step) => (
                <div key={step.step} className="text-center group">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-violet-500/30 bg-violet-500/10 text-violet-300 font-mono font-bold text-lg mb-5 group-hover:bg-violet-500/20 transition-colors">
                    {step.step}
                  </div>
                  <h3 className="text-white font-semibold text-xl mb-3">
                    {step.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / WHY SUNRISE */}
      <section
        id="about"
        className="py-24 px-6 border-t border-white/5 bg-white/2"
      >
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-3 py-1 rounded-full border border-green-500/20 bg-green-500/5 text-green-400 text-xs font-medium mb-4">
              Why This Tool
            </div>
            <h2 className="text-4xl font-bold text-white mb-5 leading-tight">
              Make migration{" "}
              <span className="text-violet-400">strategic</span>, not
              guesswork
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Bringing assets to Solana is currently a manual, bespoke process.
              Teams spend days evaluating demand, mapping liquidity, and
              negotiating bridge routes — often with incomplete data.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              The Migration Readiness Analyzer puts all that intelligence in one
              place, reducing evaluation time from days to minutes and improving
              the quality of every decision.
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                icon: "⚡",
                title: "Reduce manual evaluation",
                desc: "Automate data collection across 12+ sources.",
              },
              {
                icon: "🎯",
                title: "Choose assets with real demand",
                desc: "Quantified scores replace gut-feel decisions.",
              },
              {
                icon: "🔒",
                title: "Assess risk before you bridge",
                desc: "Know the bridge risk, finality time, and cost upfront.",
              },
              {
                icon: "🚀",
                title: "Speed up decisions",
                desc: "One report per token, ready in seconds.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-[#0d0d14] hover:border-white/10 transition-colors"
              >
                <span className="text-xl mt-0.5">{item.icon}</span>
                <div>
                  <div className="text-white font-medium text-sm mb-1">
                    {item.title}
                  </div>
                  <div className="text-zinc-500 text-sm">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-violet-600/20 rounded-3xl blur-3xl" />
            <div className="relative rounded-3xl border border-violet-500/20 bg-[#0d0d18] p-12">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Ready to analyze?
              </h2>
              <p className="text-zinc-400 text-lg mb-8 max-w-md mx-auto">
                Paste a token address, select your source chain, and get a full
                migration report in under 30 seconds.
              </p>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-lg transition-all shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5"
              >
                Start Analysis
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
              S
            </div>
            <span>Sunrise Intelligence — Migration Readiness Analyzer</span>
          </div>
          <div>Built for the Sunrise Hackathon · Solana ecosystem</div>
        </div>
      </footer>
    </div>
  );
}
