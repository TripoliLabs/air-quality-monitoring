/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `mock` or `api`. Development only; a production build always uses the API. */
  readonly VITE_DATA_SOURCE?: string;
  /** REST base URL. Defaults to same-origin `/api`. */
  readonly VITE_API_URL?: string;
  /** Socket.IO server. Defaults to the API's origin. */
  readonly VITE_WS_URL?: string;
  readonly VITE_MAP_STYLE_LIGHT?: string;
  readonly VITE_MAP_STYLE_DARK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
