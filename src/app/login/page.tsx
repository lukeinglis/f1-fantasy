"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      name,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Wrong name or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto mt-12 bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="text"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="username"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-zinc-400 mt-4">
        No account?{" "}
        <Link href="/register" className="text-red-400 hover:underline">
          Join the league
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
