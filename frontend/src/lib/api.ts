import { Dish, Family, MealPlan, ShoppingList, Suggestion, User, FamilyInvite } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth
export const authApi = {
  getMe: () => fetchApi<{ user: User | null }>('/auth/me'),
  logout: () => fetchApi<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  getGoogleLoginUrl: () => `${API_URL}/auth/google`,
  getGithubLoginUrl: () => `${API_URL}/auth/github`,
  loginLocal: (data: { email: string; password: string }) =>
    fetchApi<{ user: User }>('/auth/local/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  registerLocal: (data: { email: string; password: string; name: string; inviteToken?: string }) =>
    fetchApi<{ user: User }>('/auth/local/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Family
export const familyApi = {
  get: () => fetchApi<Family>('/api/family'),
  update: (data: { name?: string; city?: string }) => fetchApi<Family>('/api/family', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  invite: (email: string) => fetchApi<{ invite: FamilyInvite }>('/api/family/invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  getInvites: () => fetchApi<FamilyInvite[]>('/api/family/invites'),
  deleteInvite: (id: string) => fetchApi<{ success: boolean }>(`/api/family/invites/${id}`, {
    method: 'DELETE',
  }),
  validateInvite: (token: string) => fetchApi<{ email: string; family: { id: string; name: string } }>(`/api/family/invite/${token}`),
};

// Weather
export const weatherApi = {
  get: (city?: string) =>
    fetchApi<{ city: string; temperature?: number; description?: string }>(
      `/api/weather${city ? `?city=${encodeURIComponent(city)}` : ''}`
    ),
};

// Stats
export const statsApi = {
  meals: (range: 'week' | 'month') =>
    fetchApi<{
      range: 'week' | 'month';
      start: string;
      end: string;
      frequent: { dishId: string; name: string; category: string; count: number }[];
      notEaten: { dishId: string; name: string; category: string }[];
    }>(`/api/stats/meals?range=${range}`),
};

// Dishes
export const dishesApi = {
  list: (params?: { category?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return fetchApi<Dish[]>(`/api/dishes${query ? `?${query}` : ''}`);
  },
  get: (id: string) => fetchApi<Dish>(`/api/dishes/${id}`),
  create: (data: { name: string; category: string; ingredients: string[] }) =>
    fetchApi<Dish>('/api/dishes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<{ name: string; category: string; ingredients: string[] }>) =>
    fetchApi<Dish>(`/api/dishes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<{ success: boolean }>(`/api/dishes/${id}`, {
    method: 'DELETE',
  }),
  exportCsv: () => fetchApi<{ csv: string }>('/api/dishes/export'),
  deleteAll: () => fetchApi<{ success: boolean; deletedMeals: number; deletedDishes: number }>(
    '/api/dishes/all',
    { method: 'DELETE' }
  ),
};

// Meals
export const mealsApi = {
  getWeek: (week: string) => fetchApi<MealPlan[]>(`/api/meals?week=${week}`),
  getRange: (start: string, end: string) =>
    fetchApi<MealPlan[]>(`/api/meals/range?start=${start}&end=${end}`),
  getDate: (date: string) => fetchApi<MealPlan[]>(`/api/meals/date/${date}`),
  create: (data: { date: string; mealType: string; slotCategory: string; dishId: string; isSuggestion?: boolean }) =>
    fetchApi<MealPlan>('/api/meals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<{ date: string; mealType: string; slotCategory: string; dishId: string }>) =>
    fetchApi<MealPlan>(`/api/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<{ success: boolean }>(`/api/meals/${id}`, {
    method: 'DELETE',
  }),
  clearAll: () => fetchApi<{ success: boolean; deleted: number }>('/api/meals', {
    method: 'DELETE',
  }),
  clearRange: (data: { rangeType: string }) =>
    fetchApi<{ success: boolean; deleted: number }>('/api/meals/clear-range', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  autoSchedule: (data: { rangeType: string; slots?: { pranzo?: string[]; cena?: string[] } }) =>
    fetchApi<{ success: boolean; created: number }>('/api/meals/auto-schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Suggestions
export const suggestionsApi = {
  get: (date: string, meal: string, category: string) =>
    fetchApi<Suggestion[]>(`/api/suggestions?date=${date}&meal=${meal}&category=${category}`),
  accept: (data: { date: string; mealType: string; slotCategory: string; dishId: string }) =>
    fetchApi<MealPlan>('/api/suggestions/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Shopping
export const shoppingApi = {
  get: (week: string) => fetchApi<ShoppingList>(`/api/shopping?week=${week}`),
  addItem: (data: { week: string; ingredient: string; quantity?: string }) =>
    fetchApi<{ id: string; ingredient: string; quantity?: string; checked: boolean; dishNames: string[] }>(
      '/api/shopping/items',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  checkItem: (itemId: string, week: string, checked: boolean) =>
    fetchApi<{ id: string; checked: boolean }>(`/api/shopping/${itemId}/check`, {
      method: 'PUT',
      body: JSON.stringify({ week, checked }),
    }),
  removeItem: (itemId: string, week: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping/items/${itemId}?week=${week}`, {
      method: 'DELETE',
    }),
  clear: (week: string) =>
    fetchApi<{ success: boolean }>(`/api/shopping?week=${week}`, { method: 'DELETE' }),
  clearAll: () => fetchApi<{ success: boolean }>(`/api/shopping/all`, { method: 'DELETE' }),
  clearPurchased: () =>
    fetchApi<{ success: boolean }>(`/api/shopping/purchased`, { method: 'DELETE' }),
  clearPending: () =>
    fetchApi<{ success: boolean }>(`/api/shopping/pending`, { method: 'DELETE' }),
};
