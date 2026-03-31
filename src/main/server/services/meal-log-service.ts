type MealTypeValue =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SNACK";

import { bootstrapDatabase } from "../lib/bootstrap";
import { classifyCuisine } from "../lib/cuisine-classifier";
import { addDays, formatDayKey, startOfDay, startOfWeek } from "../lib/date";
import { prisma } from "../lib/prisma";

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

const mealTypeLabel: Record<MealTypeValue, string> = {
  BREAKFAST: "breakfast",
  MORNING_SNACK: "morning snack",
  LUNCH: "lunch",
  AFTERNOON_SNACK: "afternoon snack",
  DINNER: "dinner",
  SNACK: "snack",
};

function getMonthStarts(weeks: Array<Array<{ date: string }>>) {
  const seen = new Set<string>();
  const monthStarts: Record<string, number> = {};

  weeks.forEach((week, index) => {
    const month = new Date(week[0].date).toLocaleString("default", {
      month: "short",
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
  async listAll() {
    await bootstrapDatabase();

    const logs = await prisma.mealLog.findMany({
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
    });

    return logs.map(
      (log: {
        id: string;
        date: Date;
        mealType: MealTypeValue;
        mealName: string;
        cooked: boolean;
      }) => ({
        id: log.id,
        date: log.date.toISOString(),
        mealType: mealTypeLabel[log.mealType],
        mealName: log.mealName,
        cooked: log.cooked,
      })
    );
  }

  async getHeatmap(weeks = 13) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = startOfWeek(addDays(today, -(weeks * 7) + 1));

    const logs = await prisma.mealLog.findMany({
      where: {
        date: {
          gte: start,
          lte: today,
        },
      },
      select: {
        date: true,
      },
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
          meals: isFuture ? -1 : (counts.get(key) ?? 0),
          isFuture,
        };
      });
    });

    const totalMeals = Array.from(counts.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    const activeDays = Array.from(counts.values()).filter(
      (value) => value > 0
    ).length;

    return {
      weeks: data,
      monthStarts: getMonthStarts(data),
      totalMeals,
      activeDays,
      streak: countStreak(counts, today),
    };
  }

  async listRecent(limit = 14) {
    await bootstrapDatabase();

    const logs = await prisma.mealLog.findMany({
      orderBy: [{ date: "desc" }, { mealType: "asc" }],
      take: limit,
    });

    return logs.map(
      (log: {
        id: string;
        date: Date;
        mealType: MealTypeValue;
        mealName: string;
        cooked: boolean;
      }) => ({
        id: log.id,
        date: log.date.toISOString(),
        mealType: mealTypeLabel[log.mealType],
        mealName: log.mealName,
        cooked: log.cooked,
      })
    );
  }

  async getMealTypeBreakdown() {
    await bootstrapDatabase();

    const groups = await prisma.mealLog.groupBy({
      by: ["mealType"],
      _count: { _all: true },
    });

    groups.sort((a, b) => b._count._all - a._count._all);

    return groups.map((g) => ({
      mealType: mealTypeLabel[g.mealType as MealTypeValue] ?? g.mealType,
      count: g._count._all,
    }));
  }

  async getCuisineBreakdown() {
    await bootstrapDatabase();

    const logs = await prisma.mealLog.findMany({
      select: { mealName: true },
    });

    const counts = new Map<string, number>();
    for (const log of logs) {
      const cuisine = classifyCuisine(log.mealName);
      counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getWeeklyTrend(weeks = 12) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = addDays(today, -(weeks * 7));

    const logs = await prisma.mealLog.findMany({
      where: { date: { gte: start, lte: today } },
      select: { date: true },
    });

    const weekCounts = new Map<string, number>();
    for (const log of logs) {
      const d = new Date(log.date);
      const year = d.getFullYear();
      const weekNum = getISOWeek(d);
      const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }

    const result: { weekLabel: string; meals: number }[] = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = startOfWeek(addDays(today, -(weeks - 1 - i) * 7));
      const year = weekStart.getFullYear();
      const weekNum = getISOWeek(weekStart);
      const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
      const label = weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      result.push({ weekLabel: label, meals: weekCounts.get(key) ?? 0 });
    }

    return result;
  }

  async getDayOfWeekBreakdown() {
    await bootstrapDatabase();

    const logs = await prisma.mealLog.findMany({
      select: { date: true },
    });

    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0) as number[];

    for (const log of logs) {
      const dayIndex = new Date(log.date).getDay();
      counts[dayIndex]++;
    }

    // Return Mon–Sun order
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((i) => ({ day: DAY_NAMES[i], count: counts[i] }));
  }

  async getPlanVsLogStats(days = 30) {
    await bootstrapDatabase();

    const today = startOfDay(new Date());
    const start = addDays(today, -days);

    const [planned, logged] = await Promise.all([
      prisma.meal.count({ where: { date: { gte: start, lte: today } } }),
      prisma.mealLog.count({ where: { date: { gte: start, lte: today } } }),
    ]);

    const followThroughRate =
      planned > 0 ? Math.round((logged / planned) * 100) : 0;

    return { planned, logged, followThroughRate };
  }

  async getTopMeals(limit = 10) {
    await bootstrapDatabase();

    const groups = await prisma.mealLog.groupBy({
      by: ["mealName"],
      _count: { _all: true },
    });

    groups.sort((a, b) => b._count._all - a._count._all);

    return groups.slice(0, limit).map((g) => ({
      mealName: g.mealName,
      count: g._count._all,
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
        cooked: true,
      },
    });

    return {
      id: mealLog.id,
      date: mealLog.date.toISOString(),
      mealType: mealTypeLabel[mealLog.mealType as MealTypeValue],
      mealName: mealLog.mealName,
      cooked: mealLog.cooked,
    };
  }
}
