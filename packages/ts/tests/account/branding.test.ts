import { describe, expect, it } from 'vitest';
import { account, recordingTransport } from './helpers';

describe('isa.account.branding.lookup', () => {
  it('GETs /v1/branding with License-HMAC headers and parses the response', async () => {
    const body = JSON.stringify({
      imo_name: 'Acme Agency',
      imo_logo: 'https://cdn.example/logo.png',
      primary_color: '#111',
      nav_color: '#222',
      bg_color: '#333',
      button_color: '#444',
      active_button_color: '#555',
      header_text_color: '#666',
      hide_affiliate_leads: 'true',
      prevent_product_selection: false,
      default_settings: 'foo',
    });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).branding.lookup();
    expect(result.imoName).toBe('Acme Agency');
    expect(result.primaryColor).toBe('#111');
    expect(result.hideAffiliateLeads).toBe(true);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/v1/branding');
    expect(requests[0]!.headers).toHaveProperty('X-Device-Signature');
  });

  it('forwards the optional source query parameter', async () => {
    const { transport, requests } = recordingTransport(200, '{}');
    await account(transport).branding.lookup({ source: 'mountain-life' });
    expect(requests[0]!.url).toBe('https://test.example/v1/branding?source=mountain-life');
  });

  it('falls back to main_color when primary_color is absent', async () => {
    const body = JSON.stringify({ imo_name: 'X', main_color: '#abc' });
    const { transport } = recordingTransport(200, body);
    const result = await account(transport).branding.lookup();
    expect(result.primaryColor).toBe('#abc');
  });

  it('accepts the enveloped { data: {...} } shape', async () => {
    const body = JSON.stringify({ data: { imo_name: 'Wrapped Co' } });
    const { transport } = recordingTransport(200, body);
    const result = await account(transport).branding.lookup();
    expect(result.imoName).toBe('Wrapped Co');
  });

  it('returns zero values when the row is empty (200 with empty body)', async () => {
    const { transport } = recordingTransport(200, '');
    const result = await account(transport).branding.lookup();
    expect(result.imoName).toBe('');
    expect(result.hideAffiliateLeads).toBe(false);
  });

  it('wraps invalid JSON response errors with context', async () => {
    const { transport } = recordingTransport(200, '<html>bad gateway</html>');
    await expect(account(transport).branding.lookup()).rejects.toThrow(
      /branding response was not valid JSON/,
    );
  });

  it('returns zero values when the response envelope is not an object', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ data: 1 }));
    const result = await account(transport).branding.lookup();
    expect(result).toEqual({
      imoName: '',
      imoLogo: '',
      primaryColor: '',
      navColor: '',
      bgColor: '',
      buttonColor: '',
      activeButtonColor: '',
      headerTextColor: '',
      hideAffiliateLeads: false,
      preventProductSelection: false,
      defaultSettings: '',
    });
  });

  it('maps 401 to a typed error', async () => {
    const { transport } = recordingTransport(
      401,
      JSON.stringify({ type: 'about:blank', title: 'unauthorized', status: 401, code: 'unauthorized' }),
    );
    await expect(account(transport).branding.lookup()).rejects.toBeInstanceOf(Error);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server error', status: 500, code: 'server_error' }),
    );
    await expect(account(transport).branding.lookup()).rejects.toBeInstanceOf(Error);
  });
});
