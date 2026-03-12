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
