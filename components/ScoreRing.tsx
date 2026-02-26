"use client";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

const getColor = (score: number) =>
  score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";

const getLabel = (score: number) =>
  score >= 70 ? "Strong" : score >= 40 ? "Moderate" : "Weak";

export default function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  label,
  className = "",
}: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = getColor(score);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-1000 ease-out"
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill={color}
          fontSize={size * 0.3}
          fontWeight={700}
          className="font-mono"
        >
          {score}
        </text>
      </svg>
      {label && (
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
      )}
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {getLabel(score)}
      </span>
    </div>
  );
}

export { getColor, getLabel };
