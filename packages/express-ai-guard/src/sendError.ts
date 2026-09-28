/**
 * Sends a structured JSON error response that provides both flat `message`
 * and nested `error.message` for frontend compatibility.
 */
export const sendError = (
  res: any,
  status: number,
  message: string,
  extra: Record<string, unknown> = {}
) => {
  res.status(status).json({
    message,
    error: {
      message,
      ...extra,
    },
  });
};

export default sendError;
