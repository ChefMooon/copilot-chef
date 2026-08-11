const SENSITIVE_KEY_PATTERN = /(token|api[_-]?key|authorization|secret|password)/i;

export function redactSensitiveText(value: string): string {
  if (!value) {
    return value;
  }

  let redacted = value.replace(
    /((?:token|api[_-]?key|authorization|secret|password)[\s:=]+)([^\s,&;]+)/gi,
    "$1[redacted]"
  );

  redacted = redacted.replace(
    /("(?:token|apiKey|api_key|authorization|secret|password)"\s*:\s*")[^"]*(")/gi,
    '$1[redacted]$2'
  );

  return redacted;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function sanitizeLogValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactSensitiveText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
        const nextValue = isSensitiveKey(key) ? "[redacted]" : sanitizeLogValue(entryValue);
        return [key, nextValue];
      })
    ) as T;
  }

  return value;
}

export function logLifecycle(event: string, details?: Record<string, unknown>): void {
  const payload = details ? sanitizeLogValue(details) : undefined;
  console.info(`[copilot-chef] ${event}`, payload ?? {});
}
