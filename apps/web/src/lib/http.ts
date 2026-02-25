import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiErrorPayload {
  error: string;
  code: string;
}

interface ApiErrorResult {
  status: number;
  payload: ApiErrorPayload;
}

function resolveErrorResult(error: unknown): ApiErrorResult {
  if (error instanceof ZodError) {
    return {
      status: 400,
      payload: {
        error: 'Invalid request payload.',
        code: 'VALIDATION_ERROR'
      }
    };
  }

  if (error instanceof Error) {
    const message = error.message || 'Unexpected server error.';

    if (message.toLowerCase() === 'unauthorized') {
      return {
        status: 401,
        payload: {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        }
      };
    }

    if (message.startsWith('Sheet not found:')) {
      return {
        status: 404,
        payload: {
          error: message,
          code: 'SHEET_NOT_FOUND'
        }
      };
    }

    if (message.includes('Unable to locate workbook file')) {
      return {
        status: 500,
        payload: {
          error: message,
          code: 'WORKBOOK_NOT_FOUND'
        }
      };
    }

    if (message.includes('Workbook file is not readable')) {
      return {
        status: 500,
        payload: {
          error: message,
          code: 'WORKBOOK_NOT_READABLE'
        }
      };
    }

    if (message.includes('Google credential not found') || message.includes('No Google token available')) {
      return {
        status: 401,
        payload: {
          error: 'Google access token is required for this request.',
          code: 'GOOGLE_TOKEN_MISSING'
        }
      };
    }

    return {
      status: 500,
      payload: {
        error: message,
        code: 'INTERNAL_ERROR'
      }
    };
  }

  return {
    status: 500,
    payload: {
      error: 'Unexpected server error.',
      code: 'INTERNAL_ERROR'
    }
  };
}

export function jsonApiError(error: unknown): NextResponse<ApiErrorPayload> {
  const { status, payload } = resolveErrorResult(error);
  return NextResponse.json(payload, { status });
}
