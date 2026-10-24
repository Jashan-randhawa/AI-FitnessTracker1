/**
 * Resolves a date string from a log entry falling back to createdAt or current ISO time.
 */
export const resolveDate = (entry?: any): string => {
  return entry?.date ?? entry?.createdAt ?? new Date().toISOString();
};
