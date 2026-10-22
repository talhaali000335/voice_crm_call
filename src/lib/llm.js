// Talks to the Groq API (free tier). Groq speaks the "OpenAI chat" format, so this is a plain fetch().
export class LLMError extends Error {}

export async function chat(messages) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LLMError("GROQ_API_KEY is missing. Add it to .env.local (server side only).");

  const base = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  const body = {
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    messages,
    temperature: 0.2, // low = calm, factual answers
    max_completion_tokens: 1500, // thinking models spend part of this on "thoughts", so keep room
  };
  if (process.env.GROQ_REASONING_EFFORT) body.reasoning_effort = process.env.GROQ_REASONING_EFFORT;

  // never wait forever: stop after 30 seconds
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new LLMError(err.name === "AbortError" ? "The AI took too long to answer." : "Could not reach the AI service.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300); // short, and it never contains our key
    throw new LLMError(`AI service error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new LLMError("The AI returned an empty answer.");
  return text;
}
