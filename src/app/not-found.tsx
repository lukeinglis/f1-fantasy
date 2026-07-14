import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-sm mx-auto mt-12 garage-card p-6 text-center">
      <p className="text-[var(--color-racing-red)] text-6xl font-bold mb-2" style={{ fontFamily: 'var(--font-permanent-marker)' }}>404</p>
      <h1 className="text-2xl font-bold mb-2 text-stone-800" style={{ fontFamily: 'var(--font-permanent-marker)' }}>Page not found</h1>
      <p className="text-stone-600 mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="garage-button-primary inline-block"
        style={{ fontFamily: 'var(--font-permanent-marker)' }}
      >
        Go home
      </Link>
    </div>
  );
}
