import { Router } from 'express';
import { isAuthenticated, getFamilyId } from '../middleware/auth';
import {
  getOrCreateShoppingList,
  addShoppingItem,
  updateItemCheckStatus,
} from '../services/shoppingList';
import { parseDateOnly } from '../utils/date';

const router = Router();

// Get shopping list for a week
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

    const shoppingList = await getOrCreateShoppingList(familyId, date);

    res.json(shoppingList);
  } catch (error) {
    next(error);
  }
});

// Add item manually
router.post('/items', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { week, ingredient, quantity } = req.body ?? {};

    if (!week || typeof week !== 'string') {
      return res.status(400).json({ error: 'Week parameter is required (YYYY-MM-DD)' });
    }

    const date = parseDateOnly(week);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (!ingredient || typeof ingredient !== 'string') {
      return res.status(400).json({ error: 'Ingredient is required' });
    }

    const item = await addShoppingItem(familyId, date, ingredient, quantity);

    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Toggle item check status
router.put('/:itemId/check', isAuthenticated, async (req, res, next) => {
  try {
    const familyId = getFamilyId(req);
    const { itemId } = req.params;
    const { week, checked } = req.body;

    if (!week || typeof week !== 'string') {
      return res.status(400).json({ error: 'Week parameter is required' });
    }

    const date = parseDateOnly(week);
    if (!date) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (typeof checked !== 'boolean') {
      return res.status(400).json({ error: 'Checked status is required' });
    }

    const item = await updateItemCheckStatus(familyId, date, itemId, checked);

    res.json(item);
  } catch (error) {
    next(error);
  }
});

export default router;
