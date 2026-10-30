/**
 * Applied to every schema so API responses format as a clean flat
 * entity shape ({ id, ...fields }) instead of Mongoose's ({ _id, __v }).
 * The React client expects `id` as a string on every entity.
 *
 * @param {import('mongoose').Schema} schema
 * @param {{ hide?: string[] }} [options] extra fields to strip from output (e.g. password)
 */
module.exports = function toJSONPlugin(schema, options = {}) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      (options.hide || []).forEach((field) => delete ret[field]);
      return ret;
    },
  });
};
