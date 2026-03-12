import Link from "next/link";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-sans text-[0.78rem] font-bold uppercase tracking-[0.12em] text-orange">
            {eyebrow}
          </p>
          <div className="space-y-2">
            <h1 className="font-serif text-4xl font-bold text-text md:text-5xl">{title}</h1>
            <p className="max-w-2xl text-base font-medium text-text-muted md:text-lg">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {secondaryAction ? (
            <Button asChild variant="outline">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
          {primaryAction ? (
            <Button asChild variant="accent">
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">{children}</div>
    </section>
  );
}
