// PATCH  /api/deals/:id -> move a deal to another stage
// DELETE /api/deals/:id -> delete a deal
import { Deal } from "../../../../lib/models.js";
import { rebuildGraph } from "../../../../lib/kag.js";
import { HttpError, json, readBody, route } from "../../../../lib/http.js";

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const { stage } = await readBody(request);
  const deal = await Deal.findByIdAndUpdate(id, { stage }, { new: true, runValidators: true });
  if (!deal) throw new HttpError(404, "Deal not found");
  await rebuildGraph();
  return json({ deal });
});

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const deal = await Deal.findByIdAndDelete(id);
  if (!deal) throw new HttpError(404, "Deal not found");
  await rebuildGraph();
  return json({ ok: true });
});
