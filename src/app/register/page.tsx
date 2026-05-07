"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Registration failed");
      setLoading(false);
      return;
    }
    // auto-login
    const login = await signIn("credentials", {
      email,
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
      <h1 className="text-xl font-semibold mb-4">Create an account</h1>
      <p className="text-sm text-zinc-400 mb-4">
        The first account becomes the league admin.
      </p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="text"
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
        />
        <input
          type="email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          required
          minLength={6}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password (min 6 chars)"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? "Creating..." : "Register"}
        </button>
      </form>
      <p className="text-sm text-zinc-400 mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-red-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
