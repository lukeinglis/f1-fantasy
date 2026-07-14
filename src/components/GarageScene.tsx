"use client";

import { ReactNode } from "react";

interface GarageSceneProps {
  children: ReactNode;
}

export default function GarageScene({ children }: GarageSceneProps) {
  return (
    <section className="rounded-2xl overflow-hidden border-3 border-[var(--color-garage-metal-dark)] shadow-xl">
      {/* Pegboard wall — upper section */}
      <div className="pegboard-wall p-4 sm:p-6 md:p-8">
        <div className="hidden md:grid grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr">
          {children}
        </div>
        {/* Mobile: stacked cards */}
        <div className="md:hidden flex flex-col gap-3">
          {children}
        </div>
      </div>

      {/* Concrete floor accent */}
      <div className="concrete-floor h-3 border-t-2 border-[var(--color-garage-metal)]" />
    </section>
  );
}
