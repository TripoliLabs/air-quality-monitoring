/**
 * Shared observability helpers. Kept dependency-free for now; wire the real
 * OpenTelemetry SDK (traces → Tempo, metrics → Mimir, logs → Loki) here so every
 * service is instrumented consistently. See deploy/observability/.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Minimal structured JSON logger (placeholder until OTel logs are wired). */
export function createLogger(service: string): Logger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>): void => {
    const line = JSON.stringify({ level, service, msg, ...meta });
    if (level === 'error' || level === 'warn') console.error(line);
    else console.log(line);
  };
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
  };
}

/** Placeholder for OpenTelemetry SDK bootstrap (no-op until wired). */
export function initTelemetry(_service: string): void {
  // TODO: configure @opentelemetry/sdk-node with OTLP exporters → Alloy/LGTM.
}
