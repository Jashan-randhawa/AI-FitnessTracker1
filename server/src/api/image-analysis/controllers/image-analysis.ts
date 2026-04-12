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

        // formidable v3 uses `filepath`; older versions use `path`
        const filepath = file.filepath ?? file.path;
        if (!filepath) return ctx.badRequest('Could not read uploaded file path');

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
