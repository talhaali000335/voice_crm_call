// KAG = Knowledge-Graph-Augmented Generation.
// Idea: facts are connected like a map. "Ali works at Acme", "Ali has the Website deal",
// "Website deal is in negotiation". Plain search finds text; a graph FOLLOWS the connections,
// so the AI can answer questions that need several linked facts.
//
// Each fact is one Edge:  source --relation--> target
// We build the edges automatically from Customers and Deals (rebuildGraph), then at question time:
//   1) find which names appear in the question   (entity linking)
//   2) walk 1-2 steps along the edges             (graph traversal)
//   3) give those facts to the AI as short lines
import { Customer, Deal, Edge } from "./models.js";
import { bumpVersion, remember } from "./cache.js";

// ---------- build the graph from CRM data ----------
export async function rebuildGraph() {
  const [customers, deals] = await Promise.all([Customer.find().lean(), Deal.find().lean()]);
  const byId = new Map(customers.map((c) => [String(c._id), c]));

  const edges = [];
  for (const c of customers) {
    if (c.company) edges.push({ source: c.name, relation: "works_at", target: c.company });
    edges.push({ source: c.name, relation: "has_status", target: c.status });
  }
  for (const d of deals) {
    const c = byId.get(String(d.customer));
    if (!c) continue; // deal whose customer was deleted
    edges.push({ source: c.name, relation: "has_deal", target: d.title });
    edges.push({ source: d.title, relation: "is_in_stage", target: d.stage });
    edges.push({ source: d.title, relation: "is_worth", target: `$${d.value}` });
  }

  await Edge.deleteMany({}); // simple and safe for small data: wipe and rebuild
  if (edges.length) await Edge.insertMany(edges);
  bumpVersion(); // tell the caches that data changed
  return edges.length;
}

// ---------- ask the graph ----------
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function kagFacts(question, maxFacts = 30) {
  const edges = await remember("edges", () => Edge.find().limit(5000).lean());
  if (!edges.length) return [];

  // 1) entity linking: which node names appear in the question as whole words?
  const nodes = new Set();
  for (const e of edges) {
    nodes.add(e.source);
    nodes.add(e.target);
  }
  const linked = new Set();
  for (const name of nodes) {
    if (name.length < 3 || name.startsWith("$")) continue;
    if (new RegExp(`\\b${escapeRegex(name)}\\b`, "i").test(question)) linked.add(name);
  }
  if (!linked.size) return [];

  // 2) step 1: every edge touching a linked name
  const hop1 = edges.filter((e) => linked.has(e.source) || linked.has(e.target));

  // step 2: from the new neighbours, follow outgoing edges (customer -> deal -> stage/value)
  const neighbours = new Set();
  for (const e of hop1) {
    if (!linked.has(e.source)) neighbours.add(e.source);
    if (!linked.has(e.target)) neighbours.add(e.target);
  }
  const hop2 = edges.filter((e) => neighbours.has(e.source) && !hop1.includes(e));

  // 3) turn edges into short readable lines, without duplicates
  const lines = new Set();
  for (const e of [...hop1, ...hop2]) lines.add(`${e.source} -${e.relation}-> ${e.target}`);
  return [...lines].slice(0, maxFacts);
}
