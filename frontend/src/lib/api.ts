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
  getMe: () => fetchApi<{ user: User }>('/auth/me'),
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
  update: (name: string) => fetchApi<Family>('/api/family', {
    method: 'PUT',
    body: JSON.stringify({ name }),
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
};

// Meals
export const mealsApi = {
  getWeek: (week: string) => fetchApi<MealPlan[]>(`/api/meals?week=${week}`),
  getDate: (date: string) => fetchApi<MealPlan[]>(`/api/meals/date/${date}`),
  create: (data: { date: string; mealType: string; dishId: string; isSuggestion?: boolean }) =>
    fetchApi<MealPlan>('/api/meals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<{ date: string; mealType: string; dishId: string }>) =>
    fetchApi<MealPlan>(`/api/meals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => fetchApi<{ success: boolean }>(`/api/meals/${id}`, {
    method: 'DELETE',
  }),
};

// Suggestions
export const suggestionsApi = {
  get: (date: string, meal: string) =>
    fetchApi<Suggestion[]>(`/api/suggestions?date=${date}&meal=${meal}`),
  accept: (data: { date: string; mealType: string; dishId: string }) =>
    fetchApi<MealPlan>('/api/suggestions/accept', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Shopping
export const shoppingApi = {
  get: (week: string) => fetchApi<ShoppingList>(`/api/shopping?week=${week}`),
  regenerate: (week: string) => fetchApi<ShoppingList>('/api/shopping/regenerate', {
    method: 'POST',
    body: JSON.stringify({ week }),
  }),
  checkItem: (itemId: string, week: string, checked: boolean) =>
    fetchApi<{ id: string; checked: boolean }>(`/api/shopping/${itemId}/check`, {
      method: 'PUT',
      body: JSON.stringify({ week, checked }),
    }),
};
