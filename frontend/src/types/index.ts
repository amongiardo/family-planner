export interface User {
  id: string;
  familyId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  oauthProvider: 'google' | 'github' | 'local';
  createdAt: string;
}

export interface Family {
  id: string;
  name: string;
  city?: string;
  createdAt: string;
  users: FamilyMember[];
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export type DishCategory = 'primo' | 'secondo' | 'contorno';

export interface Dish {
  id: string;
  familyId: string;
  name: string;
  category: DishCategory;
  ingredients: string[];
  createdAt: string;
}

export type MealType = 'pranzo' | 'cena';

export interface MealPlan {
  id: string;
  familyId: string;
  date: string;
  mealType: MealType;
  dishId: string;
  dish: Dish;
  isSuggestion: boolean;
  createdAt: string;
}

export interface Suggestion {
  dish: {
    id: string;
    name: string;
    category: string;
  };
  score: number;
  reason: string;
}

export interface ShoppingListItem {
  id: string;
  ingredient: string;
  quantity?: string;
  checked: boolean;
  dishNames: string[];
}

export interface ShoppingList {
  id: string;
  familyId: string;
  weekStart: string;
  items: ShoppingListItem[];
  createdAt: string;
}

export interface FamilyInvite {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
}
