# ChirpStack Configuration

This directory contains the ChirpStack v4 LoRaWAN Network Server config.

## Overview

ChirpStack:
- Receives LoRaWAN frames from gateways (via the ChirpStack Gateway Bridge)
- Validates the MIC, decrypts the payload, deduplicates, runs the network server
- Publishes application uplinks to MQTT for the ingestion service

## Files

- `chirpstack.toml` — main config (Postgres, Redis, MQTT integration, `net_id`, enabled regions, API)
- `region_eu868.toml` — EU868 region + the **gateway backend MQTT** the gateway bridge talks to

The gateway path is: gateway → Semtech UDP (or Basic Station) → **chirpstack-gateway-bridge** → MQTT → ChirpStack. Both the bridge and the REST API are compose services. Locally the simulator plays the role of the gateway (`services/simulator/src/gateway.ts`).

## First gateway: Dragino DLOS8N (EU868)

Outdoor 8-channel SX1302 gateway with an **EC25-E 4G/LTE module** for cellular
backhaul (no reliable wired internet needed — well suited to Lebanon). Supports
the **Semtech UDP packet forwarder** and **Basic Station**.

To connect a real DLOS8N to a deployed ChirpStack:

1. Web UI (default `10.130.1.1` over WiFi AP, or via Ethernet) → **LoRaWAN → LoRaWAN Semtech UDP** (or **Basic Station**).
2. Set the server address to the **public** ChirpStack Gateway Bridge host, port **1700/udp** (Semtech UDP) — or the Basic Station endpoint for a TLS-secured link.
3. Set the frequency plan to **EU868**.
4. Insert a data SIM for the EC25-E and configure the cellular APN.
5. In ChirpStack, **register the gateway** using the DLOS8N's real Gateway EUI (printed on the device).

> Production note: Semtech UDP is unauthenticated/unencrypted — prefer **Basic Station over TLS** (or a VPN) for the gateway↔server link across the public internet.

## Documentation

- [ChirpStack Docs](https://www.chirpstack.io/docs/)
- [Dragino DLOS8N User Manual](https://wiki.dragino.com/xwiki/bin/view/Main/User%20Manual%20for%20All%20Gateway%20models/DLOS8N/)
