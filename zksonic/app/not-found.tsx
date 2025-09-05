// app/not-found.tsx
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a href="/" className="mt-4 inline-block text-primary hover:underline">
          Go back home
        </a>
      </div>
    </div>
  );
}
