"use client";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "violet" | "cyan" | "green" | "amber" | "red" | "zinc";
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  green: "text-green-400 bg-green-500/10 border-green-500/20",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  red: "text-red-400 bg-red-500/10 border-red-500/20",
  zinc: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export default function Badge({ children, variant = "violet", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border
        text-[11px] font-semibold tracking-wide uppercase
        ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.zinc}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
