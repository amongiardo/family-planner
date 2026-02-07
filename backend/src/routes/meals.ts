import { Router } from 'express';
import { DishCategory, MealType } from '@prisma/client';
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from 'date-fns';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import { parseDateOnly } from '../utils/date';

const router = Router();

// Get meals for a week
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { week } = req.query;

    if (!week || typeof week !== 'string') {
      return res.status(400).json({ error: 'Week parameter is required (YYYY-MM-DD)' });
    }

    const date = parseDateOnly(week);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    const meals = await prisma.mealPlan.findMany({
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
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });

    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// Get meals for a date range
router.get('/range', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { start, end } = req.query;

    if (!start || typeof start !== 'string' || !end || typeof end !== 'string') {
      return res.status(400).json({ error: 'Start and end parameters are required (YYYY-MM-DD)' });
    }

    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        dish: true,
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    });

    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// Get meals for a specific date
router.get('/date/:date', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr } = req.params;

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const meals = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date,
      },
      include: {
        dish: true,
      },
      orderBy: { mealType: 'asc' },
    });

    res.json(meals);
  } catch (error) {
    next(error);
  }
});

// Create meal plan
router.post('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { date: dateStr, mealType, slotCategory, dishId, isSuggestion } = req.body;

    if (!dateStr || typeof dateStr !== 'string') {
      return res.status(400).json({ error: 'Date is required' });
    }

    const date = parseDateOnly(dateStr);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (!mealType || !['pranzo', 'cena'].includes(mealType)) {
      return res.status(400).json({ error: 'Valid meal type is required (pranzo or cena)' });
    }

    if (!slotCategory || !['primo', 'secondo', 'contorno'].includes(slotCategory)) {
      return res.status(400).json({ error: 'Valid slot category is required (primo, secondo, contorno)' });
    }

    if (!dishId || typeof dishId !== 'string') {
      return res.status(400).json({ error: 'Dish ID is required' });
    }

    // Verify dish belongs to family
    const dish = await prisma.dish.findFirst({
      where: { id: dishId, familyId },
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    if (dish.category !== slotCategory) {
      return res.status(400).json({ error: 'Dish category does not match slot category' });
    }

    const existingMeal = await prisma.mealPlan.findFirst({
      where: {
        familyId,
        date,
        mealType: mealType as MealType,
        slotCategory: slotCategory as DishCategory,
      },
      include: {
        dish: true,
      },
    });

    if (existingMeal) {
      return res.status(200).json(existingMeal);
    }

    const meal = await prisma.mealPlan.create({
      data: {
        familyId,
        date,
        mealType: mealType as MealType,
        slotCategory: slotCategory as DishCategory,
        dishId,
        isSuggestion: Boolean(isSuggestion),
      },
      include: {
        dish: true,
      },
    });

    res.status(201).json(meal);
  } catch (error) {
    next(error);
  }
});

// Update meal plan
router.put('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;
    const { date: dateStr, mealType, slotCategory, dishId } = req.body;

    // Verify meal belongs to family
    const existing = await prisma.mealPlan.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    const updateData: any = {};

    if (dateStr) {
      const date = parseDateOnly(dateStr);
      if (!date) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      updateData.date = date;
    }

    if (mealType && ['pranzo', 'cena'].includes(mealType)) {
      updateData.mealType = mealType as MealType;
    }

    if (slotCategory && ['primo', 'secondo', 'contorno'].includes(slotCategory)) {
      updateData.slotCategory = slotCategory as DishCategory;
    }

    if (updateData.slotCategory && !dishId) {
      const existingDish = await prisma.dish.findFirst({
        where: { id: existing.dishId, familyId },
      });
      if (existingDish && existingDish.category !== updateData.slotCategory) {
        return res.status(400).json({ error: 'Dish category does not match slot category' });
      }
    }

    if (dishId) {
      // Verify dish belongs to family
      const dish = await prisma.dish.findFirst({
        where: { id: dishId, familyId },
      });

      if (!dish) {
        return res.status(404).json({ error: 'Dish not found' });
      }

      if (updateData.slotCategory && dish.category !== updateData.slotCategory) {
        return res.status(400).json({ error: 'Dish category does not match slot category' });
      }

      if (!updateData.slotCategory && dish.category !== existing.slotCategory) {
        return res.status(400).json({ error: 'Dish category does not match slot category' });
      }

      updateData.dishId = dishId;
    }

    const nextDate = updateData.date ?? existing.date;
    const nextMealType = updateData.mealType ?? existing.mealType;
    const nextSlotCategory = updateData.slotCategory ?? existing.slotCategory;

    const slotTaken = await prisma.mealPlan.findFirst({
      where: {
        familyId,
        date: nextDate,
        mealType: nextMealType,
        slotCategory: nextSlotCategory,
        NOT: { id },
      },
    });

    if (slotTaken) {
      return res.status(409).json({ error: 'Slot già occupato per questa data' });
    }

    const meal = await prisma.mealPlan.update({
      where: { id },
      data: updateData,
      include: {
        dish: true,
      },
    });

    res.json(meal);
  } catch (error) {
    next(error);
  }
});

