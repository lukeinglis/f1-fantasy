"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <div className="max-w-sm mx-auto mt-12 garage-card p-6">
      <h1 className="text-2xl font-bold mb-4 text-stone-800" style={{ fontFamily: 'var(--font-permanent-marker)' }}>Something went wrong</h1>
      <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2.5 text-sm text-red-800 mb-6">
        Something went wrong. Please try again.
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="garage-button-primary"
          style={{ fontFamily: 'var(--font-permanent-marker)' }}
        >
          Try again
        </button>
        <Link href="/" className="text-[var(--color-racing-red)] hover:underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
