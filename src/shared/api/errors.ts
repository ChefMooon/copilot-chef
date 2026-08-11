import { z } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "AUTH_ERROR"
  | "REQUEST_FAILED"
  | (string & {});

export type ApiErrorDetails = {
  path?: string;
  message: string;
  code?: string;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: string;
  code: ApiErrorCode;
  requestId?: string;
  details?: ApiErrorDetails[];
};

export function createApiErrorEnvelope(input: {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  details?: ApiErrorDetails[];
}): ApiErrorEnvelope {
  const payload: ApiErrorEnvelope = {
    ok: false,
    error: input.message,
    code: input.code,
  };

  if (input.requestId) {
    payload.requestId = input.requestId;
  }

  if (input.details && input.details.length > 0) {
    payload.details = input.details;
  }

  return payload;
}

export function formatZodIssues(error: z.ZodError): ApiErrorDetails[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : undefined,
    message: issue.message,
    code: issue.code,
  }));
}
