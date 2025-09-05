// app/error.tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 opacity-80">{error.message || "Unexpected error"}</p>
      <button
        className="mt-4 px-4 py-2 rounded border"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
