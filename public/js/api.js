import { t } from './i18n.js';

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Prefer the localized message for the server's error code; fall back to
    // the server-provided text, then to a generic message.
    const localized = data.code && t(`err.${data.code}`, null);
    throw new Error(localized || data.error || `${t('err.server')} (${res.status})`);
  }
  return data;
}

export function addMemory({ author, title, body }) {
  return request('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, title, body }),
  });
}

export function randomMemory(excludeId) {
  const q = excludeId ? `?exclude=${excludeId}` : '';
  return request(`/api/memories/random${q}`);
}
