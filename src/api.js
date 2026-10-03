// Calls to our own server (server/index.js).
async function call(url, init) {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error(`No API at ${url} (got ${res.status}). Stop python http.server and run: npm start`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  get: (url) => call(url),
  post: (url, body) => call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }),
  patch: (url, body) => call(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  stt: (blob) => call('/api/stt', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }),
};
