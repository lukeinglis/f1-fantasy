import Link from "next/link";

interface GarageZoneProps {
  href: string;
  icon: string;
  label: string;
  description: string;
  badge?: string;
  className?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  trophy: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <path d="M14 8h20v14c0 5.5-4.5 10-10 10s-10-4.5-10-10V8z" />
      <path d="M14 14H8c0 5 3 8 6 9" />
      <path d="M34 14h6c0 5-3 8-6 9" />
      <path d="M24 32v6" />
      <path d="M16 38h16" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="10" y="6" width="28" height="36" rx="3" />
      <path d="M18 6h12v4H18z" />
      <path d="M17 20h14" />
      <path d="M17 27h14" />
      <path d="M17 34h8" />
    </svg>
  ),
  toolbox: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="6" y="18" width="36" height="22" rx="3" />
      <path d="M16 18v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4" />
      <path d="M6 28h36" />
      <rect x="20" y="24" width="8" height="8" rx="1" />
    </svg>
  ),
  notebook: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <path d="M12 6h24a2 2 0 0 1 2 2v32a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M18 6v36" />
      <path d="M24 16h10" />
      <path d="M24 23h10" />
      <path d="M24 30h6" />
    </svg>
  ),
  corkboard: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="6" y="6" width="36" height="36" rx="3" />
      <rect x="12" y="12" width="12" height="10" rx="1" />
      <rect x="28" y="14" width="10" height="14" rx="1" />
      <rect x="14" y="26" width="14" height="10" rx="1" />
      <circle cx="18" cy="12" r="2" fill="currentColor" />
      <circle cx="33" cy="14" r="2" fill="currentColor" />
      <circle cx="21" cy="26" r="2" fill="currentColor" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <path d="M12 6h16l10 10v24a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M28 6v10h10" />
      <path d="M16 24h16" />
      <path d="M16 31h16" />
      <path d="M16 38h8" />
    </svg>
  ),
  arcade: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="8" y="6" width="32" height="36" rx="4" />
      <rect x="14" y="11" width="20" height="14" rx="2" />
      <circle cx="18" cy="34" r="3" />
      <circle cx="30" cy="32" r="2" />
      <circle cx="34" cy="36" r="2" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
      <rect x="6" y="10" width="36" height="32" rx="3" />
      <path d="M6 20h36" />
      <path d="M16 6v8" />
      <path d="M32 6v8" />
      <path d="M14 28h4v4h-4z" />
      <path d="M22 28h4v4h-4z" />
      <path d="M30 28h4v4h-4z" />
    </svg>
  ),
};

export default function GarageZone({
  href,
  icon,
  label,
  description,
  badge,
  className = "",
}: GarageZoneProps) {
  return (
    <Link
      href={href}
      className={`garage-card group relative flex flex-col items-center text-center hover:scale-105 hover:shadow-xl transition-all duration-200 ${className}`}
    >
      {badge && (
        <span className="absolute -top-2 -right-2 garage-badge bg-[var(--color-racing-red)] text-white uppercase">
          {badge}
        </span>
      )}
      <div className="text-[var(--color-garage-metal)] group-hover:text-[var(--color-racing-red)] transition-colors mb-2">
        {ICONS[icon] ?? ICONS.document}
      </div>
      <span
        className="text-sm uppercase tracking-wider text-[var(--color-oil-stain)]"
        style={{ fontFamily: "var(--font-russo-one)" }}
      >
        {label}
      </span>
      <span className="text-xs text-[var(--color-garage-metal)] mt-1 leading-snug">
        {description}
      </span>
    </Link>
  );
}
