import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * État vide réutilisable — AUCUNE illustration externe (zéro dépendance image).
 * Grosse icône Lucide dans un cercle en teinte du design system
 * (`bg-secondary` ≈ #eef4ff, icône `text-accent` = #1a56db), titre, phrase
 * courte, et un CTA (lien ou action). Cohérent avec les tokens.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  className?: string;
}) {
  const cta =
    ctaLabel && (ctaHref || ctaOnClick) ? (
      ctaHref ? (
        <Link
          href={ctaHref}
          className="bg-accent text-accent-on hover:bg-accent-hover mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors"
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={ctaOnClick}
          className="bg-accent text-accent-on hover:bg-accent-hover mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors"
        >
          {ctaLabel}
        </button>
      )
    ) : null;

  return (
    <div
      className={`border-border bg-surface flex flex-col items-center rounded-xl border px-6 py-12 text-center ${className}`}
    >
      <span className="bg-secondary text-accent grid h-[88px] w-[88px] place-items-center rounded-full">
        <Icon size={52} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-fg mt-5 text-lg font-bold">{title}</p>
      {description && (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      )}
      {cta}
    </div>
  );
}
