import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::waterlog.waterlog', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');
    const body = ctx.request.body.data;
    body.users_permissions_user = user.id;
    if (!body.date) body.date = new Date().toISOString();
    const entry = await strapi.entityService.create('api::waterlog.waterlog', {
      data: body,
      populate: ['users_permissions_user'],
    });
    return entry;
  },

  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');
    const result = await strapi.entityService.findMany('api::waterlog.waterlog', {
      filters: { users_permissions_user: user.id },
      sort: { date: 'desc' },
    });
    return result;
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');
    const { id } = ctx.params;
    const existing = await strapi.entityService.findMany('api::waterlog.waterlog', {
      filters: { id, users_permissions_user: user.id },
    }) as unknown[];
    if (!existing.length) return ctx.notFound('Water log entry not found');
    return strapi.entityService.delete('api::waterlog.waterlog', id);
  },
}));
