// GET  /api/docs -> list knowledge documents
// POST /api/docs -> add a document (it is cut into chunks for RAG; pinned=true makes it CAG knowledge)
import { Chunk, Doc } from "../../../lib/models.js";
import { chunkText } from "../../../lib/rag.js";
import { bumpVersion } from "../../../lib/cache.js";
import { HttpError, json, readBody, route } from "../../../lib/http.js";

export const GET = route(async () => {
  const docs = await Doc.find().sort({ createdAt: -1 }).limit(200).lean();
  return json({ docs });
});

export const POST = route(async (request) => {
  const { title, content, pinned } = await readBody(request);
  const pieces = chunkText(String(content || ""));
  if (!pieces.length) throw new HttpError(400, "Content is empty.");

  const doc = await Doc.create({ title, content, pinned: Boolean(pinned), chunkCount: pieces.length });
  await Chunk.insertMany(pieces.map((text) => ({ doc: doc._id, title: doc.title, text })));
  bumpVersion(); // caches must rebuild so the new document is used
  return json({ doc }, 201);
});
