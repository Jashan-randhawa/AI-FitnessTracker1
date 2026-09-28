import { describe, it, expect, vi } from 'vitest';
import { createEstimator } from '../src/estimator';

describe('ai-nutrition-estimator', () => {
  it('estimates activity calories and caches results', async () => {
    let callCount = 0;
    const mockChat = vi.fn().mockImplementation(async () => {
      callCount++;
      return JSON.stringify({
        activity: 'Running',
        met_value: 9.8,
        intensity: 'high',
        suggestion: 'Stay hydrated with electrolytes.',
      });
    });

    const est = createEstimator({ chat: mockChat });

    // 70 kg, 30 min (0.5 hr) => 9.8 * 70 * 0.5 = 343 kcal
    const res = await est.activity({ name: 'Running', minutes: 30, weightKg: 70 });

    expect(callCount).toBe(1);
    expect(res.activity).toBe('Running');
    expect(res.calories_burned).toBe(343);
    expect(res.intensity).toBe('high');
    expect(res.disclaimer).toBeDefined();

    // Second call with same parameters should hit cache and NOT invoke chat again
    const cachedRes = await est.activity({ name: 'Running', minutes: 30, weightKg: 70 });
    expect(callCount).toBe(1);
    expect(cachedRes.calories_burned).toBe(343);
  });

  it('handles markdown code fences in food estimates', async () => {
    const mockChat = vi.fn().mockResolvedValue(`
\`\`\`json
{
  "name": "Grilled Salmon with Asparagus",
  "calories": 480,
  "protein": 42.5,
  "carbs": 8.0,
  "fat": 28.3
}
\`\`\`
`);

    const est = createEstimator({ chat: mockChat });
    const res = await est.foodFromText('Grilled salmon with asparagus');

    expect(res.name).toBe('Grilled Salmon with Asparagus');
    expect(res.calories).toBe(480);
    expect(res.protein).toBe(42.5);
    expect(res.carbs).toBe(8);
    expect(res.fat).toBe(28.3);
  });

  it('extracts food from image base64 input', async () => {
    const mockChat = vi.fn().mockResolvedValue(
      JSON.stringify({
        name: 'Avocado Toast with Poached Egg',
        calories: 360,
        protein: 15,
        carbs: 28,
        fat: 22,
      })
    );

    const est = createEstimator({ chat: mockChat });
    const res = await est.foodFromImage({
      base64: 'fake-image-bytes',
      mimeType: 'image/jpeg',
    });

    expect(res.name).toBe('Avocado Toast with Poached Egg');
    expect(res.calories).toBe(360);
    expect(res.protein).toBe(15);
  });

  it('rejects invalid or unreadable JSON', async () => {
    const mockChat = vi.fn().mockResolvedValue('Sorry, I am not sure what that is.');
    const est = createEstimator({ chat: mockChat });

    await expect(est.foodFromText('Unknown alien fruit')).rejects.toThrow();
  });
});
