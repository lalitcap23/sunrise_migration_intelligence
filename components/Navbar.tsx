"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/analyze", label: "Analyze", icon: "🔬" },
  { href: "/tokens", label: "Markets", icon: "📊" },
  { href: "/compare", label: "Compare", icon: "⚔️" },
  { href: "/reports", label: "Reports", icon: "📋" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#050508]/80 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">
          S
        </div>
        <span className="font-semibold text-white text-sm tracking-tight">
          Sunrise<span className="text-violet-400"> Intelligence</span>
        </span>
      </Link>
      <div className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`
                relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${active
                  ? "text-white bg-white/[0.07] shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                }
              `}
            >
              <span className="text-xs">{link.icon}</span>
              <span className="hidden sm:inline">{link.label}</span>
              {active && (
                <span className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-violet-500/60 via-cyan-400/60 to-violet-500/60" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
