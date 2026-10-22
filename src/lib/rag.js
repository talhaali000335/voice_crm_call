// RAG = Retrieval-Augmented Generation.
// Idea: do not make the AI remember everything. When a question arrives, SEARCH our notes,
// find the few most relevant pieces, and hand only those to the AI as "open-book" help.
//
// Steps in this file:
//   1) chunkText()   cut a long document into small pieces (about 500 characters)
//   2) buildIndex()  load all pieces (documents + customer notes) and count words
//   3) ragSearch()   score every piece against the question with BM25 and return the best few
//
// BM25 is a classic keyword ranking formula (the same idea behind search engines).
// It needs no embedding API, so it is free and fast. Upgrade path: MongoDB Atlas Vector Search.
import { Chunk, Customer } from "./models.js";
import { remember } from "./cache.js";

// ---------- 1) chunking ----------
export function chunkText(text, max = 500) {
  // split into paragraphs; split any very long paragraph into sentences
  const parts = text
    .split(/\n\s*\n/)
    .flatMap((p) => (p.length > max ? p.split(/(?<=[.!?])\s+/) : [p]));

  const chunks = [];
  let current = "";
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (current && current.length + p.length + 1 > max) {
      chunks.push(current); // current piece is full -> start a new one
      current = p;
    } else {
      current = current ? current + " " + p : p; // still room -> keep adding
    }
  }
  if (current) chunks.push(current);

  // safety: a single huge sentence is cut by force so no chunk is giant
  return chunks.flatMap((c) => (c.length > max * 2 ? c.match(new RegExp(`.{1,${max}}`, "gs")) : [c]));
}

// ---------- words ----------
const STOP = new Set(
  "a an the and or but if of to in on at for from by with about as is are was were be been it its this that these those i you he she we they me my your our their do does did what who whom when where why how can could should would will please tell give show have has had not no yes".split(
    " "
  )
);

export function tokenize(text) {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return words.filter((w) => w.length > 1 && !STOP.has(w));
}

// ---------- 2) the index ----------
async function buildIndex() {
  const [chunks, customers] = await Promise.all([
    Chunk.find().limit(5000).lean(),
    Customer.find({ notes: { $ne: "" } }).limit(2000).lean(),
  ]);

  // customer notes are searchable too, so "what did Ali say about pricing?" works
  const pieces = [
    ...chunks.map((c) => ({ title: c.title, text: c.text })),
    ...customers.map((c) => ({ title: `Customer note: ${c.name}`, text: `${c.name} (${c.company || "no company"}): ${c.notes}` })),
  ];

  const docs = pieces.map((p) => {
    const tokens = tokenize(p.title + " " + p.text);
    const tf = new Map(); // term frequency: how many times each word appears in this piece
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return { ...p, tf, len: tokens.length };
  });

  const df = new Map(); // document frequency: in how many pieces does each word appear?
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);

  const avgLen = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1);
  return { docs, df, avgLen };
}

// ---------- 3) search ----------
export async function ragSearch(question, k = 4) {
  const index = await remember("rag-index", buildIndex);
  const terms = [...new Set(tokenize(question))];
  if (!terms.length || !index.docs.length) return [];

  const N = index.docs.length;
  const k1 = 1.5; // how fast repeated words stop mattering
  const b = 0.75; // how much long pieces are penalised

  const scored = index.docs.map((d) => {
    let score = 0;
    for (const t of terms) {
      const f = d.tf.get(t);
      if (!f) continue;
      const n = index.df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5)); // rare words count more
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / index.avgLen)));
    }
    return { title: d.title, text: d.text, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, c) => c.score - a.score)
    .slice(0, k)
    .map((s) => ({ ...s, score: Math.round(s.score * 100) / 100 }));
}
