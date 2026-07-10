export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
      <p className="text-zinc-500 text-sm">Loading...</p>
    </div>
  );
}
