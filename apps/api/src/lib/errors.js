export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = "BAD_REQUEST", details) =>
  new AppError(400, code, message, details);
export const notFound = (message, code = "NOT_FOUND") => new AppError(404, code, message);
export const conflict = (message, code = "CONFLICT", details) =>
  new AppError(409, code, message, details);
export const unprocessable = (message, code = "UNPROCESSABLE", details) =>
  new AppError(422, code, message, details);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function zodBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest("Invalid request body", "VALIDATION_ERROR", parsed.error.flatten());
  }
  return parsed.data;
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof AppError ? error.message : "Something went wrong";
  if (status >= 500) req.log?.error({ err: error }, "request failed");
  res.status(status).json({
    error: {
      code,
      message,
      ...(error.details ? { details: error.details } : {}),
      requestId: req.id,
    },
  });
}
