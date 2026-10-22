// PATCH  /api/customers/:id  -> change status or notes
// DELETE /api/customers/:id  -> delete the customer and their deals
import { Customer, Deal } from "../../../../lib/models.js";
import { rebuildGraph } from "../../../../lib/kag.js";
import { HttpError, json, readBody, route } from "../../../../lib/http.js";

export const PATCH = route(async (request, { params }) => {
  const { id } = await params; // in Next.js 16 params is a Promise
  const { status, notes } = await readBody(request);
  const update = {};
  if (status !== undefined) update.status = status;
  if (notes !== undefined) update.notes = notes;
  const customer = await Customer.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!customer) throw new HttpError(404, "Customer not found");
  await rebuildGraph();
  return json({ customer });
});

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const customer = await Customer.findByIdAndDelete(id);
  if (!customer) throw new HttpError(404, "Customer not found");
  await Deal.deleteMany({ customer: id });
  await rebuildGraph();
  return json({ ok: true });
});
