/**
 * activitylog controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::activitylog.activitylog',({strapi}) => ({
    async create(ctx) {
        const user = ctx.state.user; // ✅ ctx.state.user IS the user object
        if(!user) return ctx.unauthorized('You must be logged in to create an activity log entry');
        const body = ctx.request.body.data;
        body.users_permissions_user = user.id;
        if (!body.date) body.date = new Date().toISOString();
        if (body.caloriesBurned !== undefined) {
            body.calories = body.caloriesBurned;
            delete body.caloriesBurned;
        }

        const entry = await strapi.entityService.create('api::activitylog.activitylog',{
            data: body,
            populate: ['users_permissions_user']
        })  
        return entry;
    },
    async find(ctx) {
        const user = ctx.state.user; // ✅ fixed
        if(!user) return ctx.unauthorized('You must be logged in');
        
        const result = await strapi.entityService.findMany('api::activitylog.activitylog',{
            filters: {
                users_permissions_user: user.id
            },
            populate: ['users_permissions_user']
        })  
        return result;
    },
    async findOne(ctx) {
        const user = ctx.state.user; // ✅ fixed
        if(!user) return ctx.unauthorized('You must be logged in');
        const { id } = ctx.params;
        
        const result = await strapi.entityService.findMany('api::activitylog.activitylog',{
            filters: {
                id, users_permissions_user: user.id
            },
            populate: ['users_permissions_user']
        })  
        if(!result.length) return ctx.notFound('Activity log entry not found');
        return result[0];
    },
    async delete(ctx) {
        const user = ctx.state.user; // ✅ fixed
        if(!user) return ctx.unauthorized('You must be logged in');
        const { id } = ctx.params;

        const existing = await strapi.entityService.findMany('api::activitylog.activitylog', {
            filters: { id, users_permissions_user: user.id },
        });
        if(!existing.length) return ctx.notFound('Activity log entry not found');

        const deleted = await strapi.entityService.delete('api::activitylog.activitylog', id);
        return deleted;
    }
}));