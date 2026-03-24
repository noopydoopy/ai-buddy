import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="text-6xl mb-4">🤔</div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Page not found
      </h2>
      <p className="text-sm text-muted mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-dim transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
