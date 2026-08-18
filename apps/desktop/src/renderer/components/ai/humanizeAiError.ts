/** Map raw LLM error codes to user-facing copy. */
export function humanizeAiError(code: string, rawMessage: string): string {
  switch (code) {
    case 'auth_failed':
      return 'API key is invalid or expired. Check your key in Settings > AI.';
    case 'rate_limit':
      return 'Rate limit reached. Please wait a moment and try again.';
    case 'provider_error':
      return 'The AI provider returned an error. Try again or switch models.';
    case 'network':
      return "Can't reach the AI service. Check your internet connection.";
    case 'context_overflow':
      return 'Your note is too long for this model. Try selecting less text.';
    case 'model_not_found':
      return 'The selected model is not available. Check Settings > AI.';
    case 'cancelled':
      return 'Request was cancelled.';
    case 'timeout':
      return 'Request timed out. Please try again.';
    default:
      return rawMessage || 'Something went wrong. Please try again.';
  }
}
