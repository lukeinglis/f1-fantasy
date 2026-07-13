import Link from "next/link";
import F1Game from "@/components/F1Game";

export default function GamePage() {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-stone-700 hover:text-stone-900 transition-colors font-medium"
      >
        &larr; Back to home
      </Link>

      <h1
        className="text-3xl text-stone-900"
        style={{
          fontFamily: "var(--font-bangers)",
          textShadow: "1px 1px 0px rgba(0,0,0,0.15)",
        }}
      >
        <span className="text-red-600">F1</span> Dodge
      </h1>

      <div className="card-paper border-2 border-stone-400 rounded-xl p-4 cartoon-shadow">
        <F1Game />
      </div>
    </div>
  );
}
