import { io, type Socket } from 'socket.io-client';
import { slugify } from '../lib/format';
import { arabicPlaceName } from '../lib/places';
import type { HourlyPoint, NetworkHourlyPoint, Reading, Sensor } from '../types';
import type { RealtimeHandlers, SensorService } from './sensor-service';

/** Shapes the API returns (see @aq/contracts and apps/api). */
interface ApiSensor {
  id: string;
  deviceId: string;
  name: string;
  latitude: number;
  longitude: number;
  neighborhood?: string | null;
  isActive: boolean;
  installDate?: string | null;
}

interface ApiReading {
  /** Raw rows carry `time`; cached and live readings carry `timestamp`. */
  time?: string;
  timestamp?: string;
  sensorId?: string;
  deviceId?: string;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  pressure?: number | null;
  aqi: number;
  batteryMv?: number | null;
  signalStrength?: number | null;
}

interface ApiHourlyBucket {
  sensorId: string;
  bucket: string;
  avgPm25: number;
  avgPm10: number;
  avgTemperature: number;
  avgHumidity: number;
  maxAqi: number;
  sampleCount: number;
}

interface ApiNetworkBucket {
  bucket: string;
  avgPm25: number;
  avgPm10: number;
  avgTemperature: number;
  avgHumidity: number;
  maxAqi: number;
  sensorCount: number;
}

const REQUEST_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Device identifiers are hex DevEUIs; compare them case-insensitively.
const key = (deviceId: string): string => deviceId.toLowerCase();

export function toSensor(s: ApiSensor): Sensor {
  const neighborhood = s.neighborhood?.trim() || null;
  return {
    id: key(s.deviceId),
    name: s.name,
    neighborhood,
    neighborhoodAr: neighborhood ? arabicPlaceName(neighborhood) : undefined,
    neighborhoodId: slugify(neighborhood ?? ''),
    latitude: s.latitude,
    longitude: s.longitude,
    isActive: s.isActive,
    installDate: s.installDate ?? undefined,
  };
}

export function toReading(r: ApiReading): Reading | null {
  const sensorId = r.sensorId ?? r.deviceId;
  const time = Date.parse(r.time ?? r.timestamp ?? '');
  if (!sensorId || Number.isNaN(time)) return null;
  return {
    sensorId: key(sensorId),
    time,
    pm25: r.pm25,
    pm10: r.pm10,
    temperature: r.temperature,
    humidity: r.humidity,
    pressure: r.pressure ?? undefined,
    aqi: r.aqi,
    batteryMv: r.batteryMv ?? undefined,
    signalStrength: r.signalStrength ?? undefined,
  };
}

function toHourly(b: ApiHourlyBucket): HourlyPoint {
  return {
    sensorId: key(b.sensorId),
    time: Date.parse(b.bucket),
    pm25: b.avgPm25,
    pm10: b.avgPm10,
    temperature: b.avgTemperature,
    humidity: b.avgHumidity,
    maxAqi: b.maxAqi,
    samples: b.sampleCount,
  };
}

const isReading = (r: Reading | null): r is Reading => r !== null;

/** The live backend: REST for metadata and history, Socket.IO for readings as they land. */
export class HttpSensorService implements SensorService {
  readonly kind = 'api' as const;

  constructor(
    private readonly apiBase: string,
    private readonly socketUrl: string | undefined,
  ) {}

  private async get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.apiBase}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new ApiError(cause instanceof Error ? cause.message : 'Network request failed');
    }
    if (!response.ok) {
      throw new ApiError(`${response.status} ${response.statusText}`, response.status);
    }
    return (await response.json()) as T;
  }

  async getSensors(): Promise<Sensor[]> {
    return (await this.get<ApiSensor[]>('/sensors')).map(toSensor);
  }

  async getLatest(): Promise<Reading[]> {
    return (await this.get<ApiReading[]>('/sensors/latest')).map(toReading).filter(isReading);
  }

  async getReadings(sensorId: string, hours: number): Promise<Reading[]> {
    const rows = await this.get<ApiReading[]>(
      `/sensors/${encodeURIComponent(sensorId)}/readings?hours=${hours}`,
    );
    // The API returns newest first; the dashboard wants chronological.
    return rows.map(toReading).filter(isReading).reverse();
  }

  async getHourly(sensorId: string, days: number): Promise<HourlyPoint[]> {
    const rows = await this.get<ApiHourlyBucket[]>(
      `/sensors/${encodeURIComponent(sensorId)}/history?days=${days}`,
    );
    return rows.map(toHourly);
  }

  async getNetworkHourly(days: number, neighborhood?: string): Promise<NetworkHourlyPoint[]> {
    const place = neighborhood ? `&neighborhood=${encodeURIComponent(neighborhood)}` : '';
    const rows = await this.get<ApiNetworkBucket[]>(`/overview/history?days=${days}${place}`);
    return rows.map((b) => ({
      time: Date.parse(b.bucket),
      pm25: b.avgPm25,
      pm10: b.avgPm10,
      temperature: b.avgTemperature,
      humidity: b.avgHumidity,
      maxAqi: b.maxAqi,
      sensors: b.sensorCount,
    }));
  }

  async getServerTime(): Promise<number> {
    const { updatedAt } = await this.get<{ updatedAt: string }>('/overview');
    const time = Date.parse(updatedAt);
    if (Number.isNaN(time)) throw new ApiError('The server did not report its time');
    return time;
  }

  subscribe({ onReading, onConnection }: RealtimeHandlers): () => void {
    // Socket.IO reconnects on its own with backoff; the store falls back to
    // polling while the channel is down.
    const socket: Socket = this.socketUrl
      ? io(this.socketUrl, { transports: ['websocket', 'polling'] })
      : io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => onConnection(true));
    socket.on('disconnect', () => onConnection(false));
    socket.on('connect_error', () => onConnection(false));
    socket.on('reading', (payload: ApiReading) => {
      const reading = toReading(payload);
      if (reading) onReading(reading);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }
}
