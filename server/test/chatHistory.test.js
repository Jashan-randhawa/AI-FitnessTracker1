const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const ChatHistory = require('../src/models/ChatHistory');
const {
  find,
  getSession,
  create,
  upsertSession,
  deleteSession,
  deleteAll,
  chatHistoryPayloadSchema,
} = require('../src/controllers/chathistory.controller');

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

describe('ChatHistory Model & Partial Index Specification Tests', () => {
  it('initializes ChatHistory model with sessionId, revision, and defaults', () => {
    const entry = new ChatHistory({
      user: new mongoose.Types.ObjectId(),
      sessionId: 'sess-test-1234',
      revision: 1,
      summary: 'User asked about protein intake',
      messages: [{ role: 'user', text: 'How much protein?' }],
    });

    assert.equal(entry.sessionId, 'sess-test-1234');
    assert.equal(entry.revision, 1);
    assert.equal(entry.summary, 'User asked about protein intake');
    assert.equal(entry.messages.length, 1);
  });

  it('declares compound unique index on { user, sessionId } with partialFilterExpression', () => {
    const indexes = ChatHistory.schema.indexes();
    const userSessionIndex = indexes.find(
      ([fields]) => fields.user === 1 && fields.sessionId === 1
    );

    assert.ok(userSessionIndex, 'Expected compound index on { user: 1, sessionId: 1 }');
    const [fields, options] = userSessionIndex;
    assert.equal(options.unique, true, 'Compound index must be unique');
    assert.deepEqual(
      options.partialFilterExpression,
      { sessionId: { $type: 'string' } },
      'Index must use partialFilterExpression to exempt legacy documents lacking string sessionId'
    );
  });

  it('declares compound sorting indexes for pagination', () => {
    const indexes = ChatHistory.schema.indexes();
    const hasUpdatedIndex = indexes.some(([fields]) => fields.user === 1 && fields.updatedAt === -1);
    const hasCreatedIndex = indexes.some(([fields]) => fields.user === 1 && fields.createdAt === -1);

    assert.ok(hasUpdatedIndex, 'Expected compound index on { user: 1, updatedAt: -1 }');
    assert.ok(hasCreatedIndex, 'Expected compound index on { user: 1, createdAt: -1 }');
  });
});

describe('ChatHistory Zod Payload Validation Tests', () => {
  it('accepts valid session snapshot payload', () => {
    const payload = {
      sessionId: 'valid-session-uuid-1',
      revision: 2,
      summary: 'Short session summary',
      messages: [
        { role: 'user', text: 'What is BMR?' },
        { role: 'assistant', text: 'BMR is Basal Metabolic Rate.' },
      ],
    };

    const parsed = chatHistoryPayloadSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.sessionId, 'valid-session-uuid-1');
    assert.equal(parsed.data.messages.length, 2);
  });

  it('rejects invalid message role (only user, assistant, model allowed)', () => {
    const payload = {
      sessionId: 'sess-invalid-role',
      messages: [{ role: 'admin', text: 'Exploit attempt' }],
    };

    const parsed = chatHistoryPayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.issues.some((i) => i.path.includes('role')));
  });

  it('rejects oversized single message text exceeding 8,000 characters', () => {
    const hugeText = 'a'.repeat(8001);
    const payload = {
      sessionId: 'sess-huge-msg',
      messages: [{ role: 'user', text: hugeText }],
    };

    const parsed = chatHistoryPayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.issues.some((i) => i.path.includes('text')));
  });

  it('rejects oversized summary exceeding 2,000 characters', () => {
    const hugeSummary = 's'.repeat(2001);
    const payload = {
      sessionId: 'sess-huge-summary',
      summary: hugeSummary,
      messages: [],
    };

    const parsed = chatHistoryPayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.issues.some((i) => i.path.includes('summary')));
  });

  it('rejects session message arrays exceeding 100 turns', () => {
    const manyMessages = Array.from({ length: 101 }, (_, i) => ({
      role: 'user',
      text: `Message ${i}`,
    }));
    const payload = {
      sessionId: 'sess-oversized-array',
      messages: manyMessages,
    };

    const parsed = chatHistoryPayloadSchema.safeParse(payload);
    assert.equal(parsed.success, false);
    assert.ok(parsed.error.issues.some((i) => i.path.includes('messages')));
  });
});

