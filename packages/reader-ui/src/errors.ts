export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const e = error as {
      response?: {
        data?: {
          error?: string | { message?: string };
          details?: string;
          detail?: string | { message?: string };
        };
      };
      message?: string;
    };
    const responseData = e.response?.data;
    const shapedError = responseData?.error;
    const detail = responseData?.detail;
    return (
      (typeof shapedError === "string" ? shapedError : shapedError?.message) ||
      responseData?.details ||
      (typeof detail === "string" ? detail : detail?.message) ||
      e.message ||
      fallback
    );
  }
  return fallback;
}