// Auto schedule meals for a date range (only empty slots)
router.post('/auto-schedule', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { rangeType, slots } = req.body as {
      rangeType?: string;
      slots?: { pranzo?: DishCategory[]; cena?: DishCategory[] };
    };

    const today = parseDateOnly(new Date().toISOString().slice(0, 10))!;
    let start: Date;
    let end: Date;

    switch (rangeType) {
      case 'last_week': {
        const base = subWeeks(today, 1);
        start = startOfWeek(base, { weekStartsOn: 1 });
        end = endOfWeek(base, { weekStartsOn: 1 });
        break;
      }
      case 'next_week': {
        const base = addWeeks(today, 1);
        start = startOfWeek(base, { weekStartsOn: 1 });
        end = endOfWeek(base, { weekStartsOn: 1 });
        break;
      }
      case 'this_month': {
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      }
      case 'last_month': {
        const base = subMonths(today, 1);
        start = startOfMonth(base);
        end = endOfMonth(base);
        break;
      }
      case 'next_month': {
        const base = addMonths(today, 1);
        start = startOfMonth(base);
        end = endOfMonth(base);
        break;
      }
      case 'last_7_days': {
        start = subDays(today, 6);
        end = today;
        break;
      }
      case 'next_7_days': {
        start = today;
        end = addDays(today, 6);
        break;
      }
      case 'workweek': {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = addDays(start, 4);
        break;
      }
      case 'this_week':
      default: {
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      }
    }

    const dishes = await prisma.dish.findMany({ where: { familyId } });
    if (dishes.length === 0) {
      return res.status(400).json({ error: 'Nessun piatto disponibile. Inserisci o importa i piatti.' });
    }

    const dishesByCategory = {
      primo: dishes.filter((d) => d.category === 'primo'),
      secondo: dishes.filter((d) => d.category === 'secondo'),
      contorno: dishes.filter((d) => d.category === 'contorno'),
    };

    const slotsByMeal = {
      pranzo: (slots?.pranzo?.length ? slots.pranzo : ['primo', 'secondo', 'contorno']) as DishCategory[],
      cena: (slots?.cena?.length ? slots.cena : ['primo', 'secondo', 'contorno']) as DishCategory[],
    };

    const existing = await prisma.mealPlan.findMany({
      where: {
        familyId,
        date: { gte: start, lte: end },
      },
    });

    const existingKey = new Set(existing.map((m) => `${m.date.toISOString().slice(0, 10)}|${m.mealType}|${m.slotCategory}`));

    const lastUsed = new Map<string, string>();
    const indexByKey = new Map<string, number>();

    const created: number = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const dateKey = d.toISOString().slice(0, 10);
        for (const mealType of ['pranzo', 'cena'] as MealType[]) {
          const slotList = slotsByMeal[mealType];
          for (const slotCategory of slotList) {
            const key = `${dateKey}|${mealType}|${slotCategory}`;
            if (existingKey.has(key)) continue;

            const list = dishesByCategory[slotCategory];
            if (list.length === 0) continue;

            const cycleKey = `${mealType}|${slotCategory}`;
            let idx = indexByKey.get(cycleKey) ?? 0;
            let dish = list[idx % list.length];

            if (list.length > 1) {
              const last = lastUsed.get(cycleKey);
              if (dish.id === last) {
                idx += 1;
                dish = list[idx % list.length];
              }
            }

            indexByKey.set(cycleKey, idx + 1);
            lastUsed.set(cycleKey, dish.id);

            await tx.mealPlan.create({
              data: {
                familyId,
                date: d,
                mealType,
                slotCategory,
                dishId: dish.id,
              },
            });
            count += 1;
          }
        }
      }
      return count;
    });

    res.json({ success: true, created });
  } catch (error) {
    next(error);
  }
});

// Delete meal plan
router.delete('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    // Verify meal belongs to family
    const existing = await prisma.mealPlan.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    await prisma.mealPlan.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
