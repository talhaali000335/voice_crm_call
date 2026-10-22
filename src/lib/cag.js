// CAG = Cache-Augmented Generation.
// Idea: some knowledge is small and always needed (opening hours, refund policy, pricing).
// Do NOT search for it each time. Load it ONCE, keep it ready in memory, and put it at the
// very start of every prompt. Because that start never changes, LLM providers can also reuse
// their own prompt cache for it, which lowers latency and cost.
//
// In this app: any document marked "pinned" on the Knowledge page becomes CAG knowledge.
import { Doc } from "./models.js";
import { remember } from "./cache.js";

const MAX_CHARS = 6000; // keep the always-loaded part small so replies stay fast

export async function getCag() {
  return remember("cag", async () => {
    const pinned = await Doc.find({ pinned: true }).sort({ createdAt: 1 }).lean();
    let text = "";
    const titles = [];
    for (const d of pinned) {
      const block = `## ${d.title}\n${d.content.trim()}\n\n`;
      if (text.length + block.length > MAX_CHARS) break; // stop before it gets too big
      text += block;
      titles.push(d.title);
    }
    return { text: text.trim(), titles, limit: MAX_CHARS, used: text.length };
  });
}
