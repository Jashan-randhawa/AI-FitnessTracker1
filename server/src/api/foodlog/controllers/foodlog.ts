/**
 * foodlog controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::foodlog.foodlog', ({ strapi }) => ({

  async create(ctx) {
    const user = ctx.state.user; // ctx.state.user IS the user — never destructure it
    if (!user) return ctx.unauthorized('You must be logged in to create a food log entry');

    const body = ctx.request.body.data;
    body.users_permissions_user = user.id;
    if (!body.date) body.date = new Date().toISOString();

    const entry = await strapi.entityService.create('api::foodlog.foodlog', {
      data: body,
      populate: ['users_permissions_user'],
    });
    return entry;
  },

  async find(ctx) {
    const user = ctx.state.user; // ✅ fixed — was: const { user } = ctx.state.user
    if (!user) return ctx.unauthorized('You must be logged in');

    const result = await strapi.entityService.findMany('api::foodlog.foodlog', {
      filters: { users_permissions_user: user.id },
      populate: ['users_permissions_user'],
    });
    return result;
  },

  async findOne(ctx) {
    const user = ctx.state.user; // ✅ fixed
    if (!user) return ctx.unauthorized('You must be logged in');
    const { id } = ctx.params;

    const result = await strapi.entityService.findMany('api::foodlog.foodlog', {
      filters: { id, users_permissions_user: user.id },
      populate: ['users_permissions_user'],
    });
    if (!result.length) return ctx.notFound('Food log entry not found');
    return result[0];
  },

  async delete(ctx) {
    const user = ctx.state.user; // ✅ fixed
    if (!user) return ctx.unauthorized('You must be logged in');
    const { id } = ctx.params;

    const existing = await strapi.entityService.findMany('api::foodlog.foodlog', {
      filters: { id, users_permissions_user: user.id },
    });
    if (!existing.length) return ctx.notFound('Food log entry not found');

    const deleted = await strapi.entityService.delete('api::foodlog.foodlog', id);
    return deleted;
  },
}));