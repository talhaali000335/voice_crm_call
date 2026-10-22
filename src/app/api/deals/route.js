// GET  /api/deals -> list deals with the customer name
// POST /api/deals -> create a deal for a customer
import { Customer, Deal } from "../../../lib/models.js";
import { rebuildGraph } from "../../../lib/kag.js";
import { HttpError, json, readBody, route } from "../../../lib/http.js";

export const GET = route(async () => {
  const deals = await Deal.find().sort({ createdAt: -1 }).limit(300).populate("customer", "name company").lean();
  return json({ deals });
});

export const POST = route(async (request) => {
  const { customer, title, value, stage } = await readBody(request);
  if (!(await Customer.exists({ _id: customer }))) throw new HttpError(400, "Pick a valid customer.");
  const deal = await Deal.create({ customer, title, value: Number(value) || 0, stage });
  await rebuildGraph();
  return json({ deal }, 201);
});
