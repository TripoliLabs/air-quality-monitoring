/**
 * DTOs for Sensor Readings
 */

import { IsNumber, IsString, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for incoming sensor data from ChirpStack/MQTT
 */
export class CreateReadingDto {
  @ApiProperty({ description: 'Sensor device ID (LoRaWAN DevEUI)' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ description: 'Timestamp of the reading' })
  @IsDateString()
  timestamp!: string;

  @ApiProperty({ description: 'PM2.5 concentration in µg/m³' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  pm25!: number;

  @ApiProperty({ description: 'PM10 concentration in µg/m³' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  pm10!: number;

  @ApiPropertyOptional({ description: 'PM1.0 concentration in µg/m³' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  pm1?: number;

  @ApiProperty({ description: 'Temperature in Celsius' })
  @IsNumber()
  @Min(-40)
  @Max(85)
  temperature!: number;

  @ApiProperty({ description: 'Relative humidity in %' })
  @IsNumber()
  @Min(0)
  @Max(100)
  humidity!: number;

  @ApiPropertyOptional({ description: 'Atmospheric pressure in hPa' })
  @IsOptional()
  @IsNumber()
  @Min(300)
  @Max(1100)
  pressure?: number;

  @ApiPropertyOptional({ description: 'Battery voltage in mV' })
  @IsOptional()
  @IsNumber()
  batteryMv?: number;

  @ApiPropertyOptional({ description: 'LoRa signal strength (RSSI) in dBm' })
  @IsOptional()
  @IsNumber()
  signalStrength?: number;
}

/**
 * DTO for reading response
 */
export class ReadingResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sensorId!: string;

  @ApiProperty()
  timestamp!: Date;

  @ApiProperty()
  pm25!: number;

  @ApiProperty()
  pm10!: number;

  @ApiPropertyOptional()
  pm1?: number;

  @ApiProperty()
  temperature!: number;

  @ApiProperty()
  humidity!: number;

  @ApiPropertyOptional()
  pressure?: number;

  @ApiProperty({ description: 'Air Quality Index (0-500)' })
  aqi!: number;

  @ApiProperty({ description: 'AQI category (Good, Moderate, Unhealthy, etc.)' })
  aqiCategory!: string;
}
