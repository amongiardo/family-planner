import { Dish, DishCategory, MealType } from '@prisma/client';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';
import prisma from '../prisma';
import { SuggestionResult } from '../types';

interface DishWithUsage extends Dish {
  usageCount: number;
  lastUsedDate?: Date;
}

export async function getSuggestions(
  familyId: string,
  date: Date,
  mealType: MealType
): Promise<SuggestionResult[]> {
  // Get all dishes for the family
  const dishes = await prisma.dish.findMany({
    where: { familyId },
  });

  if (dishes.length === 0) {
    return [];
  }

  // Get meal plans from last 7 days for anti-repetition rule
  const sevenDaysAgo = subDays(date, 7);
  const recentMeals = await prisma.mealPlan.findMany({
    where: {
      familyId,
      date: { gte: sevenDaysAgo, lte: date },
    },
    include: { dish: true },
  });

  // Get meal plans for the current week for balance rule
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  const weeklyMeals = await prisma.mealPlan.findMany({
    where: {
      familyId,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: { dish: true },
  });

  // Get all-time usage for frequency-based prioritization
  const allMeals = await prisma.mealPlan.findMany({
    where: { familyId },
    include: { dish: true },
  });

  // Calculate usage statistics for each dish
  const dishUsage = new Map<string, { count: number; lastUsed?: Date }>();

  for (const dish of dishes) {
    dishUsage.set(dish.id, { count: 0 });
  }

  for (const meal of allMeals) {
    const usage = dishUsage.get(meal.dishId);
    if (usage) {
      usage.count++;
      if (!usage.lastUsed || new Date(meal.date) > usage.lastUsed) {
        usage.lastUsed = new Date(meal.date);
      }
    }
  }

  // Count recent dish usage (last 7 days)
  const recentDishIds = new Set(recentMeals.map(m => m.dishId));

  // Count weekly category usage
  const weeklyCategoryCount = new Map<DishCategory, Map<string, number>>();
  for (const category of ['primo', 'secondo', 'contorno'] as DishCategory[]) {
    weeklyCategoryCount.set(category, new Map());
  }

  for (const meal of weeklyMeals) {
    const categoryMap = weeklyCategoryCount.get(meal.dish.category);
    if (categoryMap) {
      const count = categoryMap.get(meal.dishId) || 0;
      categoryMap.set(meal.dishId, count + 1);
    }
  }

  // Determine which categories to suggest based on meal type
  const categoriesForMeal: DishCategory[] =
    mealType === 'pranzo'
      ? ['primo', 'secondo', 'contorno']
      : ['secondo', 'contorno'];

  // Score each dish
  const scoredDishes: SuggestionResult[] = [];

  for (const dish of dishes) {
    // Skip if not in the required categories for this meal type
    if (!categoriesForMeal.includes(dish.category)) {
      continue;
    }

    let score = 100;
    let reason = '';

    // Rule 1: Anti-repetition (skip if used in last 7 days)
    if (recentDishIds.has(dish.id)) {
      score -= 80;
      reason = 'Consumato di recente';
    }

    // Rule 2: Weekly balance (max 2 times per week for same category dish)
    const categoryMap = weeklyCategoryCount.get(dish.category);
    const weeklyCount = categoryMap?.get(dish.id) || 0;
    if (weeklyCount >= 2) {
      score -= 50;
      reason = reason || 'Già consumato 2+ volte questa settimana';
    }

    // Rule 4: Frequency-based priority (less used = higher score)
    const usage = dishUsage.get(dish.id);
    if (usage) {
      // Boost score for less frequently used dishes
      const maxCount = Math.max(...Array.from(dishUsage.values()).map(u => u.count));
      if (maxCount > 0) {
        const frequencyBonus = ((maxCount - usage.count) / maxCount) * 20;
        score += frequencyBonus;
      }
    }

    if (score > 0) {
      scoredDishes.push({
        dish: {
          id: dish.id,
          name: dish.name,
          category: dish.category,
        },
        score,
        reason: reason || 'Buona scelta',
      });
    }
  }

  // Sort by score descending and return top suggestions per category
  scoredDishes.sort((a, b) => b.score - a.score);

  // Group by category and return top 2 per category
  const resultByCategory = new Map<string, SuggestionResult[]>();

  for (const suggestion of scoredDishes) {
    const category = suggestion.dish.category;
    if (!resultByCategory.has(category)) {
      resultByCategory.set(category, []);
    }
    const categoryResults = resultByCategory.get(category)!;
    if (categoryResults.length < 3) {
      categoryResults.push(suggestion);
    }
  }

  // Flatten and return
  const result: SuggestionResult[] = [];
  for (const category of categoriesForMeal) {
    const suggestions = resultByCategory.get(category) || [];
    result.push(...suggestions);
  }

  return result;
}
