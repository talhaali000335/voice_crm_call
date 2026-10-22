# Voice CRM Agent

A small CRM with a **voice agent** you can talk to. Built with **Next.js + React**, **Node.js API routes**, **MongoDB Atlas (free)** and **Groq (free tier)**.
The agent answers using three techniques: **RAG**, **CAG** and **KAG**.

Exactly **3 pages**:

| Page | URL | What it does |
|---|---|---|
| Dashboard | `/` | Add customers and deals, see numbers |
| Voice Agent | `/agent` | Start a "call", talk, hear answers, see where each answer came from |
| Knowledge | `/knowledge` | Add documents (RAG / CAG) and see the knowledge graph (KAG) |

---

## Run it: step by step (Windows / PowerShell)

### Step 1. Install the packages
Needs **Node.js 20.9 or newer** (`node -v` to check). Use **Chrome or Edge** for voice.
```powershell
cd voice-crm
npm install
```

### Step 2. Create a free MongoDB database (Atlas)
1. Sign up at https://www.mongodb.com/cloud/atlas and create a **free (M0)** cluster.
2. **Database Access** -> Add user -> pick a username and password (use letters and numbers only, it avoids URL problems).
3. **Network Access** -> Add IP address -> *Allow access from anywhere* (`0.0.0.0/0`). Fine for learning; Vercel also needs this.
4. **Connect** -> **Drivers** -> copy the string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Put your database name before the `?`: `...mongodb.net/voicecrm?retryWrites=...` and replace `USER` / `PASSWORD`.

### Step 3. Get your Groq key
Create a key at https://console.groq.com/keys (free tier).

### Step 4. Put the secrets in `.env.local`
```powershell
Copy-Item .env.example .env.local
code .env.local
```
Fill in `MONGODB_URI` and `GROQ_API_KEY`. **Never** paste keys into code files, and never commit `.env.local` (it is already in `.gitignore`).

### Step 5. Load sample data (optional but recommended)
```powershell
npm run seed
```
Creates 3 customers, 4 deals, 4 documents and the graph, so you can ask questions right away.

### Step 6. Start the app
```powershell
npm run dev
```
Open http://localhost:3000. To check the database connection, open http://localhost:3000/api/health?db=1 (it should say `"db":"connected"`).

### Step 7. Talk to it
Open **Voice Agent**, press **Start call**, allow the microphone, and say:

| Say this | Technique used |
|---|---|
| "What is the refund policy?" | **CAG** (pinned document, always loaded) |
| "What discount do I get for 50 seats?" | **RAG** (searches the Pricing document) |
| "Tell me about Ali Khan" | **KAG** (follows links: Ali -> Acme -> deals -> stage) + **RAG** (his notes) |
| "Who works at Acme Corp?" | **KAG** |

The right-hand panel shows exactly which knowledge was used. No microphone? Type in the box instead.

### Step 8. Put it online (Vercel + GitHub)
1. `git init`, `git add .`, `git commit -m "voice crm"`, push to a new GitHub repo (check `git status` first: `.env.local` must NOT be listed).
2. On https://vercel.com import the repo. Framework is detected as Next.js.
3. Add the environment variables `MONGODB_URI`, `GROQ_API_KEY`, `GROQ_MODEL` in **Settings -> Environment Variables**, then deploy.
4. Microphone access needs **https** (Vercel provides it) or `localhost`.

---

## RAG, CAG, KAG in simple words

Imagine the AI is a new employee on day one. It knows nothing about your company. You can help it in three ways:

| | Idea | Like... | In this app |
|---|---|---|---|
| **RAG** (Retrieval-Augmented Generation) | Search your notes, give the AI only the best few pieces | Looking things up in a filing cabinet for each question | `src/lib/rag.js`: documents are cut into ~500-character chunks, ranked with **BM25** (keyword scoring), top 4 are sent |
| **CAG** (Cache-Augmented Generation) | Keep small, always-needed knowledge loaded and ready | A cheat-sheet pinned to the desk | `src/lib/cag.js`: documents marked **Pinned** go at the start of every prompt (max 6000 characters); plus an answer cache for repeated questions |
| **KAG** (Knowledge-Graph-Augmented Generation) | Store facts as connected links, follow the links | A mind-map of who is connected to what | `src/lib/kag.js`: facts like `Ali Khan -works_at-> Acme Corp`; names in the question are found, then 2 steps of links are followed |

