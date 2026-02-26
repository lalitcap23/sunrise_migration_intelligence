"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";

interface ScoreSnapshot { demand: number; marketPresence: number; liquidity: number; bridgeRisk: number; dumpRisk: number; overall: number; }
interface TokenMeta    { name: string; symbol: string; image: string | null; currentPrice: number; marketCap: number; }
interface StrategyResult { strategy: string; rationale: string; }
interface CompareToken { id: string; token: string; chain: string; }
interface CompareResult {
  id: string; token: string; chain: string;
  status: "idle" | "loading" | "done" | "error"; error?: string;
  meta?: TokenMeta; scores?: ScoreSnapshot; strategy?: StrategyResult;
}

const CHAINS = [
  { id: "ethereum", label: "Ethereum",  accent: "#60a5fa" },
  { id: "bsc",      label: "BNB Chain",  accent: "#fbbf24" },
  { id: "polygon",  label: "Polygon",    accent: "#c084fc" },
];

const SCORE_COLOR = (s: number) => s >= 70 ? "#4ade80" : s >= 40 ? "#fbbf24" : "#f87171";
const SCORE_LABEL = (s: number) => s >= 70 ? "STRONG" : s >= 40 ? "MODERATE" : "WEAK";
function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  return `$${(n/1e3).toFixed(1)}K`;
}

let idCounter = 0;
const newId = () => `t-${++idCounter}`;

const TOKEN_COLORS = ["#38bdf8","#c084fc","#4ade80","#fbbf24"];

const CATEGORIES = [
  { key: "demand",         label: "MARKET DEMAND",    lower: false },
  { key: "marketPresence", label: "MARKET PRESENCE",  lower: false },
  { key: "liquidity",      label: "LIQUIDITY",         lower: false },
  { key: "bridgeRisk",     label: "BRIDGE RISK",       lower: false },
  { key: "dumpRisk",       label: "DUMP RISK",         lower: true  },
] as const;

function ScoreRing({ score, color, size = 60 }: { score: number; color: string; size?: number }) {
  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${fill} ${circ-fill}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill={color} fontSize={size*0.27} fontWeight={700} fontFamily="IBM Plex Mono">
        {score}
      </text>
    </svg>
  );
}

