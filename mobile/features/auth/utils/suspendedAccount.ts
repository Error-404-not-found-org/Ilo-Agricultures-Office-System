// In-memory access state: never persist a suspension beyond explicit sign-out.
let suspended = false;
const listeners = new Set<() => void>();

export const getSuspendedAccount = () => suspended;

export const subscribeSuspendedAccount = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setSuspendedAccount = () => {
  if (suspended) return;
  suspended = true;
  if (typeof __DEV__ !== "undefined" && __DEV__) console.info("[Auth diagnostic] Suspended state entered");
  listeners.forEach((listener) => listener());
};

export const clearSuspendedAccount = () => {
  if (!suspended) return;
  suspended = false;
  if (typeof __DEV__ !== "undefined" && __DEV__) console.info("[Auth diagnostic] Suspended state cleared by sign-out");
  listeners.forEach((listener) => listener());
};

export const isClerkBannedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("errors" in error)) return false;
  const errors = error.errors;
  return Array.isArray(errors) && errors.some((item) => item?.code === "user_banned");
};

const redactDiagnosticText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token]")
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9]+\b/g, "[key]")
    .slice(0, 240);
};

export const getSafeClerkErrorDiagnostic = (error: unknown) => {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const rawErrors = Array.isArray(candidate.errors) ? candidate.errors : [];
  const response = candidate.response && typeof candidate.response === "object"
    ? candidate.response as Record<string, unknown> : {};
  const responseData = response.data && typeof response.data === "object"
    ? response.data as Record<string, unknown> : {};
  const rawResponseErrors = Array.isArray(responseData.errors) ? responseData.errors : [];
  const summarizeError = (item: unknown) => {
    const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      code: redactDiagnosticText(entry.code),
      message: redactDiagnosticText(entry.message),
      longMessage: redactDiagnosticText(entry.longMessage),
    };
  };
  return {
    constructorName: candidate.constructor?.name,
    name: redactDiagnosticText(candidate.name),
    status: typeof candidate.status === "number" ? candidate.status
      : typeof candidate.statusCode === "number" ? candidate.statusCode : undefined,
    message: redactDiagnosticText(candidate.message),
    code: redactDiagnosticText(candidate.code),
    isClerkAPIResponseError: candidate.isClerkAPIResponseError === true,
    errors: rawErrors.map(summarizeError),
    responseStatus: typeof response.status === "number" ? response.status : undefined,
    responseCode: redactDiagnosticText(responseData.code),
    responseErrors: rawResponseErrors.map(summarizeError),
  };
};

export const getSafeOAuthOutcomeDiagnostic = (outcome: unknown) => {
  const candidate = outcome && typeof outcome === "object" ? outcome as Record<string, unknown> : {};
  const authSessionResult = candidate.authSessionResult && typeof candidate.authSessionResult === "object"
    ? candidate.authSessionResult as Record<string, unknown> : {};
  const signIn = candidate.signIn && typeof candidate.signIn === "object"
    ? candidate.signIn as Record<string, unknown> : {};
  let callback: URL | undefined;
  if (typeof authSessionResult.url === "string") {
    try { callback = new URL(authSessionResult.url); } catch { /* No callback URL to inspect. */ }
  }
  return {
    type: redactDiagnosticText(authSessionResult.type),
    hasSession: Boolean(candidate.createdSessionId),
    signInStatus: redactDiagnosticText(signIn.status),
    queryKeys: callback ? [...callback.searchParams.keys()] : [],
    error: redactDiagnosticText(callback?.searchParams.get("error")),
    errorCode: redactDiagnosticText(callback?.searchParams.get("error_code")),
    reason: redactDiagnosticText(callback?.searchParams.get("reason")),
    errorDescription: redactDiagnosticText(callback?.searchParams.get("error_description")),
  };
};

export const handleSuspendedApiError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("response" in error)) return false;
  const response = error.response;
  if (!response || typeof response !== "object" || !("data" in response)) return false;
  const data = response.data;
  if (!data || typeof data !== "object" || !("code" in data)) return false;
  if (data.code !== "ACCOUNT_SUSPENDED") return false;
  setSuspendedAccount();
  return true;
};

export const signOutFromSuspendedAccount = async (signOut: () => Promise<unknown>) => {
  await signOut();
  clearSuspendedAccount();
};
