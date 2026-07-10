import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-sm mx-auto mt-12 bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
      <p className="text-red-500 text-6xl font-bold mb-2">404</p>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-zinc-400 mb-6">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="inline-block bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 py-2.5 font-medium"
      >
        Go home
      </Link>
    </div>
  );
}
