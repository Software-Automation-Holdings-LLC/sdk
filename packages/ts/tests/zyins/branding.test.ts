import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';

describe('ZyInsClient.branding.lookup', () => {
  it('GETs /v1/branding and parses snake_case fields', async () => {
    const body = JSON.stringify({
      imo_name: 'Acme Agency',
      imo_logo: 'https://cdn.example/logo.png',
      nav_color: '#111',
      main_color: '#222',
      button_color: '#333',
      active_button_color: '#444',
      bg_color: '#555',
      header_text_color: '#666',
      hide_affiliate_leads: 'true',
      prevent_product_selection: false,
      default_settings: 'foo',
    });
    const { transport, requests } = recordingTransport(200, body);
    const result = await client(transport).branding.lookup();
    expect(result.imoName).toBe('Acme Agency');
    expect(result.imoLogo).toBe('https://cdn.example/logo.png');
    expect(result.hideAffiliateLeads).toBe(true);
    expect(result.preventProductSelection).toBe(false);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/v1/branding');
  });

  it('accepts the ADR-012 enveloped shape', async () => {
    const body = JSON.stringify({ data: { imo_name: 'Wrapped Co' } });
    const { transport } = recordingTransport(200, body);
    const result = await client(transport).branding.lookup();
    expect(result.imoName).toBe('Wrapped Co');
    expect(result.imoLogo).toBe('');
  });

  it('returns zero values when the row is empty (no 404)', async () => {
    const { transport } = recordingTransport(200, '{}');
    const result = await client(transport).branding.lookup();
    expect(result.imoName).toBe('');
    expect(result.hideAffiliateLeads).toBe(false);
  });

  it('returns zero values when the success body is empty', async () => {
    const { transport } = recordingTransport(200, '');
    const result = await client(transport).branding.lookup();
    expect(result.imoName).toBe('');
    expect(result.hideAffiliateLeads).toBe(false);
  });

  it('throws a clear error when the success body is invalid JSON', async () => {
    const { transport } = recordingTransport(200, '{');
    await expect(client(transport).branding.lookup()).rejects.toThrow(/not valid JSON/);
  });

  it('maps 401 to a typed error', async () => {
    const { transport } = recordingTransport(
      401,
      JSON.stringify({ type: 'about:blank', title: 'unauthorized', status: 401, code: 'unauthorized' }),
    );
    await expect(client(transport).branding.lookup()).rejects.toBeInstanceOf(Error);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server error', status: 500, code: 'server_error' }),
    );
    await expect(client(transport).branding.lookup()).rejects.toBeInstanceOf(Error);
  });
});
