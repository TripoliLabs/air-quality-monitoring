/**
 * Canonical sensor fixtures — the single source of truth for the simulated
 * deployment. Used by the DB seed (relational `sensors` rows) and by the
 * traffic simulator (which DevEUIs send uplinks). DevEUI = LoRaWAN device EUI.
 */
export interface SensorFixture {
  deviceId: string; // DevEUI (16 hex chars)
  name: string;
  latitude: number;
  longitude: number;
  neighborhood: string;
  /** Baseline PM2.5 (µg/m³) for this location — drives the simulator. */
  baselinePm25: number;
}

export const SENSOR_FIXTURES: SensorFixture[] = [
  {
    deviceId: '70b3d57ed0060001',
    name: 'El Mina Corniche',
    latitude: 34.4516,
    longitude: 35.8206,
    neighborhood: 'El Mina',
    baselinePm25: 18,
  },
  {
    deviceId: '70b3d57ed0060002',
    name: 'Tell Downtown',
    latitude: 34.4367,
    longitude: 35.8497,
    neighborhood: 'Tell',
    baselinePm25: 42,
  },
  {
    deviceId: '70b3d57ed0060003',
    name: 'Abou Samra Heights',
    latitude: 34.4262,
    longitude: 35.8492,
    neighborhood: 'Abou Samra',
    baselinePm25: 28,
  },
  {
    deviceId: '70b3d57ed0060004',
    name: 'Zahrieh Square',
    latitude: 34.44,
    longitude: 35.843,
    neighborhood: 'Zahrieh',
    baselinePm25: 35,
  },
  {
    deviceId: '70b3d57ed0060005',
    name: 'Qobbeh Market',
    latitude: 34.445,
    longitude: 35.86,
    neighborhood: 'Qobbeh',
    baselinePm25: 48,
  },
  {
    deviceId: '70b3d57ed0060006',
    name: 'Bab al-Tabbaneh',
    latitude: 34.448,
    longitude: 35.852,
    neighborhood: 'Bab al-Tabbaneh',
    baselinePm25: 55,
  },
];
