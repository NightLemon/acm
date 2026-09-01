import { useState, useEffect } from 'react';

// Statements live as one JSON file per problem under public/statements/ and are
// fetched on demand the first time a problem is expanded. Missing files are an
// expected state (fetch may not have been run, or may have failed for one problem),
// so callers get an explicit `missing` flag rather than an error.
const cache = new Map();
const inflight = new Map();

function load(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (inflight.has(id)) return inflight.get(id);

  const p = fetch(`${import.meta.env.BASE_URL}statements/${id}.json`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      cache.set(id, data);
      inflight.delete(id);
      return data;
    });

  inflight.set(id, p);
  return p;
}

export function useStatement(id, enabled) {
  const [state, setState] = useState(() =>
    cache.has(id) ? { loading: false, data: cache.get(id) } : { loading: false, data: undefined }
  );

  useEffect(() => {
    if (!enabled || !id) return;
    if (cache.has(id)) {
      setState({ loading: false, data: cache.get(id) });
      return;
    }
    let alive = true;
    setState({ loading: true, data: undefined });
    load(id).then((data) => { if (alive) setState({ loading: false, data }); });
    return () => { alive = false; };
  }, [id, enabled]);

  return { ...state, missing: !state.loading && state.data === null };
}
