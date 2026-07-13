"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Registration failed");
      setLoading(false);
      return;
    }
    const login = await signIn("credentials", {
      name,
      password,
      redirect: false,
    });
    setLoading(false);
    if (login?.error) {
      setError("Registered but couldn't sign in. Try the login page.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto mt-12 card-paper border-2 border-stone-400 p-6 rounded-xl cartoon-shadow">
      <h1
        className="text-xl mb-4 text-stone-800"
        style={{ fontFamily: "var(--font-bangers)", textShadow: "1px 1px 0px rgba(0,0,0,0.1)" }}
      >
        Join the league
      </h1>
      <p className="text-sm text-stone-500 mb-4">
        Pick a name and a password. That&apos;s it.
      </p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="text"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="username"
          className="w-full bg-stone-100 border border-stone-400 rounded-lg px-3 py-2.5 text-sm text-stone-800 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
        />
        <input
          type="password"
          value={password}
          required
          minLength={4}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 4 chars)"
          autoComplete="new-password"
          className="w-full bg-stone-100 border border-stone-400 rounded-lg px-3 py-2.5 text-sm text-stone-800 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 outline-none"
        />
        {error && <p className="text-red-700 text-sm font-medium">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-500 hover:scale-105 text-white py-2.5 rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 sticker transition-transform"
          style={{ fontFamily: "var(--font-bangers)", borderWidth: "3px" }}
        >
          {loading ? "Creating..." : "Join"}
        </button>
      </form>
      <p className="text-sm text-stone-500 mt-4">
        Already joined?{" "}
        <Link href="/login" className="text-red-700 hover:underline font-bold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
