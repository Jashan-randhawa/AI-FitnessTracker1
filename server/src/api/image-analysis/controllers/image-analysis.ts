import { Context } from "koa"
import { analyzeImage } from "../services/gemini";

export default {
    async analyze(ctx: Context) {
        // Verify Authorization header is present even though route auth is disabled
        const authHeader = ctx.request.headers?.authorization as string | undefined;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            ctx.status = 401;
            ctx.body = { error: 'Unauthorized' };
            return;
        }

        // Field name must be "image" — matches formData.append("image", file) on the frontend
        const file = ctx.request.files?.image as any;
        if (!file) return ctx.badRequest('No image file provided');

        const filepath = file.path ?? file.filepath; // Koa multer may use either key

        try {
            const result = await analyzeImage(filepath);
            // Return { success: true, result: { name, calories } }
            ctx.body = { success: true, result };
        } catch (error: any) {
            ctx.status = 500;
            ctx.body = { error: error.message || 'Error analyzing image' };
        }
    }
}
