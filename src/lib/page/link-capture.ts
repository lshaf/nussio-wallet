const SCHEMES = ['esr:', 'esr-anchor:', 'anchor:'];
const FLAG = '__nussioLinkCapture';

export const MESSAGE_SOURCE = 'nussio-wallet';

export function isRequestUri(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return SCHEMES.some((scheme) => lower.startsWith(scheme));
}

function post(uri: string): void {
  window.postMessage({ source: MESSAGE_SOURCE, type: 'request', uri }, '*');
}

function uriFromEvent(event: Event): string | undefined {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;
    const anchor = node.closest('a[href]');
    if (!anchor) continue;
    const href = anchor.getAttribute('href') ?? '';
    return isRequestUri(href) ? href : undefined;
  }
  return undefined;
}

function onClick(event: Event): void {
  if (!event.isTrusted) return;
  const uri = uriFromEvent(event);
  if (!uri) return;
  event.preventDefault();
  post(uri);
}

export function installLinkCapture(): void {
  const scope = window as unknown as Record<string, unknown>;
  if (scope[FLAG]) return;
  scope[FLAG] = true;

  const attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function patched(init: ShadowRootInit): ShadowRoot {
    const root = attachShadow.call(this, init);
    root.addEventListener('click', onClick, true);
    return root;
  };

  const open = window.open.bind(window);
  window.open = function patched(
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null {
    const href = typeof url === 'string' ? url : (url?.toString() ?? '');
    if (isRequestUri(href)) {
      post(href);
      return null;
    }
    return open(url, target, features);
  };
}
