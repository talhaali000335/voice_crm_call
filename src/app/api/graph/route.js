// GET  /api/graph -> list graph facts (KAG)
// POST /api/graph -> rebuild the graph from customers and deals
import { Edge } from "../../../lib/models.js";
import { rebuildGraph } from "../../../lib/kag.js";
import { json, route } from "../../../lib/http.js";

export const GET = route(async () => {
  const edges = await Edge.find().limit(500).lean();
  return json({ edges });
});

export const POST = route(async () => {
  const count = await rebuildGraph();
  return json({ count });
});
