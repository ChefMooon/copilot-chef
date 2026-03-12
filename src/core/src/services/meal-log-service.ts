type MealTypeValue =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

import { bootstrapDatabase } from "../lib/bootstrap";
import { addDays, formatDayKey, startOfDay, startOfWeek } from "../lib/date";
import { prisma } from "../lib/prisma";

const mealTypeLabel: Record<MealTypeValue, string> = {
  BREAKFAST: "breakfast",
  MORNING_SNACK: "morning snack",
  LUNCH: "lunch",
  AFTERNOON_SNACK: "afternoon snack",
  DINNER: "dinner",
  SNACK: "snack"
};

function getMonthStarts(weeks: Array<Array<{ date: string }>>) {
  const seen = new Set<string>();
  const monthStarts: Record<string, number> = {};

  weeks.forEach((week, index) => {
    const month = new Date(week[0].date).toLocaleString("default", {
      month: "short"
    });

    if (!seen.has(month)) {
      seen.add(month);
      monthStarts[month] = index;
    }
  });

  return monthStarts;
}

function countStreak(counts: Map<string, number>, today: Date) {
  let streak = 0;
  let cursor = startOfDay(today);

  while (counts.get(formatDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export class MealLogService {
  async getHeatmap(weeks = 13) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = startOfWeek(addDays(today, -(weeks * 7) + 1));

    const logs = await prisma.mealLog.findMany({
      where: {
        date: {
          gte: start,
          lte: today
        }
      },
      select: {
        date: true
      }
    });

    const counts = new Map<string, number>();
    logs.forEach((log: { date: Date }) => {
      const key = formatDayKey(log.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const data = Array.from({ length: weeks }, (_, weekIndex) => {
      return Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(start, weekIndex * 7 + dayIndex);
        const key = formatDayKey(date);
        const isFuture = date > today;

        return {
          date: key,
          meals: isFuture ? -1 : counts.get(key) ?? 0,
          isFuture
        };
      });
    });

    const totalMeals = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
    const activeDays = Array.from(counts.values()).filter((value) => value > 0).length;

    return {
      weeks: data,
      monthStarts: getMonthStarts(data),
      totalMeals,
      activeDays,
      streak: countStreak(counts, today)
    };
  }

  async listRecent(limit = 14) {
    await bootstrapDatabase();

    const logs = await prisma.mealLog.findMany({
      orderBy: [{ date: "desc" }, { mealType: "asc" }],
      take: limit
    });

    return logs.map((log: { id: string; date: Date; mealType: MealTypeValue; mealName: string; cooked: boolean }) => ({
      id: log.id,
      date: log.date.toISOString(),
      mealType: mealTypeLabel[log.mealType],
      mealName: log.mealName,
      cooked: log.cooked
    }));
  }

  async recordMealLog(input: {
    date: string;
    mealType: MealTypeValue;
    mealName: string;
  }) {
    await bootstrapDatabase();

    const mealLog = await prisma.mealLog.create({
      data: {
        date: startOfDay(new Date(input.date)),
        mealType: input.mealType,
        mealName: input.mealName,
        cooked: true
      }
    });

    return {
      id: mealLog.id,
      date: mealLog.date.toISOString(),
      mealType: mealTypeLabel[mealLog.mealType as MealTypeValue],
      mealName: mealLog.mealName,
      cooked: mealLog.cooked
    };
  }
}
