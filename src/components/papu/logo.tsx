import { cn } from "@/lib/cn";

export function Logo({ className, mark = "size-10" }: { className?: string; mark?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-bone", className)}>
      <svg viewBox="0 0 32 32" className={cn("shrink-0", mark)} aria-hidden="true">
        <rect x="14" y="5" width="13" height="10.5" rx="3.5" className="fill-bone" />
        <path className="fill-bone" d="M17 15.5h5.2L17.4 20.2z" />
        <rect x="5" y="13" width="15.5" height="11" rx="3.75" className="fill-amber" />
        <path className="fill-amber" d="M8 24h5.6L8.4 28.4z" />
      </svg>
      <span className="font-display text-2xl leading-none tracking-tight">
        Papu<span className="italic text-amber">Whats</span>
      </span>
    </span>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-ink" />
      <rect x="14" y="5" width="13" height="10.5" rx="3.5" className="fill-bone" />
      <path className="fill-bone" d="M17 15.5h5.2L17.4 20.2z" />
      <rect x="5" y="13" width="15.5" height="11" rx="3.75" className="fill-amber" />
      <path className="fill-amber" d="M8 24h5.6L8.4 28.4z" />
    </svg>
  );
}
