import { describe, it, expect, vi, beforeEach } from "vitest";
import api from "../configs/api";
import toast from "react-hot-toast";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("API 429 Scoped Toasts and suppressGlobalToasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows AI rate limit toast on AI endpoints on 429", async () => {
    // We can simulate calling the response interceptor directly
    // or through an axios mock
    const interceptor = (api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers[0];

    const aiError = {
      response: {
        status: 429,
        data: { retryAfterSeconds: 120 },
      },
      config: {
        url: "/api/ai-assistant/chat",
      },
    };

    await expect(interceptor.rejected(aiError)).rejects.toBeDefined();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("AI Rate limit reached"),
      expect.objectContaining({ id: "ai-rate-limit" })
    );
  });

  it("shows Daily AI budget toast on AI endpoints on 429 when budget exceeded", async () => {
    const interceptor = (api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers[0];

    const budgetError = {
      response: {
        status: 429,
        data: {
          error: { code: "AI_DAILY_BUDGET_EXCEEDED", resetAt: "2026-11-01T00:00:00Z" },
        },
      },
      config: {
        url: "/api/ai/chat",
      },
    };

    await expect(interceptor.rejected(budgetError)).rejects.toBeDefined();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Daily AI limit reached"),
      expect.objectContaining({ id: "ai-daily-budget-limit" })
    );
  });

  it("does NOT show AI toast when 429 occurs on non-AI endpoints", async () => {
    const interceptor = (api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers[0];

    const writeError = {
      response: {
        status: 429,
        data: { retryAfterSeconds: 30 },
      },
      config: {
        url: "/api/waterlogs",
      },
    };

    await expect(interceptor.rejected(writeError)).rejects.toBeDefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does NOT show AI toast when skipToast or suppressGlobalToasts is true", async () => {
    const interceptor = (api.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }).handlers[0];

    const suppressedError = {
      response: {
        status: 429,
        data: { retryAfterSeconds: 60 },
      },
      config: {
        url: "/api/image-analysis",
        skipToast: true,
      },
    };

    await expect(interceptor.rejected(suppressedError)).rejects.toBeDefined();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
