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
    <div className="max-w-sm mx-auto mt-12 garage-card p-6">
      <h1
        className="text-xl mb-4 text-stone-800"
        style={{ fontFamily: "var(--font-f1-bold)", textShadow: "1px 1px 0px rgba(0,0,0,0.1)" }}
      >
        Sign in
      </h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="text"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="username"
          className="w-full bg-[var(--color-whiteboard)] border-[var(--color-garage-metal)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-oil-stain)] focus:border-[var(--color-racing-red)] focus:ring-1 focus:ring-[var(--color-racing-red)] outline-none"
        />
        <input
          type="password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full bg-[var(--color-whiteboard)] border-[var(--color-garage-metal)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-oil-stain)] focus:border-[var(--color-racing-red)] focus:ring-1 focus:ring-[var(--color-racing-red)] outline-none"
        />
        {error && <p className="text-red-700 text-sm font-medium">{error}</p>}
        <button
          disabled={loading}
          className="w-full garage-button-primary disabled:opacity-50"
          style={{ fontFamily: "var(--font-f1-bold)" }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-stone-500 mt-4">
        No account?{" "}
        <Link href="/register" className="text-[var(--color-racing-red)] hover:underline font-bold">
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
