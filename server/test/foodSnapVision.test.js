const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');

const {
  FoodSnapSchema,
  normalizeVisionOutput,
  setGeminiVisionMock,
  clearGeminiVisionMock,
} = require('../src/utils/gemini');
const { analyze } = require('../src/controllers/imageAnalysis.controller');
const FoodLog = require('../src/models/FoodLog');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('Phase 1: Deterministic Gemini Vision & 1-RTT AutoSave', () => {
  afterEach(() => {
    clearGeminiVisionMock();
  });

  describe('Native Gemini responseSchema & Normalizer', () => {
    it('defines strict FoodSnapSchema matching Phase 1 specifications', () => {
      assert.ok(FoodSnapSchema);
      assert.equal(FoodSnapSchema.type, 'object');
      assert.deepEqual(FoodSnapSchema.required, [
        'dishTitle',
        'totalCalories',
        'totalProtein',
        'totalCarbs',
        'totalFats',
        'overallConfidence',
        'items',
      ]);
      const itemProps = FoodSnapSchema.properties.items.items.properties;
      assert.ok(itemProps.name);
      assert.ok(itemProps.weightGrams);
      assert.ok(itemProps.calories);
      assert.ok(itemProps.protein);
      assert.ok(itemProps.carbs);
      assert.ok(itemProps.fats);
      assert.ok(itemProps.confidenceScore);
    });

    it('normalizes valid raw output into schema with multi-item breakdown', () => {
      const raw = {
        dishTitle: 'Grilled Chicken Bowl',
        totalCalories: 580,
        totalProtein: 48,
        totalCarbs: 52,
        totalFats: 16,
        overallConfidence: 0.92,
        items: [
          {
            name: 'Grilled Chicken Breast',
            weightGrams: 200,
            calories: 330,
            protein: 42,
            carbs: 0,
            fats: 7,
            confidenceScore: 0.95,
          },
          {
            name: 'Brown Rice',
            weightGrams: 150,
            calories: 180,
            protein: 4,
            carbs: 38,
            fats: 2,
            confidenceScore: 0.9,
          },
          {
            name: 'Steamed Broccoli',
            weightGrams: 100,
            calories: 70,
            protein: 2,
            carbs: 14,
            fats: 7,
            confidenceScore: 0.88,
          },
        ],
      };

      const normalized = normalizeVisionOutput(raw);
      assert.equal(normalized.dishTitle, 'Grilled Chicken Bowl');
      assert.equal(normalized.totalCalories, 580);
      assert.equal(normalized.totalProtein, 48);
      assert.equal(normalized.totalCarbs, 52);
      assert.equal(normalized.totalFats, 16);
      assert.equal(normalized.overallConfidence, 0.92);
      assert.equal(normalized.items.length, 3);
      assert.equal(normalized.items[0].name, 'Grilled Chicken Breast');
      assert.equal(normalized.items[0].weightGrams, 200);
      assert.equal(normalized.totalMacros.calories, 580);
    });

    it('clamps overallConfidence between 0 and 1 and derives missing totals from items', () => {
      const raw = {
        dishTitle: 'Salmon & Avocado',
        items: [
          {
            name: 'Salmon Fillet',
            weightGrams: 150,
            calories: 310,
            protein: 34,
            carbs: 0,
            fats: 18,
            confidenceScore: 0.85,
          },
          {
            name: 'Avocado',
            weightGrams: 80,
            calories: 130,
            protein: 1.6,
            carbs: 7,
            fats: 12,
            confidenceScore: 0.75,
          },
        ],
      };

      const normalized = normalizeVisionOutput(raw);
      assert.equal(normalized.totalCalories, 440);
      assert.equal(normalized.totalProtein, 35.6);
      assert.equal(normalized.overallConfidence, 0.8);
    });
  });

  describe('In-Memory Upload & Temp File Leaks Prevention', () => {
    it('rejects files larger than 4MB with HTTP 413', async () => {
      const req = {
        file: {
          buffer: Buffer.alloc(4.5 * 1024 * 1024),
          size: 4.5 * 1024 * 1024,
          mimetype: 'image/jpeg',
        },
        query: {},
      };
      const res = createMockRes();

      await analyze(req, res);
      assert.equal(res.statusCode, 413);
      assert.ok(res.body.error.message.includes('4MB limit'));
    });

    it('cleans up temporary disk file inside try / finally block', async () => {
      const tempFilePath = path.join(os.tmpdir(), `test-leak-${Date.now()}.jpg`);
      await fs.promises.writeFile(tempFilePath, Buffer.from('fake image content'));

      assert.equal(fs.existsSync(tempFilePath), true);

      setGeminiVisionMock(async () => {
        throw new Error('Simulated Gemini crash');
      });

      const req = {
        file: {
          path: tempFilePath,
          size: 100,
          mimetype: 'image/jpeg',
        },
        query: {},
      };
      const res = createMockRes();

      await analyze(req, res);
      assert.equal(res.statusCode, 500);

      // Verify file was unlinked and not leaked on disk
      assert.equal(fs.existsSync(tempFilePath), false);
    });
  });

  describe('Single-Roundtrip Persistence (?autoSave=true)', () => {
    const mockUser = { _id: new mongoose.Types.ObjectId() };

    beforeEach(() => {
      mongoose.connection.readyState = 0;
    });

    it('auto-saves directly to database in 1 HTTP roundtrip when confidence >= 0.75', async () => {
      let createdDoc = null;
      const originalCreate = FoodLog.create;
      FoodLog.create = async (payload) => {
        createdDoc = {
          ...payload,
          _id: new mongoose.Types.ObjectId(),
          toJSON() {
            return { id: String(this._id), ...payload };
          },
        };
        return createdDoc;
      };

      try {
        setGeminiVisionMock(async () => ({
          dishTitle: 'Oatmeal with Blueberries',
          totalCalories: 350,
          totalProtein: 12,
          totalCarbs: 58,
          totalFats: 7,
          overallConfidence: 0.94,
          items: [
            {
              name: 'Rolled Oats',
              weightGrams: 80,
              calories: 300,
              protein: 11,
              carbs: 52,
              fats: 5,
              confidenceScore: 0.96,
            },
            {
              name: 'Fresh Blueberries',
              weightGrams: 50,
              calories: 50,
              protein: 1,
              carbs: 6,
              fats: 2,
              confidenceScore: 0.92,
            },
          ],
        }));

        const req = {
          file: {
            buffer: Buffer.from('mock-1.5mb-image-bytes'),
            size: 1.5 * 1024 * 1024,
            mimetype: 'image/jpeg',
          },
          query: { autoSave: 'true' },
          user: mockUser,
          headers: {},
        };
        const res = createMockRes();

        await analyze(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.autoSaved, true);
        assert.ok(res.body.savedRecord);
        assert.equal(res.body.savedRecord.name, 'Oatmeal with Blueberries');
        assert.equal(res.body.savedRecord.calories, 350);
        assert.equal(res.body.analysis.totalCalories, 350);
        assert.equal(res.body.analysis.overallConfidence, 0.94);
        assert.ok(createdDoc);
      } finally {
        FoodLog.create = originalCreate;
      }
    });

    it('does NOT auto-save when overallConfidence < 0.75, returning autoSaved: false', async () => {
      let createCalled = false;
      const originalCreate = FoodLog.create;
      FoodLog.create = async () => {
        createCalled = true;
      };

      try {
        setGeminiVisionMock(async () => ({
          dishTitle: 'Mystery Curry Bowl',
          totalCalories: 620,
          totalProtein: 25,
          totalCarbs: 60,
          totalFats: 28,
          overallConfidence: 0.62, // Below 0.75 threshold
          items: [
            {
              name: 'Curry Sauce & Meat',
              weightGrams: 300,
              calories: 620,
              protein: 25,
              carbs: 60,
              fats: 28,
              confidenceScore: 0.62,
            },
          ],
        }));

        const req = {
          file: {
            buffer: Buffer.from('mock-image-bytes'),
            size: 500 * 1024,
            mimetype: 'image/jpeg',
          },
          query: { autoSave: 'true' },
          user: mockUser,
          headers: {},
        };
        const res = createMockRes();

        await analyze(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.autoSaved, false);
        assert.equal(res.body.savedRecord, null);
        assert.equal(res.body.analysis.overallConfidence, 0.62);
        assert.equal(createCalled, false);
      } finally {
        FoodLog.create = originalCreate;
      }
    });

    it('does NOT auto-save when ?autoSave is omitted or false', async () => {
      let createCalled = false;
      const originalCreate = FoodLog.create;
      FoodLog.create = async () => {
        createCalled = true;
      };

      try {
        setGeminiVisionMock(async () => ({
          dishTitle: 'Steak with Asparagus',
          totalCalories: 550,
          totalProtein: 50,
          totalCarbs: 5,
          totalFats: 32,
          overallConfidence: 0.95,
          items: [],
        }));

        const req = {
          file: {
            buffer: Buffer.from('mock-image-bytes'),
            size: 500 * 1024,
            mimetype: 'image/jpeg',
          },
          query: {}, // no autoSave flag
          user: mockUser,
          headers: {},
        };
        const res = createMockRes();

        await analyze(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.autoSaved, false);
        assert.equal(res.body.savedRecord, null);
        assert.equal(createCalled, false);
      } finally {
        FoodLog.create = originalCreate;
      }
    });
  });
});
