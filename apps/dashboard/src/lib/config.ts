/**
 * Where the dashboard gets its data, decided once from the build environment.
 *
 * - A production build always talks to the live API. The mock is not selectable
 *   there and is not even in the bundle (see services/index.ts).
 * - In development the mock is the default, so `pnpm dev` works with nothing
 *   else running; set VITE_API_URL (or VITE_DATA_SOURCE=api) to use a backend.
 */

import type { DataSourceKind } from '../types';

export interface AppConfig {
  source: DataSourceKind;
  /** REST base, absolute (`http://localhost:3000`) or same-origin (`/api`). */
  apiBase: string;
  /** Socket.IO server; undefined means the page's own origin. */
  socketUrl: string | undefined;
  mapStyle: { light: string; dark: string };
}

export interface ConfigEnv {
  DEV: boolean;
  VITE_DATA_SOURCE?: string;
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
  VITE_MAP_STYLE_LIGHT?: string;
  VITE_MAP_STYLE_DARK?: string;
}

const DEFAULT_API_BASE = '/api';
// OpenFreeMap: open-source vector tiles of OpenStreetMap, no API key. The style
// URLs are configurable so a deployment can point at its own tile server.
const DEFAULT_MAP_LIGHT = 'https://tiles.openfreemap.org/styles/positron';
// "fiord" is a deep blue, which keeps streets readable at night where the
// near-black "dark" style swallowed them.
const DEFAULT_MAP_DARK = 'https://tiles.openfreemap.org/styles/fiord';

function socketUrlFor(apiBase: string, explicit: string | undefined): string | undefined {
  if (explicit) return explicit.replace(/^ws/, 'http');
  // An absolute API URL means the API is on another origin; sockets go there too.
  return /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : undefined;
}

export function resolveConfig(env: ConfigEnv): AppConfig {
  const apiBase = (env.VITE_API_URL || DEFAULT_API_BASE).replace(/\/$/, '');
  const wantsMock =
    env.VITE_DATA_SOURCE === 'mock' || (env.VITE_DATA_SOURCE !== 'api' && !env.VITE_API_URL);

  return {
    source: env.DEV && wantsMock ? 'mock' : 'api',
    apiBase,
    socketUrl: socketUrlFor(apiBase, env.VITE_WS_URL),
    mapStyle: {
      light: env.VITE_MAP_STYLE_LIGHT || DEFAULT_MAP_LIGHT,
      dark: env.VITE_MAP_STYLE_DARK || DEFAULT_MAP_DARK,
    },
  };
}

export const config: AppConfig = resolveConfig(import.meta.env);
