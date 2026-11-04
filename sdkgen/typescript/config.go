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
  /** Replace a contract path prefix with an HTTP(S) URL or an origin-relative path.
   * The longest whole-segment match wins; basePath applies to unmatched paths. */
  mounts?: Readonly<Record<string, string>>;
  protocol?: 'rest' | 'action';
  /** Signed gateway mode; basePath must be empty. */
  innerTOPVersion?: string;
  fetch?: typeof globalThis.fetch;
  authenticate?: (request: Request) => void | Promise<void>;
  /** Default 30 seconds. null delegates cancellation to the caller. */
  timeoutMs?: number | null;
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
  if (config.innerTOPVersion && (!config.authenticate || prefix || Object.keys(config.mounts ?? {}).length)) {
    throw new Error('sdk: InnerTOP requires signing and cannot use a base path');
  }
  if (config.timeoutMs != null && (!Number.isSafeInteger(config.timeoutMs) || config.timeoutMs <= 0)) {
    throw new Error('sdk: timeoutMs must be a positive integer');
  }
  const mounts: Record<string, string> = {};
  for (const [source, target] of Object.entries(config.mounts ?? {}).sort(([a], [b]) => b.length - a.length)) {
    if (!/^\/(?:[^/?#%\\]+(?:\/[^/?#%\\]+)*)?$/.test(source) || source.includes('/.')) throw new Error('sdk: invalid mount prefix');
    if ((!/^https?:\/\//i.test(target) && !/^\/(?!\/)/.test(target)) || /[?#\\\s]/.test(target)) throw new Error('sdk: invalid mount target');
    const base = new URL(target, url.origin);
    if (base.username || base.password) throw new Error('sdk: invalid mount credentials');
    mounts[source] = base.href.replace(/\/+$/, '');
  }
  return Object.freeze({ ...config, endpoint: url.origin, mounts: Object.freeze(mounts) });
}

/** Compose the origin, caller-supplied mount path and encoded operation path. */
export function requestURL(config: ClientConfig, path: string, query: URLSearchParams): string {
  query.sort();
  const suffix = query.size ? '?' + query.toString() : '';
  for (const [source, target] of Object.entries(config.mounts ?? {})) {
    if (source === '/') return target + path + suffix;
    if (source === path || path.startsWith(source + '/')) return target + path.slice(source.length) + suffix;
  }
  return config.endpoint + (config.basePath ?? '') + path + suffix;
}
`)
}
