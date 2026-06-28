<script setup lang="ts">
import ApiEndpoint from '@components/ApiEndpoint.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const sensorListExample = `{
  "data": [
    {
      "id": "sensor_001",
      "name": "Downtown #1",
      "neighborhood": "Downtown",
      "status": "online",
      "location": {
        "latitude": 34.4367,
        "longitude": 35.8497
      },
      "latestAqi": 85
    }
  ],
  "total": 52,
  "page": 1
}`;

const sensorDetailExample = `{
  "id": "sensor_001",
  "name": "Downtown #1",
  "neighborhood": "Downtown",
  "status": "online",
  "location": {
    "latitude": 34.4367,
    "longitude": 35.8497
  },
  "installDate": "2025-09-15",
  "batteryMv": 3850,
  "signalStrength": -52,
  "latestReading": {
    "pm2_5": 35.2,
    "pm10": 58.7,
    "temperature": 24.5,
    "humidity": 62.0,
    "aqi": 100,
    "timestamp": "2025-12-01T14:30:00Z"
  }
}`;

const readingsExample = `{
  "data": [
    {
      "timestamp": "2025-12-01T14:30:00Z",
      "pm2_5": 35.2,
      "pm10": 58.7,
      "temperature": 24.5,
      "humidity": 62.0,
      "aqi": 100
    }
  ],
  "sensorId": "sensor_001",
  "from": "2025-12-01T00:00:00Z",
  "to": "2025-12-01T23:59:59Z"
}`;

const neighborhoodListExample = `{
  "data": [
    {
      "id": "downtown",
      "name": "Downtown",
      "sensorCount": 6,
      "avgAqi": 95,
      "avgPm25": 32.1
    }
  ]
}`;

const neighborhoodDetailExample = `{
  "id": "downtown",
  "name": "Downtown",
  "center": {
    "latitude": 34.4367,
    "longitude": 35.8497
  },
  "sensorCount": 6,
  "onlineCount": 5,
  "avgAqi": 95,
  "avgPm25": 32.1,
  "avgPm10": 55.3,
  "avgTemp": 24.2,
  "avgHumidity": 61.5
}`;

const aqiCurrentExample = `{
  "cityAvg": 92,
  "category": "moderate",
  "neighborhoods": [
    {
      "id": "downtown",
      "name": "Downtown",
      "avgAqi": 95
    }
  ],
  "timestamp": "2025-12-01T14:30:00Z"
}`;

const exportExample = `sensorId,sensorName,neighborhood,timestamp,pm2_5,pm10,temperature,humidity,aqi
sensor_001,Downtown #1,Downtown,2025-12-01T14:30:00Z,35.2,58.7,24.5,62.0,100`;

