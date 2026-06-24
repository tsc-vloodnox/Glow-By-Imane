const DATABASE_UNAVAILABLE_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1004",
  "P1008",
  "P1009",
  "P1010",
  "P1011",
  "P1012",
  "P1013",
  "P1014",
  "P1016",
  "P1017",
  "P2024",
]);

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
}

function getErrorMessage(error: unknown): string {
  const messages: string[] = [];

  const visit = (value: unknown) => {
    if (value instanceof Error) {
      if (value.message) {
        messages.push(value.message);
      }

      if (value.cause) {
        visit(value.cause);
      }
      return;
    }

    if (typeof value === "string") {
      messages.push(value);
      return;
    }

    if (typeof value === "object" && value && "message" in value) {
      const maybeMessage = (value as { message?: unknown }).message;
      if (typeof maybeMessage === "string" && maybeMessage) {
        messages.push(maybeMessage);
      }
    }
  };

  visit(error);
  return messages.join(" ").toLowerCase();
}

export function isDatabaseUnavailableError(error: unknown) {
  const code = getErrorCode(error);
  if (code && DATABASE_UNAVAILABLE_CODES.has(code)) {
    return true;
  }

  const message = getErrorMessage(error);
  return [
    "can't reach database server",
    "connection refused",
    "connection terminated",
    "timed out",
    "econnrefused",
    "econnreset",
    "socket hang up",
    "pgbouncer",
    "connect econnrefused",
    "getaddrinfo",
    "etimedout",
    "no such host",
    "server closed the connection unexpectedly",
  ].some((needle) => message.includes(needle));
}

export async function withDatabaseFallback<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error("[db] Database unavailable, using fallback data.", error);
      return fallback;
    }

    throw error;
  }
}
