import { Context } from "koa";
import { estimateFood } from "../services/food-estimate";

export default {
  async estimate(ctx: Context) {
    const { name } = ctx.request.body as { name?: string };
    if (!name || typeof name !== "string" || !name.trim()) {
      return ctx.badRequest("Food name is required.");
    }

    try {
      const result = await estimateFood(name.trim());
      ctx.body = { success: true, result };
    } catch (error: any) {
      const message = error?.message || "Failed to estimate food nutrition.";
      const isProviderIssue =
        message.includes("No AI provider available") ||
        message.includes("API key not set");
      ctx.status = isProviderIssue ? 503 : 500;
      ctx.body = { success: false, error: message };
    }
  },
};
