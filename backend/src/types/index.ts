import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface User extends import('@prisma/client').User {}
  }
}

export interface ShoppingListItem {
  id: string;
  ingredient: string;
  quantity?: string;
  checked: boolean;
  dishNames: string[];
}

export interface SuggestionParams {
  date: string;
  mealType: 'pranzo' | 'cena';
}

export interface SuggestionResult {
  dish: {
    id: string;
    name: string;
    category: string;
  };
  score: number;
  reason: string;
}
