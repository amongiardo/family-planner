import { startOfWeek, endOfWeek } from 'date-fns';
import prisma from '../prisma';
import { ShoppingListItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function generateShoppingList(
  familyId: string,
  weekStart: Date
): Promise<ShoppingListItem[]> {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Get all meal plans for the week
  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      familyId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      dish: true,
    },
  });

  // Aggregate ingredients
  const ingredientMap = new Map<string, { quantity: string; dishNames: Set<string> }>();

  for (const meal of mealPlans) {
    for (const ingredient of meal.dish.ingredients) {
      // Parse ingredient (format: "ingredient" or "quantity ingredient")
      const existing = ingredientMap.get(ingredient.toLowerCase());
      if (existing) {
        existing.dishNames.add(meal.dish.name);
      } else {
        ingredientMap.set(ingredient.toLowerCase(), {
          quantity: '',
          dishNames: new Set([meal.dish.name]),
        });
      }
    }
  }

  // Convert to ShoppingListItem array
  const items: ShoppingListItem[] = [];
  for (const [ingredient, data] of ingredientMap) {
    items.push({
      id: uuidv4(),
      ingredient: ingredient.charAt(0).toUpperCase() + ingredient.slice(1),
      quantity: data.quantity,
      checked: false,
      dishNames: Array.from(data.dishNames),
    });
  }

  // Sort alphabetically
  items.sort((a, b) => a.ingredient.localeCompare(b.ingredient));

  return items;
}

export async function getOrCreateShoppingList(familyId: string, weekStart: Date) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });

  let shoppingList = await prisma.shoppingList.findUnique({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
  });

  if (!shoppingList) {
    const items = await generateShoppingList(familyId, normalizedWeekStart);
    shoppingList = await prisma.shoppingList.create({
      data: {
        familyId,
        weekStart: normalizedWeekStart,
        items: JSON.stringify(items),
      },
    });
  }

  return {
    ...shoppingList,
    items: JSON.parse(shoppingList.items as string) as ShoppingListItem[],
  };
}

export async function regenerateShoppingList(familyId: string, weekStart: Date) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const items = await generateShoppingList(familyId, normalizedWeekStart);

  const shoppingList = await prisma.shoppingList.upsert({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
    update: {
      items: JSON.stringify(items),
    },
    create: {
      familyId,
      weekStart: normalizedWeekStart,
      items: JSON.stringify(items),
    },
  });

  return {
    ...shoppingList,
    items,
  };
}

export async function updateItemCheckStatus(
  familyId: string,
  weekStart: Date,
  itemId: string,
  checked: boolean
) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });

  const shoppingList = await prisma.shoppingList.findUnique({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
  });

  if (!shoppingList) {
    throw new Error('Shopping list not found');
  }

  const items = JSON.parse(shoppingList.items as string) as ShoppingListItem[];
  const itemIndex = items.findIndex(item => item.id === itemId);

  if (itemIndex === -1) {
    throw new Error('Item not found');
  }

  items[itemIndex].checked = checked;

  await prisma.shoppingList.update({
    where: {
      familyId_weekStart: {
        familyId,
        weekStart: normalizedWeekStart,
      },
    },
    data: {
      items: JSON.stringify(items),
    },
  });

  return items[itemIndex];
}
