import crypto from 'node:crypto';
import { InternalServiceClient } from '@chirpstack/chirpstack-api/api/internal_grpc_pb';
import { LoginRequest } from '@chirpstack/chirpstack-api/api/internal_pb';
import { credentials } from '@grpc/grpc-js';
import type { DeviceCredentials } from './lorawan';

const JOIN_EUI = '0102030405060708';

export interface DeviceFixture {
  deviceId: string; // DevEUI
  name: string;
}

export interface ProvisionOptions {
  grpcAddr: string;
  restBase: string;
  user: string;
  pass: string;
  gatewayEui: string;
  fixtures: DeviceFixture[];
  existingCreds: Record<string, Omit<DeviceCredentials, 'devEui'>>;
}

export interface Provisioned {
  applicationId: string;
  gatewayEui: string;
  devices: DeviceCredentials[];
}

/** Get a JWT via the InternalService gRPC login (the only RPC not exposed over REST). */
function login(grpcAddr: string, email: string, password: string): Promise<string> {
  const client = new InternalServiceClient(grpcAddr, credentials.createInsecure());
  const req = new LoginRequest();
  req.setEmail(email);
  req.setPassword(password);
  return new Promise((resolve, reject) => {
    client.login(req, (err, resp) =>
      err || !resp ? reject(err ?? new Error('no login response')) : resolve(resp.getJwt()),
    );
  });
}

function genCreds(): Omit<DeviceCredentials, 'devEui'> {
  return { joinEui: JOIN_EUI, appKey: crypto.randomBytes(16).toString('hex') };
}

/** REST helper against the chirpstack-rest-api gateway. 409 (AlreadyExists) is tolerated. */
async function rest<T = Record<string, unknown>>(
  base: string,
  jwt: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  // Idempotent creates: ChirpStack returns 409 for some resources, but a plain
  // 500 with a unique-constraint violation for others (e.g. gateways) when the
  // resource already exists. Treat both as success so re-provisioning is safe.
  if (res.status === 409 || /duplicate key|already exists/i.test(text)) return {} as T;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

interface ListResult {
  result?: Array<{ id: string; name: string }>;
}

/** Idempotently provision the application, OTAA device-profile, gateway and devices (with keys). */
export async function provision(opts: ProvisionOptions): Promise<Provisioned> {
  const jwt = await login(opts.grpcAddr, opts.user, opts.pass);

  const tenants = await rest<ListResult>(opts.restBase, jwt, 'GET', '/api/tenants?limit=10');
  const tenantId = tenants.result?.[0]?.id;
  if (!tenantId) throw new Error('no default tenant found');

  // Application
  const apps = await rest<ListResult>(
    opts.restBase,
    jwt,
    'GET',
    `/api/applications?limit=100&tenantId=${tenantId}`,
  );
  let applicationId = apps.result?.find((a) => a.name === 'Air Quality')?.id;
  if (!applicationId) {
    const created = await rest<{ id: string }>(opts.restBase, jwt, 'POST', '/api/applications', {
      application: { name: 'Air Quality', description: 'Tripoli air-quality nodes', tenantId },
    });
    applicationId = created.id;
  }

  // Device profile (EU868, LoRaWAN 1.0.3, OTAA, Class A)
  const dps = await rest<ListResult>(
    opts.restBase,
    jwt,
    'GET',
    `/api/device-profiles?limit=100&tenantId=${tenantId}`,
  );
  let deviceProfileId = dps.result?.find((d) => d.name === 'AQ Node OTAA')?.id;
  if (!deviceProfileId) {
    const created = await rest<{ id: string }>(opts.restBase, jwt, 'POST', '/api/device-profiles', {
      deviceProfile: {
        name: 'AQ Node OTAA',
        tenantId,
        region: 'EU868',
        macVersion: 'LORAWAN_1_0_3',
        regParamsRevision: 'A',
        supportsOtaa: true,
        uplinkInterval: 30,
        deviceStatusReqInterval: 1,
      },
    });
    deviceProfileId = created.id;
  }

  // Gateway
  await rest(opts.restBase, jwt, 'POST', '/api/gateways', {
    gateway: { gatewayId: opts.gatewayEui, name: 'AQ Gateway', tenantId, statsInterval: 30 },
  });

  // Devices + OTAA keys (root AppKey lives in the 1.0.x `nwkKey` slot)
  const devices: DeviceCredentials[] = [];
  for (const f of opts.fixtures) {
    const creds = opts.existingCreds[f.deviceId] ?? genCreds();

    await rest(opts.restBase, jwt, 'POST', '/api/devices', {
      device: {
        devEui: f.deviceId,
        name: f.name,
        applicationId,
        deviceProfileId,
        joinEui: creds.joinEui,
        skipFcntCheck: false,
      },
    });

    await rest(opts.restBase, jwt, 'POST', `/api/devices/${f.deviceId}/keys`, {
      deviceKeys: { devEui: f.deviceId, nwkKey: creds.appKey },
    });

    devices.push({ devEui: f.deviceId, ...creds });
  }

  return { applicationId, gatewayEui: opts.gatewayEui, devices };
}
