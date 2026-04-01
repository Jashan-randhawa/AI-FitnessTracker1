import { Context } from "koa";
import { estimateCalories } from "../services/calorie-estimate";

export default {
  async estimate(ctx: Context) {
    const { activity, duration, weight } = ctx.request.body as {
      activity?: string;
      duration?: number;
      weight?: number;
    };

    if (!activity || typeof activity !== "string" || !activity.trim()) {
      return ctx.badRequest("activity is required.");
    }
    if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
      return ctx.badRequest("duration must be a positive number (minutes).");
    }

    // weight from request body, fallback to 70 kg
    const weightKg = Number(weight) > 0 ? Number(weight) : 70;
    const durationMin = Number(duration);

    try {
      const result = await estimateCalories(activity.trim(), durationMin, weightKg);
      ctx.body = { success: true, data: result };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = { success: false, error: error.message || "Failed to estimate calories." };
    }
  },
};
