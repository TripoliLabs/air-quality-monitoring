// Imported first in main.ts so OpenTelemetry can patch modules before they load.
import { initTelemetry } from '@aq/observability';

initTelemetry(process.env.OTEL_SERVICE_NAME ?? 'ingestion');
