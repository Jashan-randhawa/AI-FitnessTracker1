import { BmiCategory, MacroPercentages } from './types';

/**
 * Calculates Body Mass Index (BMI).
 * Formula: weight (kg) / (height (m) ^ 2)
 */
export function calcBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return 0;
  const h = heightCm / 100;
  return parseFloat((weightKg / (h * h)).toFixed(1));
}

/**
 * Categorizes a numeric BMI score according to WHO standards.
 */
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/**
 * Calculates net calorie balance (consumed - burned).
 */
export function netCalories(consumed: number, burned: number): number {
  return (consumed || 0) - (burned || 0);
}

/**
 * Calculates macronutrient caloric distribution percentages.
 * 1g Carb = 4 kcal, 1g Protein = 4 kcal, 1g Fat = 9 kcal.
 */
export function macroPercentages(
  carbsG: number,
  proteinG: number,
  fatG: number
): MacroPercentages {
  const carbKcal = (carbsG || 0) * 4;
  const proteinKcal = (proteinG || 0) * 4;
  const fatKcal = (fatG || 0) * 9;
  const totalKcal = carbKcal + proteinKcal + fatKcal;

  if (totalKcal <= 0) {
    return { carbsPct: 0, proteinPct: 0, fatPct: 0 };
  }

  return {
    carbsPct: Math.round((carbKcal / totalKcal) * 100),
    proteinPct: Math.round((proteinKcal / totalKcal) * 100),
    fatPct: Math.round((fatKcal / totalKcal) * 100),
  };
}

/**
 * Computes estimated calories burned using MET (Metabolic Equivalent of Task).
 * Formula: MET * Weight (kg) * Time (hours)
 */
export function metCaloriesBurned(
  met: number,
  weightKg: number,
  durationMinutes: number
): number {
  if (!met || !weightKg || !durationMinutes) return 0;
  return Math.round(met * weightKg * (durationMinutes / 60));
}
