"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-sm mx-auto mt-12 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <h1 className="text-2xl font-bold mb-4 text-stone-100">Something went wrong</h1>
      <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-2.5 text-sm text-red-300 mb-6">
        {error.message || "An unexpected error occurred."}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 py-2.5 font-medium"
        >
          Try again
        </button>
        <Link href="/" className="text-stone-400 hover:text-stone-200">
          Go home
        </Link>
      </div>
    </div>
  );
}
