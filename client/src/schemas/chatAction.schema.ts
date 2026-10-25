import { z } from "zod";

export const WaterActionSchema = z.object({
  type: z.literal("log_water"),
  amountMl: z.number().int().min(50).max(1500),
  label: z.string().max(80).optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export const ChatActionSchema = z.discriminatedUnion("type", [
  WaterActionSchema,
]);

export const ChatActionsListSchema = z.array(ChatActionSchema).max(3);

export type ProposedChatAction = z.infer<typeof ChatActionSchema>;
