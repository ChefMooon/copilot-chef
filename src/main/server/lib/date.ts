export function startOfDay(input: Date): Date {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(input: Date): Date {
  const date = new Date(input);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(input: Date, amount: number): Date {
  const date = new Date(input);
  date.setDate(date.getDate() + amount);
  return date;
}

export function startOfWeek(input: Date): Date {
  const date = startOfDay(input);
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

export function clampDays(days: number): number {
  if (!Number.isFinite(days)) {
    return 7;
  }

  return Math.min(30, Math.max(1, Math.floor(days)));
}

export function getUpcomingDateRange(days: number, now = new Date()) {
  const normalizedDays = clampDays(days);
  const from = startOfDay(now);
  const to = endOfDay(addDays(from, normalizedDays - 1));

  return {
    days: normalizedDays,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export function formatDayKey(input: Date): string {
  const date = startOfDay(input);
  return date.toISOString().slice(0, 10);
}

export function getGreeting(input: Date): string {
  const hour = input.getHours();
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}
