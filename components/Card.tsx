"use client";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: string; // e.g. "violet", "cyan", "green"
  hover?: boolean;
  padding?: boolean;
}

const GLOW_MAP: Record<string, string> = {
  violet: "border-violet-500/20 shadow-violet-500/5",
  cyan: "border-cyan-500/20 shadow-cyan-500/5",
  green: "border-green-500/20 shadow-green-500/5",
  amber: "border-amber-500/20 shadow-amber-500/5",
  red: "border-red-500/20 shadow-red-500/5",
};

export default function Card({
  children,
  className = "",
  glow,
  hover = false,
  padding = true,
}: CardProps) {
  const glowClasses = glow ? GLOW_MAP[glow] || "" : "";

  return (
    <div
      className={`
        rounded-2xl border border-white/[0.06] bg-[#0d0d14]/80 backdrop-blur-sm
        ${glowClasses}
        ${hover ? "hover:border-white/[0.12] hover:-translate-y-0.5 transition-all duration-300" : ""}
        ${padding ? "p-6" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
