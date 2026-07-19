"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

const BASE_WIDTH = 3344;
const BASE_HEIGHT = 1882;

export interface GarageZoneConfig {
  href?: string;
  label?: string;
  description?: string;
  objectImage: string;
  top: string;
  left: string;
  width: string;
  height: string;
  badge?: string;
}

interface GarageSceneProps {
  zones: GarageZoneConfig[];
}

function OverlayImage({
  zone,
  visible,
}: {
  zone: GarageZoneConfig;
  visible: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  const updateSize = () => {
    const img = imgRef.current;
    if (img && img.naturalWidth > 0) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  useEffect(() => {
    updateSize();
  }, []);

  const zoneCenterX =
    parseFloat(zone.left) + parseFloat(zone.width) / 2;
  const zoneCenterY =
    parseFloat(zone.top) + parseFloat(zone.height) / 2;

  let imgStyle: React.CSSProperties;
  if (naturalSize) {
    const imgW = (naturalSize.w / BASE_WIDTH) * 100;
    const imgH = (naturalSize.h / BASE_HEIGHT) * 100;
    imgStyle = {
      width: `${imgW}%`,
      height: `${imgH}%`,
      top: `${zoneCenterY - imgH / 2}%`,
      left: `${zoneCenterX - imgW / 2}%`,
    };
  } else {
    imgStyle = {
      top: zone.top,
      left: zone.left,
      width: zone.width,
      height: zone.height,
    };
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={zone.objectImage}
      alt=""
      onLoad={updateSize}
      className={`absolute pointer-events-none transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        ...imgStyle,
        filter:
          "brightness(1.4) drop-shadow(0 0 8px rgba(255,255,255,0.4))",
      }}
    />
  );
}

function FloatingLabel({
  zone,
  visible,
}: {
  zone: GarageZoneConfig;
  visible: boolean;
}) {
  if (!zone.label) return null;
  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full transition-opacity duration-200 pointer-events-none z-20 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
        <div
          className="text-white text-sm uppercase tracking-wider"
          style={{ fontFamily: "var(--font-f1-bold)" }}
        >
          {zone.label}
        </div>
        {zone.description && (
          <div className="text-white/60 text-xs mt-0.5">
            {zone.description}
          </div>
        )}
      </div>
      <div className="w-0 h-0 mx-auto border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-black/80" />
    </div>
  );
}

export default function GarageScene({ zones }: GarageSceneProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section>
      {/* Desktop: illustration with clickable overlay zones */}
      <div
        className="hidden md:block relative w-full overflow-hidden rounded-2xl border-3 border-[var(--color-garage-metal-dark)] shadow-xl"
        style={{ aspectRatio: "3344 / 1882" }}
      >
        <Image
          src="/images/garage-hub.png"
          alt="F1 Fantasy Garage"
          fill
          className="object-cover"
          priority
        />

        {/* Overlay images — rendered at container level, sized from PNG dimensions */}
        {zones.map((zone, i) => (
          <OverlayImage
            key={`overlay-${zone.objectImage}`}
            zone={zone}
            visible={hoveredIndex === i}
          />
        ))}

        {/* Hit zones — hover/click areas with labels */}
        <div className="absolute inset-0">
          {zones.map((zone, i) => {
            const style = {
              top: zone.top,
              left: zone.left,
              width: zone.width,
              height: zone.height,
            };

            const handlers = {
              onMouseEnter: () => setHoveredIndex(i),
              onMouseLeave: () => setHoveredIndex(null),
            };

            if (!zone.href) {
              return (
                <div
                  key={zone.objectImage}
                  className="absolute cursor-default"
                  style={style}
                  {...handlers}
                >
                  <FloatingLabel zone={zone} visible={hoveredIndex === i} />
                </div>
              );
            }

            return (
              <Link
                key={zone.href}
                href={zone.href}
                className="absolute cursor-pointer"
                style={style}
                {...handlers}
              >
                {zone.badge && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-10">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-racing-red)] opacity-75" />
                    <span className="relative inline-flex h-4 w-4 rounded-full bg-[var(--color-racing-red)]" />
                  </span>
                )}
                <FloatingLabel zone={zone} visible={hoveredIndex === i} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile: image (decorative) + stacked card list */}
      <div className="md:hidden space-y-3">
        <div
          className="relative w-full rounded-2xl overflow-hidden border-3 border-[var(--color-garage-metal-dark)] shadow-xl"
          style={{ aspectRatio: "3344 / 1882" }}
        >
          <Image
            src="/images/garage-hub.png"
            alt="F1 Fantasy Garage"
            fill
            className="object-cover"
          />
        </div>

        <div className="flex flex-col gap-3">
          {zones
            .filter((z) => z.href && z.label)
            .map((zone) => (
              <Link
                key={zone.href}
                href={zone.href!}
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
