"use client";

import Image from "next/image";
import { useState } from "react";
import { driverImage } from "@/lib/f1-meta";

export function DriverAvatar({
  driverId,
  size = 80,
  className = "",
}: {
  driverId: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState(driverImage(driverId));

  return (
    <Image
      src={src}
      alt={driverId.replace(/_/g, " ")}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-[var(--color-garage-wall)] ${className}`}
      onError={() => setSrc("/drivers/default.svg")}
    />
  );
}
