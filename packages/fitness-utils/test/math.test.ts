import { describe, it, expect } from 'vitest';
import {
  calcBMI,
  bmiCategory,
  netCalories,
  macroPercentages,
  metCaloriesBurned,
} from '../src/math';

describe('fitness-utils: math', () => {
  describe('calcBMI & bmiCategory', () => {
    it('calculates BMI accurately', () => {
      // 70kg, 175cm => 70 / (1.75 * 1.75) = 22.857... => 22.9
      expect(calcBMI(70, 175)).toBe(22.9);
      // 90kg, 180cm => 90 / (1.8 * 1.8) = 27.777... => 27.8
      expect(calcBMI(90, 180)).toBe(27.8);
      // handles 0 gracefully
      expect(calcBMI(0, 175)).toBe(0);
      expect(calcBMI(70, 0)).toBe(0);
    });

    it('categorizes BMI correctly', () => {
      expect(bmiCategory(17.5)).toBe('Underweight');
      expect(bmiCategory(18.5)).toBe('Normal');
      expect(bmiCategory(24.9)).toBe('Normal');
      expect(bmiCategory(25.0)).toBe('Overweight');
      expect(bmiCategory(29.9)).toBe('Overweight');
      expect(bmiCategory(30.0)).toBe('Obese');
      expect(bmiCategory(35.2)).toBe('Obese');
    });
  });

  describe('netCalories', () => {
    it('subtracts burned from consumed', () => {
      expect(netCalories(2500, 500)).toBe(2000);
      expect(netCalories(1800, 2200)).toBe(-400);
      expect(netCalories(0, 0)).toBe(0);
    });
  });

  describe('macroPercentages', () => {
    it('calculates 40/30/30 calorie splits accurately', () => {
      // 200g carb (800kcal), 150g protein (600kcal), 67g fat (603kcal) => ~2000kcal
      const { carbsPct, proteinPct, fatPct } = macroPercentages(200, 150, 67);
      expect(carbsPct + proteinPct + fatPct).toBeGreaterThanOrEqual(99);
      expect(carbsPct + proteinPct + fatPct).toBeLessThanOrEqual(101);
      expect(carbsPct).toBe(40);
      expect(proteinPct).toBe(30);
      expect(fatPct).toBe(30);
    });

    it('returns zeroes when total calories is zero', () => {
      expect(macroPercentages(0, 0, 0)).toEqual({
        carbsPct: 0,
        proteinPct: 0,
        fatPct: 0,
      });
    });
  });

  describe('metCaloriesBurned', () => {
    it('calculates calories burned based on MET standards', () => {
      // Running 8 MET, 70kg, 30 min (0.5 hour) => 8 * 70 * 0.5 = 280 kcal
      expect(metCaloriesBurned(8, 70, 30)).toBe(280);
      // Walking 3.5 MET, 80kg, 60 min (1 hour) => 3.5 * 80 * 1 = 280 kcal
      expect(metCaloriesBurned(3.5, 80, 60)).toBe(280);
    });
  });
});
