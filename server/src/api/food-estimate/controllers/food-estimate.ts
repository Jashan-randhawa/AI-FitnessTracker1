import { Context } from "koa";
import { estimateFood } from "../services/food-estimate";

export default {
  async estimate(ctx: Context) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("You must be logged in");

    const { name } = ctx.request.body as { name?: string };
    if (!name || typeof name !== "string" || !name.trim()) {
      return ctx.badRequest("Food name is required.");
    }

    try {
      const result = await estimateFood(name.trim());
      ctx.body = { success: true, result };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = { success: false, error: error.message || "Failed to estimate food nutrition." };
    }
  },
};
