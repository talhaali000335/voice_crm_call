// GET /api/health        -> is the server alive?
// GET /api/health?db=1   -> can it also reach MongoDB? (handy when Atlas blocks your IP)
import { connectDB } from "../../../lib/db.js";

export async function GET(request) {
  const checkDb = new URL(request.url).searchParams.get("db");
  if (!checkDb) return Response.json({ ok: true, service: "voice-crm" });
  try {
    await connectDB();
    return Response.json({ ok: true, db: "connected" });
  } catch (err) {
    return Response.json({ ok: false, db: "failed", error: err.message }, { status: 503 });
  }
}
