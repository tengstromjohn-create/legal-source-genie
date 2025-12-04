/**
 * Central error handling utility
 */

// Error codes for structured error handling
export type ErrorCode =
  | "NETWORK_ERROR"
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT"
  | "PAYMENT_REQUIRED"
  | "SERVER_ERROR"
  | "AI_ERROR"
  | "PARSE_ERROR"
  | "UNKNOWN_ERROR";

// Structured error response from edge functions
export interface ApiError {
  errorCode: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// Context for logging
export interface ErrorContext {
  component?: string;
  action?: string;
  sourceId?: string;
  userId?: string;
  workspaceId?: string;
  [key: string]: unknown;
}

/**
 * Log an error with context to the console
 * In production, this could send to an error tracking service
 */
export function logError(error: unknown, context?: ErrorContext): void {
  const timestamp = new Date().toISOString();
  const errorMessage = getErrorMessage(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${timestamp}] Error:`, {
    message: errorMessage,
    context,
    stack: errorStack,
    raw: error,
  });
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Ett okänt fel uppstod";
}

/**
 * Map technical errors to user-friendly messages in Swedish
 */
export function getUserFriendlyMessage(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  // Network errors
  if (message.includes("fetch") || message.includes("network") || message.includes("connection")) {
    return "Kunde inte ansluta till servern. Kontrollera din internetanslutning.";
  }

  // Auth errors
  if (message.includes("unauthorized") || message.includes("auth") || message.includes("401")) {
    return "Du är inte inloggad. Logga in och försök igen.";
  }

  if (message.includes("forbidden") || message.includes("403")) {
    return "Du har inte behörighet att utföra denna åtgärd.";
  }

  // Rate limits
  if (message.includes("rate limit") || message.includes("429")) {
    return "För många förfrågningar. Vänta en stund och försök igen.";
  }

  // Payment
  if (message.includes("payment") || message.includes("402")) {
    return "Betalning krävs. Kontrollera ditt konto.";
  }

  // Not found
  if (message.includes("not found") || message.includes("404")) {
    return "Resursen kunde inte hittas.";
  }

  // AI/OpenAI specific
  if (message.includes("openai") || message.includes("ai")) {
    return "AI-tjänsten är tillfälligt otillgänglig. Försök igen senare.";
  }

  // Parse errors
  if (message.includes("parse") || message.includes("json") || message.includes("truncated")) {
    return "Kunde inte bearbeta svaret. Dokumentet kan vara för stort.";
  }

  // Database errors
  if (message.includes("database") || message.includes("supabase") || message.includes("query")) {
    return "Databasfel. Försök igen senare.";
  }

  // Validation errors
  if (message.includes("required") || message.includes("invalid") || message.includes("validation")) {
    return "Ogiltig data. Kontrollera dina inmatningar.";
  }

  // Return original if no mapping found (but cleaned up)
  const originalMessage = getErrorMessage(error);
  // Don't expose technical details
  if (originalMessage.length > 200 || originalMessage.includes("Error:")) {
    return "Ett fel uppstod. Försök igen senare.";
  }

  return originalMessage;
}

/**
 * Parse API error response
 */
export function parseApiError(response: { error?: string; errorCode?: ErrorCode; message?: string }): ApiError {
  return {
    errorCode: response.errorCode || "UNKNOWN_ERROR",
    message: response.error || response.message || "Unknown error",
  };
}

/**
 * Determine error code from error
 */
export function getErrorCode(error: unknown): ErrorCode {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("network") || message.includes("fetch")) return "NETWORK_ERROR";
  if (message.includes("auth") || message.includes("unauthorized")) return "AUTH_ERROR";
  if (message.includes("not found")) return "NOT_FOUND";
  if (message.includes("rate limit") || message.includes("429")) return "RATE_LIMIT";
  if (message.includes("payment") || message.includes("402")) return "PAYMENT_REQUIRED";
  if (message.includes("validation") || message.includes("required")) return "VALIDATION_ERROR";
  if (message.includes("ai") || message.includes("openai")) return "AI_ERROR";
  if (message.includes("parse") || message.includes("json")) return "PARSE_ERROR";

  return "UNKNOWN_ERROR";
}

/**
 * Create a standardized error for throwing
 */
export function createError(code: ErrorCode, message: string, details?: Record<string, unknown>): Error & ApiError {
  const error = new Error(message) as Error & ApiError;
  error.errorCode = code;
  error.details = details;
  return error;
}
