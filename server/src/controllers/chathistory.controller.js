const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { z } = require('zod');
const ChatHistory = require('../models/ChatHistory');

const messageTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'model']),
  text: z.string().trim().min(1, 'Message text cannot be empty').max(8000, 'Message text exceeds 8,000 characters limit'),
});

const chatHistoryPayloadSchema = z
  .object({
    sessionId: z.string().trim().max(128, 'sessionId must not exceed 128 characters').optional(),
    revision: z.number().int().min(1, 'revision must be an integer >= 1').optional(),
    summary: z.string().max(2000, 'summary must not exceed 2,000 characters').optional().default(''),
    messages: z
      .array(messageTurnSchema)
      .max(100, 'Session messages array must not exceed 100 turns')
      .optional()
      .default([]),
  })
  .refine(
    (data) => {
      const totalChars = (data.messages || []).reduce((sum, m) => sum + m.text.length, 0);
      return totalChars <= 50000;
    },
    { message: 'Total session messages payload exceeds 50,000 characters limit' }
  );

/**
 * Normalizes a stored ChatHistory document to ensure consistent shape
 * for both new and legacy historical documents.
 *
 * @param {Object} doc
 * @returns {Object|null}
 */
const normalizeHistoryDoc = (doc) => {
  if (!doc) return null;
  const json = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };

  // Normalize sessionId: fallback to string representation of id / _id
  if (!json.sessionId && json.id) {
    json.sessionId = String(json.id);
  } else if (!json.sessionId && json._id) {
    json.sessionId = String(json._id);
  }

  // Normalize revision
  json.revision = typeof json.revision === 'number' && json.revision >= 1 ? json.revision : 1;

  // Normalize summary
  json.summary = typeof json.summary === 'string' ? json.summary : '';

  // Normalize messages array
  const rawMessages = Array.isArray(json.messages) ? json.messages : [];
  json.messages = rawMessages
    .map((m) => {
      if (!m || typeof m !== 'object') return null;
      let text = '';
      if (typeof m.text === 'string') {
        text = m.text;
      } else if (typeof m.content === 'string') {
        text = m.content;
      } else if (Array.isArray(m.parts)) {
        text = m.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
      }

      if (!text || typeof text !== 'string') return null;
      const role = m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user';
      return { role, text: text.trim() };
    })
    .filter(Boolean);

  return json;
};

/**
 * GET /api/chathistories
 * Returns recent chat history sessions for the authenticated user.
 * Supports optional ?limit= query (default 20, max 50).
 */
const find = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const result = await ChatHistory.find({ user: req.user._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit);

  res.json(result.map(normalizeHistoryDoc));
});

/**
 * GET /api/chathistories/session/:sessionId or /api/chathistories/:id
 * Fetches a single session scoped strictly to req.user._id.
 */
const getSession = asyncHandler(async (req, res) => {
  const targetId = req.params.sessionId || req.params.id;
  if (!targetId) {
    return res.status(400).json({ error: 'Session identifier is required' });
  }

  let entry = await ChatHistory.findOne({ user: req.user._id, sessionId: targetId });
  if (!entry && mongoose.isValidObjectId(targetId)) {
    entry = await ChatHistory.findOne({ user: req.user._id, _id: targetId });
  }

  if (!entry) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  res.json(normalizeHistoryDoc(entry));
});

/**
 * Internal helper to upsert or create a session idempotently.
 */
const saveOrUpdateSession = async (user, payload) => {
  const { sessionId, revision, summary, messages } = payload;

  if (sessionId) {
    const existing = await ChatHistory.findOne({ user: user._id, sessionId });
    if (existing) {
      // Reject or ignore stale out-of-order writes
      if (existing.revision && revision && revision < existing.revision) {
        return { doc: existing, staleIgnored: true };
      }

      existing.summary = summary !== undefined ? summary : existing.summary;
      existing.messages = messages !== undefined ? messages : existing.messages;
      existing.revision = Math.max(revision || 1, (existing.revision || 1) + 1);
      await existing.save();
      return { doc: existing, updated: true };
    }

    // Try to create new session
    try {
      const created = await ChatHistory.create({
        user: user._id,
        sessionId,
        revision: revision || 1,
        summary: summary || '',
        messages: messages || [],
      });
      return { doc: created, created: true };
    } catch (err) {
      // Catch concurrent creation race condition (E11000 duplicate key error)
      if (err.code === 11000) {
        const concurrent = await ChatHistory.findOne({ user: user._id, sessionId });
        if (concurrent) {
          concurrent.summary = summary !== undefined ? summary : concurrent.summary;
          concurrent.messages = messages !== undefined ? messages : concurrent.messages;
          concurrent.revision = Math.max(revision || 1, (concurrent.revision || 1) + 1);
          await concurrent.save();
          return { doc: concurrent, updated: true };
        }
      }
      throw err;
    }
  }

  // Legacy format without sessionId
  const legacyEntry = await ChatHistory.create({
    user: user._id,
    summary: summary || '',
    messages: messages || [],
    revision: 1,
  });
  return { doc: legacyEntry, created: true };
};

/**
 * POST /api/chathistories
 * Creates or idempotently updates a chat history snapshot.
 * Accepts { data: { sessionId?, revision?, summary, messages } } or top-level body.
 */
const create = asyncHandler(async (req, res) => {
  const raw = req.body?.data || req.body || {};
  const parsed = chatHistoryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }

  const { doc, created } = await saveOrUpdateSession(req.user, parsed.data);
  res.status(created ? 201 : 200).json(normalizeHistoryDoc(doc));
});

/**
 * PUT /api/chathistories/session/:sessionId (or PUT /api/chathistories/:sessionId)
 * Explicit idempotent upsert for a specific sessionId.
 */
const upsertSession = asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId || req.params.id;
  const raw = req.body?.data || req.body || {};
  const parsed = chatHistoryPayloadSchema.safeParse({ ...raw, sessionId });

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }

  const { doc, created } = await saveOrUpdateSession(req.user, parsed.data);
  res.status(created ? 201 : 200).json(normalizeHistoryDoc(doc));
});

/**
 * DELETE /api/chathistories/session/:sessionId or /api/chathistories/:id
 * Deletes a single session owned by req.user._id.
 */
const deleteSession = asyncHandler(async (req, res) => {
  const targetId = req.params.sessionId || req.params.id;
  if (!targetId) {
    return res.status(400).json({ error: 'Session identifier is required' });
  }

  let result = await ChatHistory.deleteOne({ user: req.user._id, sessionId: targetId });
  if (result.deletedCount === 0 && mongoose.isValidObjectId(targetId)) {
    result = await ChatHistory.deleteOne({ user: req.user._id, _id: targetId });
  }

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  res.json({ success: true, deleted: true });
});

/**
 * DELETE /api/chathistories/all
 * Deletes all chat sessions for the authenticated user.
 */
const deleteAll = asyncHandler(async (req, res) => {
  const result = await ChatHistory.deleteMany({ user: req.user._id });
  res.json({ deleted: result.deletedCount });
});

module.exports = {
  find,
  getSession,
  create,
  upsertSession,
  deleteSession,
  deleteAll,
  normalizeHistoryDoc,
  chatHistoryPayloadSchema,
};
