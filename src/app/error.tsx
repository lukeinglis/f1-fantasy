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
    <div className="max-w-sm mx-auto mt-12 card-paper cartoon-shadow border-2 border-amber-800 rounded-lg p-6">
      <h1 className="text-2xl font-bold mb-4 text-stone-800" style={{ fontFamily: 'var(--font-bangers)' }}>Something went wrong</h1>
      <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2.5 text-sm text-red-800 mb-6">
        Something went wrong. Please try again.
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="sticker bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 py-2.5 font-medium"
        >
          Try again
        </button>
        <Link href="/" className="text-stone-600 hover:text-stone-800">
          Go home
        </Link>
      </div>
    </div>
  );
}
