const mongoose = require('mongoose');

/**
 * Keyset (cursor) pagination for list endpoints.
 *
 * Opt-in: a request without `limit` returns the full list exactly as before,
 * so existing clients keep working. When `limit` is supplied the response is
 * capped at that many items (max MAX_PAGE_SIZE) and, if more items exist, the
 * `X-Next-Cursor` response header carries the cursor for the next page. Pass
 * it back as `?cursor=` to fetch the following page.
 *
 * Ordering is newest-first by the given field, with `_id` as a tie-breaker so
 * pages never skip or repeat items that share a timestamp.
 */

const MAX_PAGE_SIZE = 200;
const CURSOR_SEPARATOR = '|';

const INVALID = Symbol('invalid');

const encodeCursor = (sortValue, id) =>
  Buffer.from(`${new Date(sortValue).toISOString()}${CURSOR_SEPARATOR}${String(id)}`).toString('base64url');

const decodeCursor = (raw) => {
  const text = Buffer.from(String(raw), 'base64url').toString('utf8');
  const [iso, id] = text.split(CURSOR_SEPARATOR);
  const date = new Date(iso);
  if (!id || Number.isNaN(date.getTime()) || !mongoose.isValidObjectId(id)) return INVALID;
  return { date, id };
};

/**
 * Reads `limit` and `cursor` from a request query.
 * @returns {{ limit: number|null, cursor: object|null } | { error: string }}
 */
const parsePageParams = (query = {}) => {
  let limit = null;
  if (query.limit !== undefined && query.limit !== '') {
    const n = Number.parseInt(query.limit, 10);
    if (!Number.isFinite(n) || n < 1) return { error: 'limit must be a positive integer' };
    limit = Math.min(n, MAX_PAGE_SIZE);
  }

  let cursor = null;
  if (query.cursor !== undefined && query.cursor !== '') {
    cursor = decodeCursor(query.cursor);
    if (cursor === INVALID) return { error: 'cursor is invalid' };
  }

  return { limit, cursor };
};

/**
 * Runs a paginated, newest-first query.
 * @param {import('mongoose').Model} Model
 * @param {object} filter Base filter (e.g. { user })
 * @param {{ field: string, limit: number|null, cursor: object|null }} opts
 * @returns {Promise<{ docs: object[], nextCursor: string|null }>}
 */
const findPage = async (Model, filter, { field, limit, cursor }) => {
  let scoped = filter;
  if (cursor) {
    scoped = {
      ...filter,
      $or: [
        { [field]: { $lt: cursor.date } },
        { [field]: cursor.date, _id: { $lt: cursor.id } },
      ],
    };
  }

  const sort = { [field]: -1, _id: -1 };

  if (limit === null) {
    const docs = await Model.find(scoped).sort(sort);
    return { docs, nextCursor: null };
  }

  // Fetch one extra document to know whether another page exists.
  const fetched = await Model.find(scoped).sort(sort).limit(limit + 1);
  const hasMore = fetched.length > limit;
  const docs = hasMore ? fetched.slice(0, limit) : fetched;
  const last = docs[docs.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last[field], last._id) : null;

  return { docs, nextCursor };
};

/**
 * Sends a page of documents as a JSON array, with the cursor in a header.
 * The body stays a plain array so existing clients are unaffected.
 */
const sendPage = (res, docs, nextCursor) => {
  if (nextCursor) res.set('X-Next-Cursor', nextCursor);
  res.json(docs);
};

module.exports = {
  MAX_PAGE_SIZE,
  parsePageParams,
  findPage,
  sendPage,
  encodeCursor,
  decodeCursor,
};
