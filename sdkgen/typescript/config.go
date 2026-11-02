package typescript

func (g *generator) writeConfig() error {
	return g.writeTypeScript("config.gen.ts", generatedHeader+`
/** Transport options shared by generated services. */
export interface ClientConfig {
  /** HTTP(S) origin, without an API path, query or fragment. */
  endpoint: string;
  /** Prepended to the complete contract path. Empty preserves the path.
   * Example: /gateway + /v1/items sends /gateway/v1/items.
   * Supply a leading slash and no trailing slash. */
  basePath?: string;
  protocol?: 'rest' | 'action';
  /** Signed gateway mode; basePath must be empty. */
  innerTOPVersion?: string;
  fetch?: typeof globalThis.fetch;
  authenticate?: (request: Request) => void | Promise<void>;
  timeoutMs?: number;
}

/** Validate once and snapshot caller-supplied transport configuration. */
export function configureClient(config: ClientConfig): Readonly<ClientConfig> {
  let url: URL;
  try { url = new URL(config.endpoint); } catch { throw new Error('sdk: endpoint must be an HTTP(S) origin'); }
  if (!/^https?:\/\/[^\s/?#\\]+\/?$/.test(config.endpoint) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('sdk: endpoint must be an HTTP(S) origin');
  }
  if (config.protocol !== undefined && config.protocol !== 'rest' && config.protocol !== 'action') {
    throw new Error('sdk: protocol must be rest or action');
  }
  const prefix = config.basePath ?? '';
  if (prefix && (prefix === '/' || !prefix.startsWith('/') || prefix.endsWith('/') || /[?#%\\]/.test(prefix) || prefix.includes('//') || prefix.includes('/.'))) {
    throw new Error('sdk: invalid base path');
  }
  if (config.innerTOPVersion && (!config.authenticate || prefix)) {
    throw new Error('sdk: InnerTOP requires signing and cannot use a base path');
  }
  if (config.timeoutMs !== undefined && (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs <= 0)) {
    throw new Error('sdk: timeoutMs must be a positive integer');
  }
  return Object.freeze({ ...config, endpoint: url.origin });
}

/** Compose the origin, caller-supplied mount path and encoded operation path. */
export function requestURL(config: ClientConfig, path: string, query: URLSearchParams): string {
  query.sort();
  return config.endpoint + (config.basePath ?? '') + path + (query.size ? '?' + query.toString() : '');
}
`)
}
