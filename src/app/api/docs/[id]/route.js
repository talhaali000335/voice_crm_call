// DELETE /api/docs/:id -> remove a document and its chunks
import { Chunk, Doc } from "../../../../lib/models.js";
import { bumpVersion } from "../../../../lib/cache.js";
import { HttpError, json, route } from "../../../../lib/http.js";

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const doc = await Doc.findByIdAndDelete(id);
  if (!doc) throw new HttpError(404, "Document not found");
  await Chunk.deleteMany({ doc: id });
  bumpVersion();
  return json({ ok: true });
});
