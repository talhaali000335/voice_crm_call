// One small in-memory "notebook" shared by RAG, CAG and KAG.
// It remembers things we already built so we do not rebuild them for every question (low latency).
//
// "version" goes up every time CRM data or documents change. Anything built for an older
// version is thrown away and rebuilt. Everything also expires after 5 minutes (TTL), because on
// serverless hosts (Vercel) each server instance has its own memory and cannot see the others' changes.

const TTL_MS = 5 * 60 * 1000;

const state = (globalThis._ragState ??= {
  version: 0,
  items: new Map(), // name -> { value, version, builtAt }
  answers: new Map(), // normalised question -> { value, builtAt }
});

// Call this after any create/update/delete of customers, deals or documents.
export function bumpVersion() {
  state.version += 1;
  state.answers.clear();
}

// Return the cached value if it is still fresh, otherwise build it with loader() and keep it.
export async function remember(name, loader) {
  const hit = state.items.get(name);
  if (hit && hit.version === state.version && Date.now() - hit.builtAt < TTL_MS) {
    return hit.value;
  }
  const value = await loader();
  state.items.set(name, { value, version: state.version, builtAt: Date.now() });
  return value;
}

// ---- Answer cache: if the same first question is asked again, reply instantly without the LLM ----
export function normaliseQuestion(q) {
  return q.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function getAnswer(key) {
  const hit = state.answers.get(key);
  if (!hit || Date.now() - hit.builtAt > TTL_MS) return null;
  return hit.value;
}

export function setAnswer(key, value) {
  if (state.answers.size >= 200) state.answers.delete(state.answers.keys().next().value); // drop the oldest
  state.answers.set(key, { value, builtAt: Date.now() });
}
