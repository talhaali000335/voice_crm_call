// POST /api/agent  { question, history }  -> { answer, sources, cached, ms }
import { answerQuestion } from "../../../lib/agent.js";
import { HttpError, json, readBody, route } from "../../../lib/http.js";

export const maxDuration = 60; // allow up to 60 s on hosts that support it (Vercel)

export const POST = route(async (request) => {
  const body = await readBody(request);

  // --- input guard: keep it small and well-shaped ---
  const question = String(body.question || "").trim().slice(0, 500);
  if (!question) throw new HttpError(400, "Say or type a question first.");

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-6) // only the last 6 messages, so the prompt stays short and fast
    .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));

  return json(await answerQuestion(question, history));
});
