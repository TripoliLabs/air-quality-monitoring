/**
 * Shared observability helpers: a structured JSON logger and the OpenTelemetry
 * SDK bootstrap (traces → Tempo via OTLP, metrics → Prometheus scrape). Call
 * initTelemetry() as the very first thing in a service's entrypoint so the
 * auto-instrumentations can patch modules before they are imported.
 * See deploy/observability/.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

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

let sdk: NodeSDK | undefined;

/**
 * Bootstrap OpenTelemetry for a service:
 * - Metrics: a Prometheus exporter on `OTEL_PROMETHEUS_PORT` (default 9464, /metrics).
 * - Traces: exported via OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT` when that env
 *   is set (e.g. http://tempo:4318); otherwise tracing export is disabled so a
 *   plain `docker compose up` (no observability profile) stays quiet.
 * - Auto-instruments HTTP, Express, ioredis, pg, etc.
 *
 * Idempotent. Call once, first thing, in the service entrypoint.
 */
export function initTelemetry(service: string): void {
  if (sdk || process.env.OTEL_SDK_DISABLED === 'true') return;

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const metricsPort = Number(process.env.OTEL_PROMETHEUS_PORT ?? 9464);

  sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: service }),
    metricReader: new PrometheusExporter({ port: metricsPort }),
    traceExporter: otlpEndpoint
      ? new OTLPTraceExporter({ url: `${otlpEndpoint.replace(/\/$/, '')}/v1/traces` })
      : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  const shutdown = (): void => {
    void sdk?.shutdown();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
