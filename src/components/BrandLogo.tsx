import React from "react";

interface BrandLogoProps {
  compact?: boolean;
  dark?: boolean;
}

export function BrandLogo({ dark = false }: BrandLogoProps) {
  return (
    <span className="inline-flex select-none items-center gap-2">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="4"
          y="2.5"
          width="16"
          height="19"
          rx="2.5"
          className={dark ? "fill-white" : "fill-slate-900"}
        />
        <path
          d="M8.5 12.5l2.3 2.3 4.7-5"
          stroke="#2DD4BF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`text-[17px] font-semibold tracking-tight ${
          dark ? "text-white" : "text-slate-900"
        }`}
      >
        EZDocs
      </span>
    </span>
  );
}