const wsExample = `// Connection
const ws = new WebSocket("wss://api.qalawun.org/ws");

// Incoming message format:
{
  "event": "reading",
  "data": {
    "sensorId": "sensor_001",
    "pm2_5": 35.2,
    "pm10": 58.7,
    "temperature": 24.5,
    "humidity": 62.0,
    "aqi": 100,
    "timestamp": "2025-12-01T14:30:00Z"
  }
}`;
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-100">
        <i class="pi pi-book mr-2 text-emerald-400"></i>
        {{ t('apiDocs.title') }}
      </h1>
      <p class="mt-1 text-sm text-gray-400">{{ t('apiDocs.subtitle') }}</p>
    </div>

    <!-- Coming Soon Banner -->
    <div class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div class="flex items-center gap-3">
        <i class="pi pi-info-circle text-sky-400"></i>
        <p class="text-sm text-sky-300">{{ t('apiDocs.comingSoon') }}</p>
      </div>
    </div>

    <!-- Base URL -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-2 text-sm font-semibold text-gray-300">
        {{ t('apiDocs.baseUrl') }}
      </h3>
      <code class="inline-block rounded-lg bg-gray-950 px-4 py-2 text-sm text-emerald-400">
        https://api.qalawun.org/v1
      </code>
    </div>

    <!-- Authentication -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-2 text-sm font-semibold text-gray-300">
        <i class="pi pi-lock mr-2 text-gray-500"></i>
        {{ t('apiDocs.authentication') }}
      </h3>
      <p class="text-sm text-gray-400">{{ t('apiDocs.authNote') }}</p>
    </div>

    <!-- Endpoints -->
    <div>
      <h2 class="mb-3 text-lg font-semibold text-gray-200">
        {{ t('apiDocs.endpoints') }}
      </h2>

      <!-- Sensors -->
      <div class="mb-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-400">
          {{ t('apiDocs.sensors') }}
        </h3>
        <div class="space-y-2">
          <ApiEndpoint
            method="GET"
            path="/api/sensors"
            description="List all sensors"
            :params="[
              {
                name: 'neighborhood',
                type: 'string',
                required: false,
                description: 'Filter by neighborhood ID',
              },
              {
                name: 'status',
                type: 'string',
                required: false,
                description: 'Filter by status (online, offline, maintenance)',
              },
              {
                name: 'page',
                type: 'number',
                required: false,
                description: 'Page number (default: 1)',
              },
            ]"
            :example-response="sensorListExample"
          />
          <ApiEndpoint
            method="GET"
            path="/api/sensors/:id"
            description="Get sensor details"
            :params="[
              {
                name: 'id',
                type: 'string',
                required: true,
                description: 'Sensor ID (e.g. sensor_001)',
              },
            ]"
            :example-response="sensorDetailExample"
          />
          <ApiEndpoint
            method="GET"
            path="/api/sensors/:id/readings"
            description="Get sensor readings"
            :params="[
              {
                name: 'id',
                type: 'string',
                required: true,
                description: 'Sensor ID',
              },
              {
                name: 'from',
                type: 'ISO 8601',
                required: false,
                description: 'Start date',
              },
              {
                name: 'to',
                type: 'ISO 8601',
                required: false,
                description: 'End date',
              },
              {
                name: 'interval',
                type: 'string',
                required: false,
                description: 'Aggregation interval (5m, 1h, 1d)',
              },
            ]"
            :example-response="readingsExample"
          />
        </div>
      </div>

      <!-- Neighborhoods -->
      <div class="mb-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-400">
          {{ t('apiDocs.neighborhoods') }}
        </h3>
        <div class="space-y-2">
          <ApiEndpoint
            method="GET"
            path="/api/neighborhoods"
            description="List all neighborhoods"
            :example-response="neighborhoodListExample"
          />
          <ApiEndpoint
            method="GET"
            path="/api/neighborhoods/:id"
            description="Get neighborhood details"
            :params="[
              {
                name: 'id',
                type: 'string',
                required: true,
                description: 'Neighborhood ID (e.g. downtown)',
              },
            ]"
            :example-response="neighborhoodDetailExample"
          />
        </div>
      </div>

      <!-- AQI -->
      <div class="mb-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-400">
          {{ t('apiDocs.aqiLabel') }}
        </h3>
        <div class="space-y-2">
          <ApiEndpoint
            method="GET"
            path="/api/aqi/current"
            description="Get current city-wide AQI"
            :example-response="aqiCurrentExample"
          />
        </div>
      </div>

      <!-- Export -->
      <div class="mb-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-400">
          {{ t('apiDocs.exportLabel') }}
        </h3>
        <div class="space-y-2">
          <ApiEndpoint
            method="GET"
            path="/api/export"
            description="Export data as CSV/JSON"
            :params="[
              {
                name: 'format',
                type: 'string',
                required: false,
                description: 'Export format: csv or json (default: json)',
              },
              {
                name: 'from',
                type: 'ISO 8601',
                required: false,
                description: 'Start date',
              },
              {
                name: 'to',
                type: 'ISO 8601',
                required: false,
                description: 'End date',
              },
              {
                name: 'sensors',
                type: 'string',
                required: false,
                description: 'Comma-separated sensor IDs (default: all)',
              },
            ]"
            :example-response="exportExample"
          />
        </div>
      </div>

      <!-- WebSocket -->
      <div class="mb-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-400">
          {{ t('apiDocs.websocket') }}
        </h3>
        <div class="space-y-2">
          <ApiEndpoint
            method="WS"
            path="/ws"
            description="Real-time sensor updates"
            :example-response="wsExample"
          />
        </div>
      </div>
    </div>

    <!-- Rate Limiting -->
    <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 class="mb-2 text-sm font-semibold text-gray-300">
        <i class="pi pi-clock mr-2 text-gray-500"></i>
        {{ t('apiDocs.rateLimiting') }}
      </h3>
      <p class="text-sm text-gray-400">{{ t('apiDocs.rateLimitNote') }}</p>
    </div>
  </div>
</template>
