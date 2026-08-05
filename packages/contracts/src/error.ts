/**
 * Uniform API error envelope (AD-17). Every domain error maps to this shape at
 * the HTTP boundary so FE handling stays consistent across all endpoints.
 */
export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export function apiError(code: string, message: string, details?: unknown): ApiError {
  return details === undefined ? { code, message } : { code, message, details }
}
