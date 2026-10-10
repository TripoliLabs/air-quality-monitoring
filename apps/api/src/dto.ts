import {
  CreateSensorSchema,
  HourlyBucketSchema,
  NetworkOverviewSchema,
  ReadingResponseSchema,
  SensorSchema,
  UpdateSensorSchema,
} from '@aq/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * OpenAPI DTOs derived from the shared Zod contracts (ADR-002) — one source of
 * truth: the same schemas validate at runtime and document the API.
 */
export class SensorDto extends createZodDto(SensorSchema) {}
export class CreateSensorDto extends createZodDto(CreateSensorSchema) {}
export class UpdateSensorDto extends createZodDto(UpdateSensorSchema) {}
export class ReadingResponseDto extends createZodDto(ReadingResponseSchema) {}
export class HourlyBucketDto extends createZodDto(HourlyBucketSchema) {}
export class NetworkOverviewDto extends createZodDto(NetworkOverviewSchema) {}