describe('ChatHistory Controller Idempotency, Revision & Scoping Unit Tests', () => {
  const userId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();

  it('POST /api/chathistories creates a new session document when not found', async () => {
    const originalFindOne = ChatHistory.findOne;
    const originalCreate = ChatHistory.create;

    ChatHistory.findOne = async () => null;
    ChatHistory.create = async (doc) => ({
      ...doc,
      _id: new mongoose.Types.ObjectId(),
      toJSON() {
        return { ...this };
      },
    });

    try {
      const req = {
        user: { _id: userId },
        body: {
          data: {
            sessionId: 'new-session-uuid-1',
            revision: 1,
            summary: 'Initial query',
            messages: [{ role: 'user', text: 'Hello FitBot' }],
          },
        },
      };
      const res = createMockRes();

      await create(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.sessionId, 'new-session-uuid-1');
      assert.equal(res.body.revision, 1);
    } finally {
      ChatHistory.findOne = originalFindOne;
      ChatHistory.create = originalCreate;
    }
  });

  it('POST /api/chathistories idempotently updates existing session instead of duplicating', async () => {
    const originalFindOne = ChatHistory.findOne;
    let saved = false;

    const mockDoc = {
      _id: new mongoose.Types.ObjectId(),
      user: userId,
      sessionId: 'session-idempotent-test',
      revision: 1,
      summary: 'First turn',
      messages: [{ role: 'user', text: 'First message' }],
      save: async function () {
        saved = true;
        return this;
      },
      toJSON() {
        return {
          _id: this._id,
          sessionId: this.sessionId,
          revision: this.revision,
          summary: this.summary,
          messages: this.messages,
        };
      },
    };

    ChatHistory.findOne = async (query) => {
      if (String(query.user) === String(userId) && query.sessionId === 'session-idempotent-test') {
        return mockDoc;
      }
      return null;
    };

    try {
      const req = {
        user: { _id: userId },
        body: {
          data: {
            sessionId: 'session-idempotent-test',
            revision: 2,
            summary: 'Updated turn',
            messages: [
              { role: 'user', text: 'First message' },
              { role: 'assistant', text: 'First answer' },
            ],
          },
        },
      };
      const res = createMockRes();

      await create(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(saved, true);
      assert.equal(res.body.summary, 'Updated turn');
      assert.equal(res.body.revision, 2);
      assert.equal(res.body.messages.length, 2);
    } finally {
      ChatHistory.findOne = originalFindOne;
    }
  });

  it('POST /api/chathistories ignores stale out-of-order writes with lower revision', async () => {
    const originalFindOne = ChatHistory.findOne;
    let mutated = false;

    const mockDoc = {
      _id: new mongoose.Types.ObjectId(),
      user: userId,
      sessionId: 'session-order-test',
      revision: 5,
      summary: 'Newer snapshot summary',
      messages: [{ role: 'user', text: 'Msg 5' }],
      save: async function () {
        mutated = true;
        return this;
      },
      toJSON() {
        return {
          _id: this._id,
          sessionId: this.sessionId,
          revision: this.revision,
          summary: this.summary,
          messages: this.messages,
        };
      },
    };

    ChatHistory.findOne = async () => mockDoc;

    try {
      // Arriving snapshot has older revision 3 < 5
      const req = {
        user: { _id: userId },
        body: {
          data: {
            sessionId: 'session-order-test',
            revision: 3,
            summary: 'Stale snapshot summary',
            messages: [{ role: 'user', text: 'Msg 3' }],
          },
        },
      };
      const res = createMockRes();

      await create(req, res);

      // Successfully returns existing document without applying stale mutation
      assert.equal(res.statusCode, 200);
      assert.equal(mutated, false, 'Document must NOT be mutated when incoming revision is stale');
      assert.equal(res.body.summary, 'Newer snapshot summary');
      assert.equal(res.body.revision, 5);
    } finally {
      ChatHistory.findOne = originalFindOne;
    }
  });

  it('GET /api/chathistories/session/:sessionId enforces strict user ownership isolation', async () => {
    const originalFindOne = ChatHistory.findOne;

    ChatHistory.findOne = async (query) => {
      // Only returns if user matches owner
      if (String(query.user) === String(userId)) {
        return {
          _id: 'doc-user-a',
          sessionId: 'sess-a',
          user: userId,
          toJSON() {
            return this;
          },
        };
      }
      return null;
    };

    try {
      // User B attempts to access User A's session
      const req = {
        user: { _id: otherUserId },
        params: { sessionId: 'sess-a' },
      };
      const res = createMockRes();

      await getSession(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.body.error, 'Chat session not found');
    } finally {
      ChatHistory.findOne = originalFindOne;
    }
  });

  it('DELETE /api/chathistories/session/:sessionId deletes session scoped to req.user._id', async () => {
    const originalDeleteOne = ChatHistory.deleteOne;
    let queryUsed = null;

    ChatHistory.deleteOne = async (query) => {
      queryUsed = query;
      return { deletedCount: 1 };
    };

    try {
      const req = {
        user: { _id: userId },
        params: { sessionId: 'session-to-delete' },
      };
      const res = createMockRes();

      await deleteSession(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.deleted, true);
      assert.equal(String(queryUsed.user), String(userId));
      assert.equal(queryUsed.sessionId, 'session-to-delete');
    } finally {
      ChatHistory.deleteOne = originalDeleteOne;
    }
  });
});
