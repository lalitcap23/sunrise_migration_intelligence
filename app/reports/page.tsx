"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type SavedReport = {
  cid: string; tokenName: string; tokenSymbol: string;
  contractAddress: string; chain: string; overall: number;
  strategy: string; savedAt: string; gateway: string;
};

const CHAIN_ACCENT: Record<string,string> = { ethereum: "#60a5fa", bsc: "#fbbf24", polygon: "#c084fc" };
const SCORE_COLOR = (s: number) => s >= 70 ? "#4ade80" : s >= 40 ? "#fbbf24" : "#f87171";
const SCORE_LABEL = (s: number) => s >= 70 ? "STRONG" : s >= 40 ? "MODERATE" : "WEAK";
function trunc(s: string, a=8, b=6){ return s.length<=a+b ? s : `${s.slice(0,a)}…${s.slice(-b)}`; }

export default function ReportsPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [copied,  setCopied]  = useState<string|null>(null);

  useEffect(() => {
    try {
      const r = localStorage.getItem("sunrise_reports");
      if (r) setReports(JSON.parse(r));
    } catch {}
  }, []);

  const del = (cid: string) => {
    const next = reports.filter(r => r.cid !== cid);
    setReports(next);
    localStorage.setItem("sunrise_reports", JSON.stringify(next));
  };
  const copy = (text: string, key: string) =>
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(()=>setCopied(null),1400); });

  return (
    <div style={{ minHeight: "100vh", background: "#07070e", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .report-row{transition:background 0.12s;}
        .report-row:hover{background:rgba(255,255,255,0.02)!important;}
        .cp-btn{transition:all 0.15s;}
        .cp-btn:hover{opacity:0.8;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 48 }}>
          <Link href="/" style={{ fontSize: 12, color: "#475569", textDecoration:"none", letterSpacing:"0.05em" }}>← BACK</Link>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { href:"/tokens",  label:"MARKETS",  color:"#38bdf8" },
              { href:"/analyze", label:"ANALYZE",  color:"#60a5fa" },
              { href:"/compare", label:"COMPARE",  color:"#c084fc" },
            ].map(b => (
              <Link key={b.href} href={b.href} style={{
                fontSize:11, fontWeight:600, color:b.color, textDecoration:"none",
                padding:"5px 14px", border:`1px solid ${b.color}40`, borderRadius:4,
                background:`${b.color}0c`, letterSpacing:"0.08em",
              }}>{b.label}</Link>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
            <h1 style={{ fontFamily:"'Syne'", fontSize:32, fontWeight:800, color:"#ffffff", letterSpacing:"-0.02em" }}>
              IPFS Archive
            </h1>
            <span style={{
              fontFamily:"'IBM Plex Mono'", fontSize:9, fontWeight:600, letterSpacing:"0.1em",
              color:"#fbbf24", border:"1px solid #fbbf2440", borderRadius:3,
              padding:"3px 9px", background:"#fbbf2408",
            }}>
              📌 PINNED
            </span>
          </div>
          <p style={{ fontSize:12, color:"#475569", letterSpacing:"0.03em" }}>
            {reports.length} report{reports.length!==1?"s":""} stored — CIDs are permanent on IPFS
          </p>
        </div>

        {reports.length === 0 ? (
          <div style={{
            border:"1px dashed rgba(255,255,255,0.07)", borderRadius:10,
            padding:"80px 24px", textAlign:"center",
          }}>
            <div style={{ fontFamily:"'Syne'", fontSize:40, marginBottom:16, color:"#1e293b" }}>⬡</div>
            <p style={{ fontSize:12, color:"#334155", marginBottom:20, letterSpacing:"0.05em" }}>
              NO REPORTS PINNED YET
            </p>
            <Link href="/analyze" style={{
              fontSize:11, fontWeight:600, color:"#38bdf8", textDecoration:"none",
              padding:"8px 20px", border:"1px solid #38bdf830", borderRadius:4,
              background:"#38bdf808", letterSpacing:"0.08em",
            }}>
              RUN AN ANALYSIS →
            </Link>
          </div>
        ) : (
          <>
            <div style={{
              display:"grid",
              gridTemplateColumns:"1fr 90px 90px 1fr 32px",
              padding:"10px 20px",
              borderBottom:"1px solid rgba(255,255,255,0.05)",
              marginBottom:2,
            }}>
              {["TOKEN", "SCORE", "CHAIN", "IDENTIFIERS", ""].map((h,i) => (
                <span key={i} style={{ fontSize:9, letterSpacing:"0.12em", color:"#1e293b", fontWeight:600 }}>{h}</span>
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {[...reports].reverse().map((r, i) => {
                const accent = CHAIN_ACCENT[r.chain] ?? "#64748b";
                const sc     = SCORE_COLOR(r.overall);
                const sl     = SCORE_LABEL(r.overall);
                return (
                  <div
                    key={r.cid}
                    className="report-row"
                    style={{
                      display:"grid",
                      gridTemplateColumns:"1fr 90px 90px 1fr 32px",
                      alignItems:"center",
                      padding:"16px 20px",
                      border:"1px solid rgba(255,255,255,0.04)",
                      borderRadius:8,
                      background:"rgba(10,10,20,0.6)",
                      animation:`fadeUp 0.25s ease both`,
                      animationDelay:`${i*50}ms`,
                    }}
                  >
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"'Syne'", fontSize:14, fontWeight:700, color:"#e2e8f0" }}>{r.tokenName}</span>
                        <span style={{
                          fontSize:9, fontWeight:700, color:accent, letterSpacing:"0.08em",
                          border:`1px solid ${accent}40`, padding:"2px 6px", borderRadius:3,
                          background:`${accent}0c`,
                        }}>{r.tokenSymbol}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#334155" }}>
                        {new Date(r.savedAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                        {" · "}{r.strategy}
                      </div>
                    </div>

                    <div style={{ textAlign:"center" as const }}>
                      <div style={{ fontFamily:"'Syne'", fontSize:24, fontWeight:800, color:sc, lineHeight:1 }}>{r.overall}</div>
                      <div style={{ fontSize:8, letterSpacing:"0.1em", color:sc, marginTop:3 }}>{sl}</div>
                    </div>

                    <div style={{ textAlign:"center" as const }}>
                      <div style={{ fontSize:10, color:accent, fontWeight:600, letterSpacing:"0.06em" }}>{r.chain.toUpperCase()}</div>
                    </div>

                    <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:9, color:"#1e293b", width:28 }}>ADDR</span>
                        <code style={{ fontSize:10, color:"#64748b", background:"rgba(255,255,255,0.03)", padding:"2px 7px", borderRadius:3, letterSpacing:"0.03em" }}>
                          {trunc(r.contractAddress)}
                        </code>
                        <button className="cp-btn" onClick={()=>copy(r.contractAddress,`a-${r.cid}`)} style={{
                          fontSize:9, color:copied===`a-${r.cid}`?"#4ade80":"#334155",
                          background:"transparent", border:"none", cursor:"pointer", fontFamily:"'IBM Plex Mono'",
                        }}>{copied===`a-${r.cid}`?"✓":"CP"}</button>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:9, color:"#1e293b", width:28 }}>CID</span>
                        <code style={{ fontSize:10, color:"#a78bfa", background:"rgba(167,139,250,0.06)", padding:"2px 7px", borderRadius:3, letterSpacing:"0.03em" }}>
                          {trunc(r.cid,10,6)}
                        </code>
                        <button className="cp-btn" onClick={()=>copy(r.cid,`c-${r.cid}`)} style={{
                          fontSize:9, color:copied===`c-${r.cid}`?"#4ade80":"#334155",
                          background:"transparent", border:"none", cursor:"pointer", fontFamily:"'IBM Plex Mono'",
                        }}>{copied===`c-${r.cid}`?"✓":"CP"}</button>
                        <a href={r.gateway} target="_blank" rel="noopener noreferrer" style={{
                          fontSize:9, color:"#fbbf24", textDecoration:"none",
                          border:"1px solid #fbbf2430", padding:"1px 6px", borderRadius:2,
                          background:"#fbbf2408",
                        }}>IPFS ↗</a>
                      </div>
                    </div>

                    <button onClick={()=>del(r.cid)} style={{
                      background:"transparent", border:"none", cursor:"pointer",
                      fontSize:11, color:"#1e293b", fontFamily:"'IBM Plex Mono'",
                    }} title="Remove from local history">×</button>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop:20, display:"flex", justifyContent:"flex-end" }}>
              <button onClick={()=>{
                if(!confirm("Clear all saved reports?")) return;
                setReports([]);
                localStorage.removeItem("sunrise_reports");
              }} style={{
                fontSize:10, color:"#475569", background:"transparent",
                border:"1px solid rgba(255,255,255,0.05)", borderRadius:4,
                padding:"6px 16px", cursor:"pointer", fontFamily:"'IBM Plex Mono'",
                letterSpacing:"0.06em",
              }}>CLEAR ALL</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
