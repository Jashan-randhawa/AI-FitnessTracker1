import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::chathistory.chathistory', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    // Return latest 5 sessions for context injection
    const result = await strapi.entityService.findMany('api::chathistory.chathistory', {
      filters: { users_permissions_user: user.id },
      sort: { createdAt: 'desc' },
      limit: 5,
    });
    return result;
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const { summary, messages } = ctx.request.body.data;
    const entry = await strapi.entityService.create('api::chathistory.chathistory', {
      data: { summary, messages, users_permissions_user: user.id },
    });
    return entry;
  },

  async deleteAll(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();
    const all = await strapi.entityService.findMany('api::chathistory.chathistory', {
      filters: { users_permissions_user: user.id },
    });
    for (const item of all as any[]) {
      await strapi.entityService.delete('api::chathistory.chathistory', item.id);
    }
    return { deleted: (all as any[]).length };
  },
}));
