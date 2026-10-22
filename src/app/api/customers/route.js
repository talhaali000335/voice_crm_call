// GET  /api/customers  -> list customers (newest first)
// POST /api/customers  -> create one
import { Customer } from "../../../lib/models.js";
import { rebuildGraph } from "../../../lib/kag.js";
import { json, readBody, route } from "../../../lib/http.js";

export const GET = route(async () => {
  const customers = await Customer.find().sort({ createdAt: -1 }).limit(200).lean();
  return json({ customers });
});

export const POST = route(async (request) => {
  const body = await readBody(request);
  // pick only the fields we allow (never trust the whole body)
  const { name, company, email, phone, status, notes } = body;
  const customer = await Customer.create({ name, company, email, phone, status, notes });
  await rebuildGraph(); // keep the knowledge graph (KAG) and caches in sync
  return json({ customer }, 201);
});
