import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ok,
  fail,
  ERROR_STATUS,
  type ApiErrorCode,
  type ApiResponse,
} from '@psr/types';

export { ok, fail };

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function jsonOk<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json(ok(data, meta) satisfies ApiResponse<T>);
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  extra?: { fieldErrors?: Record<string, string[]> },
): NextResponse {
  const body = fail(code, message, { ...extra, requestId: requestId() });
  return NextResponse.json(body, { status: ERROR_STATUS[code] });
}

/** Parse+validate a request payload, returning a typed value or an error response. */
export function parse<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): { ok: true; value: z.infer<S> } | { ok: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    response: jsonError('validation_error', 'Invalid request.', {
      fieldErrors: result.error.flatten().fieldErrors as Record<string, string[]>,
    }),
  };
}

/** Wrap a handler so thrown errors become a safe internal_error envelope. */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      // Never leak internals to the client; log server-side.
      // eslint-disable-next-line no-console
      console.error('[api] unhandled error', err);
      return jsonError('internal_error', 'Something went wrong. Please try again.');
    }
  };
}
