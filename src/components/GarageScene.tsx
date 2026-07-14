"use client";

import Image from "next/image";
import Link from "next/link";

export interface GarageZoneConfig {
  href: string;
  label: string;
  description: string;
  top: string;
  left: string;
  width: string;
  height: string;
  badge?: string;
}

interface GarageSceneProps {
  zones: GarageZoneConfig[];
}

export default function GarageScene({ zones }: GarageSceneProps) {
  return (
    <section>
      {/* Desktop: illustration with clickable overlay zones */}
      <div
        className="hidden md:block relative w-full rounded-2xl overflow-hidden border-3 border-[var(--color-garage-metal-dark)] shadow-xl"
        style={{ aspectRatio: "1672 / 941" }}
      >
        <Image
          src="/images/garage-hub.png"
          alt="F1 Fantasy Garage"
          fill
          className="object-cover"
          priority
        />

        <div className="absolute inset-0">
          {zones.map((zone) => (
            <Link
              key={zone.href}
              href={zone.href}
              className="absolute flex items-center justify-center rounded-lg border-2 border-white/10 hover:border-white/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:bg-black/50 transition-all duration-200 group cursor-pointer"
              style={{
                top: zone.top,
                left: zone.left,
                width: zone.width,
                height: zone.height,
              }}
            >
              {zone.badge && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-10">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-racing-red)] opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-[var(--color-racing-red)]" />
                </span>
              )}

              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center">
                <div className="bg-black/70 rounded-lg px-3 py-1.5 inline-block">
                  <div
                    className="text-white text-sm uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-f1-bold)" }}
                  >
                    {zone.label}
                  </div>
                  <div className="text-white/70 text-xs mt-0.5">
                    {zone.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile: image (decorative) + stacked card list */}
      <div className="md:hidden space-y-3">
        <div
          className="relative w-full rounded-2xl overflow-hidden border-3 border-[var(--color-garage-metal-dark)] shadow-xl"
          style={{ aspectRatio: "1672 / 941" }}
        >
          <Image
            src="/images/garage-hub.png"
            alt="F1 Fantasy Garage"
            fill
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-3">
          {zones.map((zone) => (
            <Link
              key={zone.href}
              href={zone.href}
              className="garage-card group relative flex items-center justify-between px-4 py-3 hover:scale-[1.02] hover:shadow-xl transition-all duration-200"
            >
              {zone.badge && (
                <span className="absolute -top-2 -right-2 bg-[var(--color-racing-red)] text-white uppercase text-xs px-2 py-0.5 rounded-full font-bold">
                  {zone.badge}
                </span>
              )}
              <div>
                <span
                  className="text-sm uppercase tracking-wider text-[var(--color-oil-stain)]"
                  style={{ fontFamily: "var(--font-russo-one)" }}
                >
                  {zone.label}
                </span>
                <span className="block text-xs text-[var(--color-garage-metal)] mt-0.5 leading-snug">
                  {zone.description}
                </span>
              </div>
              <span className="text-[var(--color-garage-metal)] group-hover:text-[var(--color-racing-red)] transition-colors text-lg">
                &rarr;
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
