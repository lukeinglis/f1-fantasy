"use client";

import { useEffect, useState } from "react";

interface Props {
  targetDate: string; // ISO string
  label: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    total: diff,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function Countdown({ targetDate, label }: Props) {
  const [time, setTime] = useState<TimeLeft | null>(null);

  useEffect(() => {
    setTime(calcTimeLeft(targetDate));
    const id = setInterval(() => {
      setTime(calcTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  // Don't render anything on the server to avoid hydration mismatch
  if (time === null) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <div className="flex gap-1 font-mono text-lg font-bold text-zinc-600">
          <span>--:--:--</span>
        </div>
      </div>
    );
  }

  if (time.total <= 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-400">Race underway</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="flex gap-1.5">
        {time.days > 0 && (
          <TimeUnit value={time.days} unit="d" />
        )}
        <TimeUnit value={time.hours} unit="h" />
        <TimeUnit value={time.minutes} unit="m" />
        <TimeUnit value={time.seconds} unit="s" />
      </div>
    </div>
  );
}

function TimeUnit({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="font-mono text-xl font-bold tabular-nums text-white">
        {pad(value)}
      </span>
      <span className="text-[10px] text-zinc-500 font-medium">{unit}</span>
    </div>
  );
}
