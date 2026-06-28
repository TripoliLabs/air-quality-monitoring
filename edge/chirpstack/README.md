# ChirpStack Configuration

This directory contains configuration files for the ChirpStack LoRaWAN Network Server.

## Overview

ChirpStack is used to:
- Receive LoRaWAN packets from gateways (RAK7268 WisGate Edge Lite 2)
- Decrypt and validate sensor data
- Publish data to MQTT for processing

## Files

- `chirpstack.toml` - Main ChirpStack configuration (EU868 region enabled for Lebanon/Middle East)

## Setup

1. Deploy ChirpStack via Docker Compose (see root `docker-compose.yml`)
2. Access web UI at http://localhost:8080
3. Create application and register devices
4. Configure gateway to connect to ChirpStack

## Gateway Configuration

### RAK7268 WisGate Edge Lite 2

1. Access gateway web UI (default: 192.168.230.1)
2. Navigate to LoRa > Work Mode
3. Select "Packet Forwarder" mode
4. Set server address to ChirpStack host
5. Set port to 1700 (UDP)

## Documentation

- [ChirpStack Docs](https://www.chirpstack.io/docs/)
- [RAK7268 Documentation](https://docs.rakwireless.com/Product-Categories/WisGate/RAK7268/)
