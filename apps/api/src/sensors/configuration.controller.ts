import {
  type ConfigurationAccepted,
  ConfigurationAcceptedSchema,
  type ConfigurationCommand,
  ConfigurationCommandSchema,
  type ConfigurationState,
  ConfigurationStateSchema,
} from '@aq/contracts';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { AdminOnly } from '../auth/admin.decorator';
import { ConfigurationService } from './configuration.service';

export const ConfigurationCommandDto = createZodDto(ConfigurationCommandSchema);
export class ConfigurationStateDto extends createZodDto(ConfigurationStateSchema) {}
export class ConfigurationAcceptedDto extends createZodDto(ConfigurationAcceptedSchema) {}

@ApiTags('sensors')
@Controller('sensors/:deviceId/config')
@ApiNotFoundResponse({ description: 'Sensor not registered' })
@ApiServiceUnavailableResponse({
  description: 'Redis unavailable; read state before retrying enqueue',
})
export class ConfigurationController {
  constructor(private readonly configuration: ConfigurationService) {}

  @Get()
  @ApiOperation({ summary: 'Read reported configuration, outstanding command, and latest result' })
  @ApiOkResponse({ type: ConfigurationStateDto })
  async get(@Param('deviceId') deviceId: string): Promise<ConfigurationState> {
    return this.configuration.get(deviceId);
  }

  @Post()
  @AdminOnly()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Queue an absolute node setting; acceptance does not establish delivery',
  })
  @ApiAcceptedResponse({ type: ConfigurationAcceptedDto })
  @ApiBody({ type: ConfigurationCommandDto })
  @ApiBadRequestResponse({ description: 'Invalid command, range, precision, or extra fields' })
  @ApiConflictResponse({ description: 'Retired sensor or existing outstanding command' })
  async post(
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(ConfigurationCommandDto)) dto: ConfigurationCommand,
  ): Promise<ConfigurationAccepted> {
    return this.configuration.enqueue(deviceId, dto);
  }
}
