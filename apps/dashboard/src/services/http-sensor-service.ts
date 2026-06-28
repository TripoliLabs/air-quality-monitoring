import type { SensorDefinition } from '@mock/sensors';
import type { SensorReading } from '@mock/simulator';
import axios, { type AxiosInstance } from 'axios';
import { io, type Socket } from 'socket.io-client';
import type { SensorService } from './sensor-service';

/** Shapes returned by the API (see @aq/contracts). */
interface ApiSensor {
  id: string;
  deviceId: string;
  name: string;
  latitude: number;
  longitude: number;
  neighborhood?: string;
  isActive: boolean;
}
interface ApiReading {
  time?: string;
  timestamp?: string;
  sensorId: string;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  aqi: number;
  batteryMv?: number;
  signalStrength?: number;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function toDefinition(s: ApiSensor): SensorDefinition {
  const neighborhood = s.neighborhood ?? 'Unknown';
  return {
    id: s.deviceId, // readings are keyed by DevEUI
    name: s.name,
    nameAr: s.name,
    neighborhoodId: slug(neighborhood),
    location: {
      latitude: s.latitude,
      longitude: s.longitude,
      neighborhood,
      neighborhoodAr: neighborhood,
    },
    status: s.isActive ? 'online' : 'offline',
    installDate: '',
    basePm25: { min: 0, max: 100 },
  };
}

function toReading(r: ApiReading): SensorReading {
  return {
    sensorId: r.sensorId,
    timestamp: new Date(r.time ?? r.timestamp ?? Date.now()),
    pm2_5: r.pm25,
    pm10: r.pm10,
    temperature: r.temperature,
    humidity: r.humidity,
    batteryMv: r.batteryMv ?? 0,
    signalStrength: r.signalStrength ?? 0,
    aqi: r.aqi,
  };
}

/** Live backend implementation: REST for history/metadata, Socket.IO for realtime. */
export class HttpSensorService implements SensorService {
  private readonly http: AxiosInstance;
  private socket: Socket | null = null;

  constructor(private readonly baseUrl: string) {
    this.http = axios.create({ baseURL: baseUrl, timeout: 10_000 });
  }

  async getSensors(): Promise<SensorDefinition[]> {
    const { data } = await this.http.get<ApiSensor[]>('/sensors');
    return data.map(toDefinition);
  }

  async getHistory(deviceId: string, hours = 24): Promise<SensorReading[]> {
    const { data } = await this.http.get<ApiReading[]>(`/sensors/${deviceId}/readings`, {
      params: { hours },
    });
    // API returns newest-first; the dashboard wants chronological.
    return data.map(toReading).reverse();
  }

  subscribe(onReading: (reading: SensorReading) => void): () => void {
    this.socket = io(this.baseUrl, { transports: ['websocket'] });
    this.socket.on('reading', (payload: ApiReading) => onReading(toReading(payload)));
    return () => {
      this.socket?.disconnect();
      this.socket = null;
    };
  }

  dispose(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
