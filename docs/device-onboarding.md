# Physical Sensor Node Onboarding Guide

This document describes the complete end-to-end procedure for provisioning and onboarding a physical sensor node (e.g. LilyGO T-Beam V1.2, DevEUI `2cbcbbfffea945c4`) into the Tripoli Air Quality Monitoring Network.

---

## Architecture Overview

```
[Physical Node] ──(LoRaWAN EU868)──► [DLOS8N Gateway] ──► [ChirpStack v4]
                                                                  │
                                                          (MQTT Uplink)
                                                                  ▼
                                                      [Ingestion Service]
                                                                  │
                                                       (Persists Readings)
                                                                  ▼
 [Admin Operator] ──(POST /sensors)──► [NestJS API] ──► [PostgreSQL Registry]
                                              │                   │
                                              ▼                   ▼
                                      [Public Map & Dashboard UI]
```

---

## 1. Physical Node Preparation & Keys

Each node runs the firmware compiled from `firmware/` and has three unique LoRaWAN cryptographic identifiers:

* **DevEUI (Device EUI):** 16 hexadecimal characters uniquely identifying the radio chip (e.g., `2cbcbbfffea945c4`).
* **JoinEUI (AppEUI):** `0102030405060708` (network Join EUI).
* **AppKey (Application Key):** 128-bit AES root key flashed to the device (kept secret).

---

## 2. ChirpStack v4 Provisioning

Before an OTAA device can join the network, it must be registered in the ChirpStack Network Server:

1. **Access ChirpStack Web UI:**
   Navigate to `http://<chirpstack-host>:8080` (or local `http://localhost:8080`) and sign in.

2. **Select Application:**
   Go to **Applications** and select the Tripoli Air Quality application (e.g., `airquality-network`).

3. **Add Device:**
   Click **Add device**:
   * **Device name:** e.g., `mina-corniche-01`
   * **Device EUI:** Enter the 16-character DevEUI (`2cbcbbfffea945c4`).
   * **Device profile:** Select the `EU868 OTAA (Sensor Node)` profile (codec handled by the backend ingestion service).

4. **Set OTAA Keys:**
   In the **OTAA keys** tab, enter the 32-hex-character **AppKey** matching the firmware configuration.

5. **Power On Node:**
   Power on the device or toggle the reset button. The device will issue a `JoinRequest`. Upon receiving the `JoinAccept` through the gateway, ChirpStack will log the active session and start forwarding fPort 2 uplinks to the internal MQTT broker.

---

## 3. Registering the Device in the API Registry

Once the node is transmitting, register its civic metadata (GPS coordinates, neighborhood, display name) in the relational database registry using the API.

### Authentication
Write endpoints require an admin API key passed in the `X-API-Key` header:
```bash
ADMIN_API_KEY="your-production-admin-api-key"
```

### Discovery of Unregistered Transmitting Nodes
To see all devices currently transmitting uplinks that have not yet been registered:
```bash
curl -s -X GET "https://api.tripoliair.org/sensors/unregistered" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```
*Response:*
```json
[
  {
    "deviceId": "2cbcbbfffea945c4",
    "lastSeen": "2026-10-10T19:30:00.000Z",
    "readingCount": 42
  }
]
```

### Register the Node
Send a `POST /sensors` request:
```bash
curl -X POST "https://api.tripoliair.org/sensors" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "deviceId": "2cbcbbfffea945c4",
    "name": "Mina Port Node",
    "description": "Installed near the Tripoli Port administrative building",
    "latitude": 34.4552,
    "longitude": 35.8234,
    "neighborhood": "El Mina",
    "status": "active",
    "isSimulated": false
  }'
```
*Response (201 Created):*
```json
{
  "id": "c7b5a198-4c81-4993-9cbf-9a3bfa2e2bc1",
  "deviceId": "2cbcbbfffea945c4",
  "name": "Mina Port Node",
  "description": "Installed near the Tripoli Port administrative building",
  "latitude": 34.4552,
  "longitude": 35.8234,
  "neighborhood": "El Mina",
  "status": "active",
  "isActive": true,
  "isSimulated": false,
  "createdAt": "2026-10-10T19:35:00.000Z",
  "updatedAt": "2026-10-10T19:35:00.000Z"
}
```

---

## 4. Lifecycle Management (Maintenance & Retirement)

### Updating Metadata or Status
If a sensor is taken down for recalibration or moved:
```bash
curl -X PATCH "https://api.tripoliair.org/sensors/2cbcbbfffea945c4" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_API_KEY}" \
  -d '{
    "status": "maintenance"
  }'
```

### Retiring a Sensor
When a sensor is permanently decommissioned:
```bash
curl -X DELETE "https://api.tripoliair.org/sensors/2cbcbbfffea945c4" \
  -H "X-API-Key: ${ADMIN_API_KEY}"
```
This performs a safe soft-retirement: sets `status = "retired"` and `isActive = false`, preserving historical telemetry data while removing the sensor from active network alerts and map calculations.

---

## 5. Verification on the Dashboard

Immediately upon registration:
1. Open the dashboard at `http://localhost:5173` (or the public dashboard URL).
2. The sensor will appear on the interactive MapLibre map with its neighborhood label.
3. If recent uplinks were received, the AQI dot will color-code according to real-time particulate readings.
4. If no readings have arrived yet, the sensor will cleanly display `--` metrics and a neutral gray marker until the first packet arrives.
