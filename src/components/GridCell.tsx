"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";

interface GridCellProps {
  tooltipContent: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

export default function GridCell({ tooltipContent, className, style, children }: GridCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cellRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!showTooltip) return;
    function handleClickOutside(e: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showTooltip]);

  return (
    <td
      ref={cellRef}
      className={className}
      style={style}
      onClick={() => setShowTooltip((prev) => !prev)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      <div
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none ${
          showTooltip ? "block" : "hidden"
        }`}
      >
        {tooltipContent}
      </div>
    </td>
  );
}
