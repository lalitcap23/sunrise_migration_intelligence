"use client";

interface ScoreBarProps {
  score: number;
  label: string;
  invert?: boolean; // higher = worse (e.g. dump risk)
}

export default function ScoreBar({ score, label, invert = false }: ScoreBarProps) {
  const effective = invert ? 100 - score : score;
  const color = effective >= 70 ? "#22c55e" : effective >= 40 ? "#eab308" : "#ef4444";
  const displayColor = invert
    ? (score >= 70 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 30 ? "#eab308" : "#22c55e")
    : color;

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-sm font-semibold font-mono" style={{ color: displayColor }}>
          {score}/100
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, background: displayColor }}
        />
      </div>
    </div>
  );
}
