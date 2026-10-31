const asyncHandler = require('express-async-handler');
const { publishChange } = require('../services/eventBus');
const WaterLog = require('../models/WaterLog');
const sendError = require('../utils/sendError');
const { parsePageParams, findPage, sendPage } = require('../utils/pagination');
const { validateLogDate } = require('../utils/localDay');
const idempotency = require('../middleware/idempotency');

// POST /api/waterlogs — body: { data: { amount, date } }
const create = asyncHandler(async (req, res) => {
  if (!req._idempotencyHandled) {
    let proceeded = false;
    await new Promise((resolve, reject) => {
      Promise.resolve(
        idempotency(req, res, (err) => {
          proceeded = true;
          if (err) return reject(err);
          resolve();
        })
      )
        .then(() => {
          if (!proceeded) resolve();
        })
        .catch(reject);
    });
    if (!proceeded) return;
  }

  const raw = req.body?.data || req.body || {};
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
    return sendError(res, 400, 'amount must be between 1 and 10000 ml');
  }

  const dateValidation = validateLogDate(raw.date);
  if (!dateValidation.valid) {
    return sendError(res, 400, dateValidation.error, dateValidation.code ? { code: dateValidation.code } : {});
  }
  const logDate = dateValidation.date;

  const entry = await WaterLog.create({
    amount,
    date: logDate,
    user: req.user._id,
  });

  const responseJson = entry.toJSON();
  publishChange(String(req.user._id), 'water', entry.date);
  res.json(responseJson);
});

// GET /api/waterlogs
const find = asyncHandler(async (req, res) => {
  const page = parsePageParams(req.query);
  if (page.error) return sendError(res, 400, page.error);
  const { docs, nextCursor } = await findPage(WaterLog, { user: req.user._id }, { field: 'date', ...page });
  sendPage(res, docs.map((r) => r.toJSON()), nextCursor);
});

// PUT /api/waterlogs/:id — body: { data: { amount } }
const update = asyncHandler(async (req, res) => {
  const raw = req.body.data || req.body || {};
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
    return sendError(res, 400, 'amount must be between 1 and 10000 ml');
  }
  const entry = await WaterLog.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { amount },
    { new: true, runValidators: true }
  );
  if (!entry) return sendError(res, 404, 'Water log entry not found');
  publishChange(String(req.user._id), 'water', entry.date);
  res.json(entry.toJSON());
});

// DELETE /api/waterlogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await WaterLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Water log entry not found');
  publishChange(String(req.user._id), 'water', entry.date);
  res.json(entry.toJSON());
});

module.exports = { create, find, update, remove };
