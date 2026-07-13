"use client";

import { useState } from "react";
import PickForm from "./PickForm";

interface PickBannerProps {
  raceId: string;
  raceName: string;
  raceRound: number;
  drivers: { id: string; code: string | null; givenName: string; familyName: string }[];
  constructors: { id: string; name: string }[];
  currentDriverId: string | null;
  currentConstructorId: string | null;
  driverUses: Record<string, number>;
  constructorUses: Record<string, number>;
  maxDriverPicks: number;
  maxConstructorPicks: number;
}

export default function PickBanner(props: PickBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section
      className="bg-zinc-900 border border-zinc-800 border-l-amber-500 border-l-4 rounded-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-stone-100">Make your pick</h2>
          <span className="text-sm text-stone-300">
            R{props.raceRound}: {props.raceName}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <PickForm
            raceId={props.raceId}
            drivers={props.drivers}
            constructors={props.constructors}
            currentDriverId={props.currentDriverId}
            currentConstructorId={props.currentConstructorId}
            driverUses={props.driverUses}
            constructorUses={props.constructorUses}
            maxDriverPicks={props.maxDriverPicks}
            maxConstructorPicks={props.maxConstructorPicks}
          />
        </div>
      )}
    </section>
  );
}
