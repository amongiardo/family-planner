import { parse, isValid, format } from 'date-fns';

export function parseDateOnly(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }

  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (!isValid(parsed)) {
    return null;
  }

  if (format(parsed, 'yyyy-MM-dd') !== dateStr) {
    return null;
  }

  return parsed;
}
