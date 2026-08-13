import {
  CalendarBlank,
  CalendarDots,
  Clock,
  Receipt,
  Star,
  type Icon as PhosphorIconComponent,
} from "@phosphor-icons/react";

export const QUICK_FILTER_ICON_KEYS = [
  "calendar",
  "calendar-range",
  "receipt",
  "star",
  "clock",
] as const;

export type QuickFilterIconKey = (typeof QUICK_FILTER_ICON_KEYS)[number];

export const QUICK_FILTER_ICON_REGISTRY = {
  calendar: CalendarBlank,
  "calendar-range": CalendarDots,
  receipt: Receipt,
  star: Star,
  clock: Clock,
} satisfies Record<QuickFilterIconKey, PhosphorIconComponent>;