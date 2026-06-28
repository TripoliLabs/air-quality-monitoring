import {
  HourlyBucketSchema,
  NetworkOverviewSchema,
  ReadingResponseSchema,
  SensorSchema,
} from '@aq/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * OpenAPI DTOs derived from the shared Zod contracts (ADR-002) — one source of
 * truth: the same schemas validate at runtime and document the API.
 */
export class SensorDto extends createZodDto(SensorSchema) {}
export class ReadingResponseDto extends createZodDto(ReadingResponseSchema) {}
export class HourlyBucketDto extends createZodDto(HourlyBucketSchema) {}
export class NetworkOverviewDto extends createZodDto(NetworkOverviewSchema) {}