All three run **at the same time** for each question (`src/lib/agent.js`), their results go into one prompt, and Groq writes a short answer that is read aloud.

**Which one should I use for what?**
- Small facts needed in almost every answer (hours, refund policy) -> **CAG** (pin it).
- Larger documents, only sometimes relevant -> **RAG** (do not pin).
- Questions about *relationships* ("who", "which deals", "how much in total for company X") -> **KAG**.

### Low-latency tricks used
- Retrieval for RAG, CAG and KAG runs in parallel (`Promise.all`).
- Search index, pinned knowledge and graph are kept in memory (`src/lib/cache.js`) and rebuilt only when data changes (or after 5 minutes).
- Same first question again -> instant answer from the answer cache, no AI call.
- Only the last 6 messages and short answers (3 sentences) are used.
- Optional: set `GROQ_REASONING_EFFORT=low` in `.env.local` for faster replies from reasoning models.

---

## Folder map

```
voice-crm/
  src/app/page.js             Page 1: Dashboard
  src/app/agent/page.js       Page 2: Voice Agent (uses components/VoiceAgent.js)
  src/app/knowledge/page.js   Page 3: Knowledge
  src/app/api/...             Node.js API routes (customers, deals, docs, graph, agent, health)
  src/components/VoiceAgent.js  the call loop: listen -> ask -> speak
  src/lib/db.js               MongoDB connection (cached)
  src/lib/models.js           Customer, Deal, Doc, Chunk, Edge collections
  src/lib/rag.js | cag.js | kag.js   the three techniques
  src/lib/agent.js            combines them and calls Groq
  src/lib/llm.js              Groq API call
  scripts/seed.js             sample data
```

## About "free voice calling"
- **Voice in the browser (what this app does):** speech-to-text and text-to-speech come from the browser (Chrome / Edge), so it costs nothing. Firefox/Safari users can type.
- **Real phone calls** (the agent rings a phone number or answers one) need a phone number and a telephony/voice provider (Twilio, Vapi, etc.). Those usually give only a small trial credit and limit calls to verified numbers. The `/api/agent` route is plain JSON in and out, so a phone provider's webhook can call it later without changing the RAG/CAG/KAG code.

## Troubleshooting
| Problem | Fix |
|---|---|
| `MONGODB_URI is missing` | `.env.local` is missing or in the wrong folder (it must sit next to `package.json`). Restart `npm run dev` after editing it. |
| `/api/health?db=1` says failed | Atlas Network Access does not allow your IP (add `0.0.0.0/0`), or the username/password in the string is wrong. |
| `bad auth` | Special characters in the password must be URL-encoded, or use a simple password. |
| `GROQ_API_KEY is missing` | Add it to `.env.local` and restart. After adding variables on Vercel, redeploy. |
| `AI service error 400` / model errors | Check `GROQ_MODEL` is a model your Groq account can use; clear `GROQ_REASONING_EFFORT`. |
| Agent says "I do not have that information" | The data is not there. Run `npm run seed` or add customers/documents. |
| Microphone does nothing | Use Chrome/Edge, allow the mic in the address bar, use `localhost` or https. |

## Good next upgrades
Login (NextAuth), real **vector search** with MongoDB Atlas Vector Search for RAG, automatic graph extraction from documents for KAG, phone-call integration, rate limiting on `/api/agent`.

## Notes
- The knowledge graph is rebuilt from customers and deals after every change (simple and safe for small data).
- Document text is sent to the AI as data; the prompt tells the AI to ignore instructions hidden inside it. Still, only add documents you trust.
