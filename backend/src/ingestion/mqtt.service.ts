/**
 * MQTT Service
 * Subscribes to ChirpStack MQTT topics and processes incoming sensor data
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  // private client: MqttClient;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing MQTT connection...');
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing MQTT connection...');
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const mqttUrl = this.configService.get<string>('MQTT_URL', 'mqtt://localhost:1883');
    const username = this.configService.get<string>('MQTT_USERNAME', '');
    const password = this.configService.get<string>('MQTT_PASSWORD', '');

    this.logger.log(`Connecting to MQTT broker: ${mqttUrl}`);

    // TODO: Implement MQTT connection
    // this.client = mqtt.connect(mqttUrl, { username, password });

    // Subscribe to ChirpStack uplink topic
    // Topic format: application/{application_id}/device/{dev_eui}/event/up
    // this.client.subscribe('application/+/device/+/event/up');
  }

  private async disconnect(): Promise<void> {
    // TODO: Implement disconnect
    // if (this.client) {
    //   await this.client.endAsync();
    // }
  }

  /**
   * Process incoming sensor data from ChirpStack
   */
  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      const data = JSON.parse(payload.toString());
      this.logger.debug(`Received message on ${topic}`);

      // TODO: Parse ChirpStack payload
      // TODO: Validate data
      // TODO: Calculate AQI
      // TODO: Store in TimescaleDB
      // TODO: Update Redis cache
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);
    }
  }
}
