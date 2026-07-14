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
        className="hidden md:block relative w-full overflow-hidden rounded-2xl border-3 border-[var(--color-garage-metal-dark)] shadow-xl"
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
              className="absolute group cursor-pointer transition-all duration-200 hover:brightness-125 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
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

              {/* Floating label — appears above the zone on hover */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
                <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
                  <div
                    className="text-white text-sm uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-f1-bold)" }}
                  >
                    {zone.label}
                  </div>
                  <div className="text-white/60 text-xs mt-0.5">
                    {zone.description}
                  </div>
                </div>
                {/* Arrow pointing down to the object */}
                <div className="w-0 h-0 mx-auto border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-black/80" />
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
