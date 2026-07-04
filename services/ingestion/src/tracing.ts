// Imported first in main.ts so OpenTelemetry can patch modules before they load.
import { initTelemetry } from '@aq/observability';

// Distinct default from the API's 9464 so both can run on the host without a
// Prometheus-exporter port clash (override with OTEL_PROMETHEUS_PORT).
process.env.OTEL_PROMETHEUS_PORT ??= '9465';

initTelemetry(process.env.OTEL_SERVICE_NAME ?? 'ingestion');
