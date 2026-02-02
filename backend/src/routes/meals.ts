import { Router } from 'express';
import { MealType } from '@prisma/client';
import { startOfWeek, endOfWeek } from 'date-fns';
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
    const { date: dateStr, mealType, dishId, isSuggestion } = req.body;

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

    const existingMeal = await prisma.mealPlan.findFirst({
      where: {
        familyId,
        date,
        mealType: mealType as MealType,
        dishId,
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
    const { date: dateStr, mealType, dishId } = req.body;

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

    if (dishId) {
      // Verify dish belongs to family
      const dish = await prisma.dish.findFirst({
        where: { id: dishId, familyId },
      });

      if (!dish) {
        return res.status(404).json({ error: 'Dish not found' });
      }

      updateData.dishId = dishId;
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
