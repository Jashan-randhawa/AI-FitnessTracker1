import { CSVExportOptions } from './types';

/**
 * Escapes a cell value according to RFC 4180 standard.
 */
export const escapeCsvCell = (val: unknown): string => {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
};

/**
 * Formats tabular data into an RFC 4180-compliant CSV string.
 */
export function toCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  options: CSVExportOptions = {}
): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  const csvContent = [headerLine, ...rowLines].join('\r\n');

  if (options.download && typeof window !== 'undefined' && typeof document !== 'undefined') {
    downloadCSV(csvContent, options.filename || 'export.csv');
  }

  return csvContent;
}

/**
 * Initiates client-side CSV file download using modern Blob and ObjectURL.
 */
export function downloadCSV(csvContent: string, filename = 'export.csv'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports nutrition food logs and activity logs to standard CSV.
 */
export function exportFitnessLogsToCSV(
  foodLogs: any[],
  activityLogs: any[],
  options: CSVExportOptions = {}
): string {
  const lines: string[] = [];

  // Food section
  lines.push('--- FOOD LOGS ---');
  const foodHeaders = ['Date', 'Meal Type', 'Food Name', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)'];
  lines.push(foodHeaders.map(escapeCsvCell).join(','));

  foodLogs.forEach((l) => {
    const d = l.date || l.createdAt ? new Date(l.date || l.createdAt).toISOString().slice(0, 10) : '';
    const row = [
      d,
      l.mealType || '',
      l.name || l.foodName || '',
      l.calories ?? 0,
      l.protein ?? 0,
      l.carbs ?? 0,
      l.fat ?? 0,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });

  lines.push('');
  // Activity section
  lines.push('--- ACTIVITY LOGS ---');
  const actHeaders = ['Date', 'Activity Name', 'Duration (min)', 'Calories Burned'];
  lines.push(actHeaders.map(escapeCsvCell).join(','));

  activityLogs.forEach((l) => {
    const d = l.date || l.createdAt ? new Date(l.date || l.createdAt).toISOString().slice(0, 10) : '';
    const row = [
      d,
      l.name || l.type || '',
      l.duration ?? 0,
      l.calories ?? l.caloriesBurned ?? 0,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });

  const fullContent = lines.join('\r\n');
  if (options.download && typeof window !== 'undefined') {
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(fullContent, options.filename || `fittrack-export-${dateStr}.csv`);
  }

  return fullContent;
}
