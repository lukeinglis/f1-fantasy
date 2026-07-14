import Link from "next/link";
import F1Game from "@/components/F1Game";

export default function GamePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-garage-metal)] hover:text-[var(--color-oil-stain)] transition-colors font-medium"
      >
        &larr; Back to home
      </Link>

      <h1
        className="text-3xl text-stone-900"
        style={{
          fontFamily: "var(--font-f1-bold)",
          textShadow: "1px 1px 0px rgba(0,0,0,0.15)",
        }}
      >
        <span className="text-[var(--color-racing-red)]">F1</span> Dodge
      </h1>

      <div className="garage-card p-4">
        <F1Game />
      </div>
    </div>
  );
}
