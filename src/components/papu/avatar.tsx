import { cn } from "@/lib/cn";
import { initials } from "@/lib/papu/format";
import type { Tone } from "@/lib/papu/types";

const toneClass: Record<Tone, string> = {
  amber: "bg-amber text-ink",
  clay: "bg-clay text-bone",
  moss: "bg-moss text-bone",
  bone: "bg-bone text-ink",
};

const sizeClass = {
  sm: "size-8 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-lg",
  xl: "size-28 text-3xl",
};

export function Avatar({
  name,
  tone,
  size = "md",
  online,
  className,
}: {
  name: string;
  tone: Tone;
  size?: keyof typeof sizeClass;
  online?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold tracking-wide",
          toneClass[tone],
          sizeClass[size],
        )}
        aria-hidden="true"
      >
        {initials(name)}
      </span>
      {online ? <span className="absolute right-0 bottom-0 size-3 rounded-full bg-amber ring-2 ring-ink" /> : null}
    </span>
  );
}
