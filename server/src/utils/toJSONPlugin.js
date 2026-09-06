/**
 * Applied to every schema so API responses look like Strapi v5's flat
 * entity shape ({ id, ...fields }) instead of Mongoose's ({ _id, __v }).
 * The React client (unchanged) expects `id` as a string on every entity.
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