export default function ComparePage() {
  const [tokens,  setTokens]  = useState<CompareToken[]>([
    { id: newId(), token: "", chain: "ethereum" },
    { id: newId(), token: "", chain: "ethereum" },
  ]);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun,  setHasRun]  = useState(false);

  const addSlot    = () => tokens.length < 4 && setTokens(p => [...p, { id: newId(), token: "", chain: "ethereum" }]);
  const removeSlot = (id: string) => tokens.length > 2 && setTokens(p => p.filter(t => t.id !== id));
  const updateSlot = (id: string, f: "token"|"chain", v: string) =>
    setTokens(p => p.map(t => t.id === id ? { ...t, [f]: v } : t));

  const runComparison = useCallback(async () => {
    const valid = tokens.filter(t => t.token.startsWith("0x") && t.token.length === 42);
    if (!valid.length) return;
    setRunning(true); setHasRun(true);
    const initial: CompareResult[] = valid.map(t => ({ ...t, status: "loading" }));
    setResults(initial);
    const fetches = valid.map(async (t): Promise<CompareResult> => {
      try {
        const res  = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t.token, chain: t.chain }) });
        const data = await res.json();
        if (!res.ok) return { ...t, status: "error", error: data.error || "Analysis failed" };
        return { ...t, status: "done", meta: { name: data.token.name, symbol: data.token.symbol, image: data.token.image, currentPrice: data.token.currentPrice, marketCap: data.token.marketCap }, scores: data.scores, strategy: data.modules.strategy };
      } catch { return { ...t, status: "error", error: "Network error" }; }
    });
    fetches.forEach((p, i) => p.then(result => setResults(prev => { const n=[...prev]; n[i]=result; return n; })));
    await Promise.allSettled(fetches);
    setRunning(false);
  }, [tokens]);

  const validInputs = tokens.filter(t => t.token.startsWith("0x") && t.token.length === 42);
  const doneResults = results.filter(r => r.status === "done");
  const ranked      = [...doneResults].sort((a,b) => (b.scores?.overall??0)-(a.scores?.overall??0));

  const radarData = CATEGORIES.map(cat => {
    const point: Record<string, string | number> = { metric: cat.label.split(" ")[0] };
    doneResults.forEach((r, i) => {
      const raw = r.scores?.[cat.key] ?? 0;
      point[r.meta?.symbol ?? `T${i+1}`] = cat.lower ? 100 - raw : raw;
    });
    return point;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#07070e", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .slot-card{transition:border-color 0.2s;}
        .slot-card:hover{border-color:rgba(255,255,255,0.1)!important;}
        input,select{transition:border-color 0.2s;}
        input:focus,select:focus{outline:none;border-color:#38bdf850!important;}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .score-cell:hover{background:rgba(255,255,255,0.02);}
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
          <Link href="/" style={{ fontSize: 12, color: "#475569", textDecoration: "none", letterSpacing: "0.05em" }}>← BACK</Link>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { href: "/tokens",  label: "MARKETS",  color: "#38bdf8" },
              { href: "/analyze", label: "ANALYZE",   color: "#60a5fa" },
              { href: "/reports", label: "REPORTS",   color: "#fbbf24" },
            ].map(b => (
              <Link key={b.href} href={b.href} style={{ fontSize: 11, fontWeight: 600, color: b.color, textDecoration: "none", padding: "5px 14px", border: `1px solid ${b.color}40`, borderRadius: 4, background: `${b.color}0c`, letterSpacing: "0.08em" }}>{b.label}</Link>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Syne'", fontSize: 32, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: 6 }}>
            Token Battle
          </h1>
          <p style={{ fontSize: 12, color: "#475569", letterSpacing: "0.03em" }}>
            Compare up to 4 tokens side-by-side — ranked by migration readiness score
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${tokens.length}, 1fr)`, gap: 10, marginBottom: 16 }}>
          {tokens.map((t, i) => {
            const color = TOKEN_COLORS[i];
            return (
              <div key={t.id} className="slot-card" style={{
                border: `1px solid ${color}20`, borderRadius: 8, padding: 16,
                background: `${color}05`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: "0.1em" }}>TOKEN {i+1}</span>
                  </div>
                  {tokens.length > 2 && (
                    <button onClick={() => removeSlot(t.id)} style={{ fontSize: 14, color: "#334155", background: "transparent", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
                  )}
                </div>
                <input type="text" value={t.token} onChange={e => updateSlot(t.id,"token",e.target.value)} placeholder="0x..." disabled={running}
                  style={{ width: "100%", padding: "9px 10px", fontSize: 11, fontFamily: "'IBM Plex Mono'", border: `1px solid ${t.token.length>0&&(!t.token.startsWith("0x")||t.token.length!==42)?"#f8717160":"rgba(255,255,255,0.08)"}`, borderRadius: 5, background: "#030307", color: "#e2e8f0", marginBottom: 8 }} />
                <select value={t.chain} onChange={e => updateSlot(t.id,"chain",e.target.value)} disabled={running}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 11, fontFamily: "'IBM Plex Mono'", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, background: "#030307", color: "#94a3b8" }}>
                  {CHAINS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 48, alignItems: "center" }}>
          {tokens.length < 4 && (
            <button onClick={addSlot} disabled={running} style={{
              padding: "9px 18px", fontSize: 11, borderRadius: 5, cursor: "pointer",
              border: "1px dashed rgba(255,255,255,0.1)", background: "transparent",
              color: "#334155", fontFamily: "'IBM Plex Mono'", letterSpacing: "0.06em",
            }}>+ ADD TOKEN</button>
          )}
          <button onClick={runComparison} disabled={running || validInputs.length < 1} style={{
            padding: "9px 28px", fontSize: 12, fontWeight: 700, borderRadius: 5, border: "none",
            cursor: running || validInputs.length < 1 ? "not-allowed" : "pointer",
            background: running || validInputs.length < 1 ? "rgba(255,255,255,0.04)" : "linear-gradient(90deg,#0ea5e9,#38bdf8)",
            color: running || validInputs.length < 1 ? "#334155" : "#030307",
            letterSpacing: "0.08em", fontFamily: "'IBM Plex Mono'",
            boxShadow: running || validInputs.length < 1 ? "none" : "0 0 20px rgba(56,189,248,0.3)",
          }}>
            {running ? "ANALYZING…" : `RUN BATTLE`}
          </button>
          {doneResults.length > 0 && (
            <button onClick={() => {
              const h = ["Token","Chain","Symbol","Overall","Demand","Presence","Liquidity","BridgeRisk","DumpRisk","Strategy"];
              const rows = ranked.map(r=>[r.token,r.chain,r.meta?.symbol??"",r.scores?.overall??"",r.scores?.demand??"",r.scores?.marketPresence??"",r.scores?.liquidity??"",r.scores?.bridgeRisk??"",r.scores?.dumpRisk??"",r.strategy?.strategy??""]);
              const csv = [h,...rows].map(r=>r.join(",")).join("\n");
              const a = Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:"sunrise-compare.csv"});
              a.click();
            }} style={{ marginLeft:"auto", padding:"9px 18px", fontSize:11, borderRadius:5, cursor:"pointer", border:"1px solid rgba(255,255,255,0.06)", background:"transparent", color:"#334155", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.06em" }}>
              ↓ CSV
            </button>
          )}
        </div>

        {!hasRun && (
          <div style={{ textAlign:"center", padding:"60px 24px", border:"1px dashed rgba(255,255,255,0.06)", borderRadius:10 }}>
            <div style={{ fontFamily:"'Syne'", fontSize:40, color:"#1e293b", marginBottom:12 }}>⚔</div>
            <p style={{ fontSize:11, color:"#334155", letterSpacing:"0.06em" }}>ENTER TOKEN ADDRESSES AND TAP RUN BATTLE</p>
          </div>
        )}

        {hasRun && (
          <div>
            {results.some(r=>r.status==="loading") && (
              <div style={{ display:"flex", gap:10, marginBottom:24 }}>
                {results.map((r,i) => r.status==="loading" && (
                  <div key={r.id} style={{ flex:1, padding:24, border:"1px solid rgba(255,255,255,0.05)", borderRadius:8, textAlign:"center", background:"rgba(10,10,20,0.6)" }}>
                    <div style={{ fontSize:20, marginBottom:8, display:"inline-block", animation:"spin 1.2s linear infinite" }}>◌</div>
                    <p style={{ fontSize:10, color:"#334155", letterSpacing:"0.06em" }}>{r.token.slice(0,10)}…</p>
                  </div>
                ))}
              </div>
            )}

            {ranked.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:doneResults.length>=3?"1fr 1fr":"1fr", gap:24, marginBottom:32 }}>

                <div>
                  <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.12em", marginBottom:12 }}>
                    LEADERBOARD — RANKED BY OVERALL SCORE
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {ranked.map((r,i) => {
                      const color = TOKEN_COLORS[doneResults.indexOf(r)];
                      const sc    = r.scores!.overall;
                      return (
                        <div key={r.id} style={{
                          display:"flex", alignItems:"center", gap:14, padding:"14px 18px",
                          border:`1px solid ${color}${i===0?"40":"18"}`,
                          borderRadius:8, background:`${color}${i===0?"08":"04"}`,
                          animation:`fadeUp 0.25s ease both`, animationDelay:`${i*60}ms`,
                        }}>
                          <div style={{ fontFamily:"'Syne'", fontSize:11, fontWeight:800, color:i===0?color:"#334155", width:20 }}>
                            #{i+1}
                          </div>
                          {r.meta?.image && <img src={r.meta.image} alt="" style={{ width:28, height:28, borderRadius:"50%", background:"#0f0f1a" }} />}
                          <div style={{ flex:1 }}>
                            <div style={{ fontFamily:"'Syne'", fontSize:13, fontWeight:700, color:"#e2e8f0" }}>
                              {r.meta?.name ?? "—"}
                            </div>
                            <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>
                              {r.chain.toUpperCase()} · {r.meta && fmtMoney(r.meta.marketCap)}
                            </div>
                          </div>
                          <div style={{ textAlign:"right" as const }}>
                            <div style={{ fontFamily:"'Syne'", fontSize:22, fontWeight:800, color:SCORE_COLOR(sc), lineHeight:1 }}>{sc}</div>
                            <div style={{ fontSize:9, letterSpacing:"0.08em", color:SCORE_COLOR(sc) }}>{SCORE_LABEL(sc)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {doneResults.length >= 2 && (
                  <div>
                    <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.12em", marginBottom:12 }}>RADAR — SCORE ACROSS DIMENSIONS</div>
                    <div style={{ background:"rgba(10,10,20,0.8)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:8, padding:"16px 8px" }}>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={radarData} margin={{ top:10, right:30, bottom:10, left:30 }}>
                          <PolarGrid stroke="rgba(255,255,255,0.06)" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill:"#334155", fontSize:10, fontFamily:"IBM Plex Mono" }} />
                          {doneResults.map((r,i) => (
                            <Radar key={r.id} name={r.meta?.symbol??`T${i+1}`}
                              dataKey={r.meta?.symbol??`T${i+1}`}
                              fill={TOKEN_COLORS[i]} fillOpacity={0.1}
                              stroke={TOKEN_COLORS[i]} strokeWidth={2} />
                          ))}
                          <Tooltip
                            contentStyle={{ background:"#0d0d18", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, fontFamily:"IBM Plex Mono", fontSize:11, color:"#e2e8f0" }}
                            labelStyle={{ color:"#64748b", fontSize:10 }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                      <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:4 }}>
                        {doneResults.map((r,i) => (
                          <div key={r.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:TOKEN_COLORS[i] }} />
                            <span style={{ fontSize:10, color:"#64748b" }}>{r.meta?.symbol??`T${i+1}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {doneResults.length > 0 && (
              <div>
                <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.12em", marginBottom:12 }}>
                  SCORE BREAKDOWN MATRIX
                </div>
                <div style={{ border:"1px solid rgba(255,255,255,0.05)", borderRadius:8, overflow:"hidden", marginBottom:32 }}>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:500 }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                          <th style={{ padding:"12px 20px", textAlign:"left" as const, fontSize:9, color:"#1e293b", letterSpacing:"0.1em" }}>DIMENSION</th>
                          {doneResults.map((r,i) => (
                            <th key={r.id} style={{ padding:"12px 16px", textAlign:"center" as const, fontSize:11, color:TOKEN_COLORS[i], fontWeight:700, letterSpacing:"0.06em" }}>
                              {r.meta?.symbol??r.token.slice(0,8)}
                              <div style={{ fontSize:9, color:"#334155", fontWeight:400, marginTop:2 }}>{r.chain.toUpperCase()}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CATEGORIES.map(({ key, label, lower }) => (
                          <tr key={key} className="score-cell" style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                            <td style={{ padding:"14px 20px", fontSize:10, color:"#475569", letterSpacing:"0.06em" }}>
                              {label}{lower && <span style={{ marginLeft:6, fontSize:8, color:"#1e293b" }}>(LOWER=BETTER)</span>}
                            </td>
                            {doneResults.map((r,i) => {
                              const raw = r.scores?.[key] ?? 0;
                              const eff = lower ? 100 - raw : raw;
                              const col = SCORE_COLOR(eff);
                              return (
                                <td key={r.id} style={{ padding:"14px 16px", textAlign:"center" as const }}>
                                  <div style={{ fontFamily:"'Syne'", fontSize:20, fontWeight:800, color:col, lineHeight:1, marginBottom:5 }}>{raw}</div>
                                  <div style={{ width:48, height:3, background:"rgba(255,255,255,0.04)", borderRadius:2, margin:"0 auto", overflow:"hidden" }}>
                                    <div style={{ width:`${eff}%`, height:"100%", background:col, borderRadius:2, transition:"width 0.7s ease" }} />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr style={{ borderTop:"1px solid rgba(255,255,255,0.06)", background:"rgba(56,189,248,0.04)" }}>
                          <td style={{ padding:"16px 20px", fontSize:10, color:"#38bdf8", letterSpacing:"0.1em", fontWeight:700 }}>OVERALL SCORE</td>
                          {doneResults.map((r,i) => {
                            const sc      = r.scores?.overall ?? 0;
                            const isWinner = ranked[0]?.id === r.id;
                            return (
                              <td key={r.id} style={{ padding:"16px", textAlign:"center" as const }}>
                                <div style={{ display:"flex", flexDirection:"column" as const, alignItems:"center", gap:6 }}>
                                  <ScoreRing score={sc} color={TOKEN_COLORS[i]} size={56} />
                                  {isWinner && <span style={{ fontSize:8, color:"#38bdf8", letterSpacing:"0.1em", fontWeight:700 }}>WINNER</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fill,minmax(260px,1fr))`, gap:10 }}>
                  {doneResults.map((r,i) => (
                    <div key={r.id} style={{
                      padding:18, border:`1px solid ${TOKEN_COLORS[i]}25`, borderRadius:8, background:`${TOKEN_COLORS[i]}05`,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        {r.meta?.image && <img src={r.meta.image} alt="" style={{ width:24, height:24, borderRadius:"50%", background:"#0f0f1a" }} />}
                        <div>
                          <div style={{ fontFamily:"'Syne'", fontSize:12, fontWeight:700, color:TOKEN_COLORS[i] }}>{r.meta?.symbol??r.token.slice(0,8)}</div>
                          <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.06em" }}>{r.chain.toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ fontFamily:"'Syne'", fontSize:12, fontWeight:700, color:"#4ade80", marginBottom:6 }}>{r.strategy?.strategy}</div>
                      <div style={{ fontSize:10, color:"#475569", lineHeight:1.7 }}>{r.strategy?.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.filter(r=>r.status==="error").map(r => (
              <div key={r.id} style={{ marginTop:10, padding:"12px 18px", border:"1px solid #f8717130", borderRadius:6, fontSize:10, color:"#f87171", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.04em" }}>
                ERR {r.token.slice(0,10)}…: {r.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
