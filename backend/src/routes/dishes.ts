import { Router } from 'express';
import { DishCategory } from '@prisma/client';
import prisma from '../prisma';
import { isAuthenticated, getFamilyId } from '../middleware/auth';

const router = Router();

// Get all dishes for family
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { category, search } = req.query;

    const where: any = { familyId };

    if (category && ['primo', 'secondo', 'contorno'].includes(category as string)) {
      where.category = category as DishCategory;
    }

    if (search && typeof search === 'string') {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const dishes = await prisma.dish.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(dishes);
  } catch (error) {
    next(error);
  }
});

// Get single dish
router.get('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    const dish = await prisma.dish.findFirst({
      where: { id, familyId },
    });

    if (!dish) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    res.json(dish);
  } catch (error) {
    next(error);
  }
});

// Create dish
router.post('/', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { name, category, ingredients } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!category || !['primo', 'secondo', 'contorno'].includes(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    const dish = await prisma.dish.create({
      data: {
        familyId,
        name: name.trim(),
        category: category as DishCategory,
        ingredients: Array.isArray(ingredients) ? ingredients : [],
      },
    });

    res.status(201).json(dish);
  } catch (error) {
    next(error);
  }
});

// Update dish
router.put('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;
    const { name, category, ingredients } = req.body;

    // Verify dish belongs to family
    const existing = await prisma.dish.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const updateData: any = {};

    if (name && typeof name === 'string') {
      updateData.name = name.trim();
    }

    if (category && ['primo', 'secondo', 'contorno'].includes(category)) {
      updateData.category = category as DishCategory;
    }

    if (Array.isArray(ingredients)) {
      updateData.ingredients = ingredients;
    }

    const dish = await prisma.dish.update({
      where: { id },
      data: updateData,
    });

    res.json(dish);
  } catch (error) {
    next(error);
  }
});

// Delete dish
router.delete('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { id } = req.params;

    // Verify dish belongs to family
    const existing = await prisma.dish.findFirst({
      where: { id, familyId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    // Check if dish is used in meal plans
    const usedInMeals = await prisma.mealPlan.findFirst({
      where: { dishId: id },
    });

    if (usedInMeals) {
      return res.status(400).json({
        error: 'Cannot delete dish that is used in meal plans',
      });
    }

    await prisma.dish.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
