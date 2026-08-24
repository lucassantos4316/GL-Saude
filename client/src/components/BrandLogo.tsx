import * as React from "react";
import { cn } from "@/lib/utils";
import { useId } from "react";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const gradientId = `brand-gradient-${useId().replace(/:/g, "")}`;
  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="GGL saude">
      <svg width={compact ? 38 : 46} height={compact ? 38 : 46} viewBox="0 0 100 100" role="img" aria-label="Símbolo saude">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#087A92" />
            <stop offset="55%" stopColor="#18AFA0" />
            <stop offset="100%" stopColor="#4CCB73" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="15" r="8" fill={`url(#${gradientId})`} />
        <path d="M50 83c-2-9 11-13 16-25 5-12 4-26 17-40-2 18-7 29-2 38 4 8 11 9 17 5-2 10-13 16-27 10-5 8-11 12-15 16-2 2-5 1-6-4Z" fill={`url(#${gradientId})`} />
        <path d="M49 34c-8-12-27-10-28 7-1 14 17 25 29 35 12-10 29-21 28-35-1-17-20-19-29-7Z" fill="none" stroke={`url(#${gradientId})`} strokeWidth="8" strokeLinecap="round" />
        <path d="M20 49c10-2 21 4 30 16" fill="none" stroke={`url(#${gradientId})`} strokeWidth="7" strokeLinecap="round" />
        <path d="M43 48h7v-7h8v7h7v8h-7v7h-8v-7h-7Z" fill={`url(#${gradientId})`} />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="text-[1.45rem] font-extrabold tracking-[-0.06em] text-[#087A92]">GGL</div>
          <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#18AFA0]">saude</div>
        </div>
      )}
    </div>
  );
}
