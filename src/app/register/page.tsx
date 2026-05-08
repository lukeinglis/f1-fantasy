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
    <div className="max-w-sm mx-auto mt-12 bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
      <h1 className="text-xl font-semibold mb-4">Join the league</h1>
      <p className="text-sm text-zinc-400 mb-4">
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
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
        />
        <input
          type="password"
          value={password}
          required
          minLength={4}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 4 chars)"
          autoComplete="new-password"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Creating..." : "Join"}
        </button>
      </form>
      <p className="text-sm text-zinc-400 mt-4">
        Already joined?{" "}
        <Link href="/login" className="text-red-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
