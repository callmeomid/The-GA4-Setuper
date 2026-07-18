import * as Sentry from '@sentry/nextjs';

// Every error that reaches here does two things: a structured JSON line on
// stdout (so any log aggregator picks it up without special parsing) and a
// Sentry event (so someone gets paged instead of finding out from a client).
// Neither is optional — logging only to Sentry means local dev and
// self-hosted deploys without a DSN configured lose visibility entirely.

type LogContext = Record<string, unknown> & { tags?: Record<string, string> };

function emit(level: 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  const line = { level, message, time: new Date().toISOString(), ...context };
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

// `tags` is a reserved key: anything under it becomes a Sentry *tag*
// (indexed, filterable in alert rules — e.g. push_outcome:partial) rather
// than just searchable `extra` payload. See .env.example's Sentry alert rule
// instructions for why that split matters for the partial-push case.
function splitTags(context?: LogContext): { tags: Record<string, string>; extra: Record<string, unknown> } {
  if (!context) return { tags: {}, extra: {} };
  const { tags, ...extra } = context;
  return { tags: tags ?? {}, extra };
}

export function logInfo(message: string, context?: LogContext) {
  emit('info', message, context);
}

export function logWarn(message: string, context?: LogContext) {
  emit('warn', message, context);
  const { tags, extra } = splitTags(context);
  Sentry.captureMessage(message, { level: 'warning', tags, extra });
}

// `err` is logged separately from `context` because Sentry groups issues by
// exception type+stack — folding it into `extra` would break grouping and
// every call site would show up as one giant "Error" bucket.
export function logError(message: string, err: unknown, context?: LogContext) {
  emit('error', message, { ...context, error: err instanceof Error ? err.message : String(err) });
  const { tags, extra } = splitTags(context);
  Sentry.captureException(err instanceof Error ? err : new Error(message), {
    tags,
    extra: { message, ...extra },
  });
}
