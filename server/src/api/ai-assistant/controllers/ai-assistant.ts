import { Context } from "koa";
import { chatWithGemini } from "../services/openrouter-chat";
import type { ChatMessage } from "../services/openrouter-chat";

export default {
  async chat(ctx: Context) {
    const { messages, userContext } = ctx.request.body as {
      messages: ChatMessage[];
      userContext?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return ctx.badRequest("messages array is required");
    }

    try {
      const reply = await chatWithGemini(messages, userContext);
      ctx.body = { success: true, reply };
    } catch (error: any) {
      ctx.status = 500;
      ctx.body = { error: error.message || "Error communicating with AI" };
    }
  },
};
