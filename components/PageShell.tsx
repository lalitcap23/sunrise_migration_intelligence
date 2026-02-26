"use client";

import Navbar from "./Navbar";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans">
      <Navbar />
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-20 left-1/3 w-[500px] h-[500px] bg-violet-600/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-cyan-500/[0.03] rounded-full blur-3xl" />
      </div>
      <main className={`relative z-10 pt-24 pb-20 px-4 sm:px-6 ${className}`}>
        {children}
      </main>
    </div>
  );
}
