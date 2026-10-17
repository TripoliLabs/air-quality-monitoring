import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/lib/config';

describe('data source', () => {
  it('a production build uses the API, on its own origin by default', () => {
    const config = resolveConfig({ DEV: false });
    expect(config.source).toBe('api');
    expect(config.apiBase).toBe('/api');
    expect(config.socketUrl).toBeUndefined();
  });

  it('a production build cannot be switched to the mock', () => {
    expect(resolveConfig({ DEV: false, VITE_DATA_SOURCE: 'mock' }).source).toBe('api');
  });

  it('development defaults to the mock when no API is configured', () => {
    expect(resolveConfig({ DEV: true }).source).toBe('mock');
  });

  it('development uses the API once an API URL is set', () => {
    const config = resolveConfig({ DEV: true, VITE_API_URL: 'http://localhost:3000/' });
    expect(config.source).toBe('api');
    expect(config.apiBase).toBe('http://localhost:3000');
    expect(config.socketUrl).toBe('http://localhost:3000');
  });

  it('development can force either source', () => {
    expect(resolveConfig({ DEV: true, VITE_DATA_SOURCE: 'api' }).source).toBe('api');
    expect(
      resolveConfig({ DEV: true, VITE_DATA_SOURCE: 'mock', VITE_API_URL: 'http://x' }).source,
    ).toBe('mock');
  });

  it('accepts a ws:// socket URL', () => {
    expect(resolveConfig({ DEV: false, VITE_WS_URL: 'ws://localhost:3000' }).socketUrl).toBe(
      'http://localhost:3000',
    );
    expect(resolveConfig({ DEV: false, VITE_WS_URL: 'wss://air.example' }).socketUrl).toBe(
      'https://air.example',
    );
  });
});
