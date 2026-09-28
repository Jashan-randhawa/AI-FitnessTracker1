import { describe, it, expect } from 'vitest';
import { toCSV, escapeCsvCell, exportFitnessLogsToCSV } from '../src/csv';

describe('fitness-utils: CSV', () => {
  it('escapes cells containing double quotes and commas', () => {
    expect(escapeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
    expect(escapeCsvCell('apples, oranges')).toBe('"apples, oranges"');
    expect(escapeCsvCell(123)).toBe('"123"');
    expect(escapeCsvCell(null)).toBe('""');
  });

  it('generates standard RFC 4180 CSV table', () => {
    const headers = ['Name', 'Calories', 'Notes'];
    const rows = [
      ['Oatmeal', 300, 'With blueberries, honey'],
      ['"Special" Shake', 450, 'Protein'],
    ];

    const csv = toCSV(headers, rows);
    expect(csv).toContain('"Name","Calories","Notes"');
    expect(csv).toContain('"Oatmeal","300","With blueberries, honey"');
    expect(csv).toContain('"""Special"" Shake","450","Protein"');
  });

  it('formats food and activity logs properly', () => {
    const foodLogs = [
      { date: '2026-06-01', mealType: 'Breakfast', name: 'Eggs', calories: 280, protein: 20, carbs: 2, fat: 18 },
    ];
    const actLogs = [
      { date: '2026-06-01', name: 'Jogging', duration: 30, caloriesBurned: 250 },
    ];

    const csv = exportFitnessLogsToCSV(foodLogs, actLogs);
    expect(csv).toContain('--- FOOD LOGS ---');
    expect(csv).toContain('--- ACTIVITY LOGS ---');
    expect(csv).toContain('"Eggs"');
    expect(csv).toContain('"Jogging"');
  });
});
