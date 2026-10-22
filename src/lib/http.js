// Small helpers so every API route answers in the same way.
import { connectDB } from "./db.js";
import { LLMError } from "./llm.js";

export const json = (data, status = 200) => Response.json(data, { status });

// Wrap a route: connect to the database first, and turn any error into a clean JSON reply.
export function route(handler) {
  return async (request, context) => {
    try {
      await connectDB();
      return await handler(request, context);
    } catch (err) {
      if (err.name === "ValidationError" || err.name === "CastError") {
        return json({ error: "Invalid input: " + err.message }, 400);
      }
      if (err instanceof LLMError) return json({ error: err.message }, 502);
      if (err.status) return json({ error: err.message }, err.status);
      console.error(err); // full detail stays in the server log only
      return json({ error: "Server error. Check the terminal for details." }, 500);
    }
  };
}

// Throw this inside a handler to return a specific status (e.g. 404).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Read the JSON body safely.
export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON.");
  }
}
