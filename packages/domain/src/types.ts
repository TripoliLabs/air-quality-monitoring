/** Core measurement and AQI types shared across the platform. */

export interface Measurements {
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  pressure?: number;
}

export type AqiCategory =
  | 'good'
  | 'moderate'
  | 'unhealthy-sensitive'
  | 'unhealthy'
  | 'very-unhealthy'
  | 'hazardous';

export interface AqiResult {
  aqi: number;
  category: AqiCategory;
  /** The pollutant that drove the AQI (the maximum sub-index). */
  dominantPollutant: 'pm25' | 'pm10';
}
