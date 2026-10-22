# 🎙️ Voice CRM Agent

A small CRM you can **talk to**. Press *Start call*, ask about your customers, deals or company policies, and the agent answers out loud.

Built with **Next.js + React**, **Node.js API routes**, **MongoDB Atlas** and **Groq**. Answers are grounded in your own data using **RAG**, **CAG** and **KAG**.

---

## Features

- **3 pages only:** Dashboard, Voice Agent, Knowledge
- **Voice calls in the browser** (speech-to-text and text-to-speech built into Chrome / Edge, no paid voice service)
- **CRM basics:** customers, deals, stages, pipeline numbers
- **RAG** over documents and customer notes (BM25 keyword ranking)
- **CAG** with always-loaded pinned knowledge and an answer cache
- **KAG** with a knowledge graph built automatically from customers and deals
- **"Where did this answer come from?"** panel shows the CAG, KAG and RAG sources used
- **Low latency:** parallel retrieval, in-memory caches, short answers
- Typing fallback for browsers without speech recognition

## Tech stack

| Part | Tool |
|---|---|
| Front end | Next.js (App Router), React |
| Back end | Node.js (Next.js API routes) |
| Database | MongoDB Atlas (free M0) with Mongoose |
| AI model | Groq API (free tier), default `openai/gpt-oss-20b` |
| Voice | Browser Web Speech API |
| Hosting | Vercel |

## The 3 pages

| Page | URL | What it does |
|---|---|---|
| Dashboard | `/` | Add and manage customers and deals, see totals |
| Voice Agent | `/agent` | Start a call, talk, hear answers, see the sources used |
| Knowledge | `/knowledge` | Add documents (RAG, or pinned for CAG) and view the graph (KAG) |

## How it works

```mermaid
flowchart LR
  A[You speak] --> B[Browser speech-to-text]
  B --> C["POST /api/agent"]
  C --> D{Same question<br/>cached?}
  D -- yes --> J[Instant answer]
  D -- no --> E[CAG: pinned knowledge]
  D -- no --> F[KAG: graph facts]
  D -- no --> G[RAG: best notes]
  E --> H[One prompt]
  F --> H
  G --> H
  H --> I[Groq LLM]
  I --> J
  J --> K[Browser text-to-speech]
```

### RAG, CAG and KAG in simple words

| | Idea | In this app |
|---|---|---|
| **RAG** (Retrieval-Augmented Generation) | Search your notes and give the AI only the best few pieces | `src/lib/rag.js`: documents are cut into ~500-character chunks and ranked with BM25. The top 4 are sent. Customer notes are searchable too. |
| **CAG** (Cache-Augmented Generation) | Keep small, always-needed knowledge loaded and ready | `src/lib/cag.js`: documents marked **Pinned** go at the start of every prompt (up to 6000 characters). Repeated first questions are answered from an answer cache. |
| **KAG** (Knowledge-Graph-Augmented Generation) | Store facts as links and follow them | `src/lib/kag.js`: facts such as `Ali Khan -works_at-> Acme Corp`. Names in the question are found, then 2 steps of links are followed. |

**Which to use for what**
- Short facts needed almost every time (opening hours, refund policy): **pin them (CAG)**.
- Longer documents needed only sometimes: **RAG**.
- Questions about relationships ("who works at Acme", "which deals are in negotiation"): **KAG**.

## Project structure

```
voice-crm/
├── scripts/seed.js               # sample data
└── src/
    ├── app/
    │   ├── page.js               # Page 1: Dashboard
    │   ├── agent/page.js         # Page 2: Voice Agent
    │   ├── knowledge/page.js     # Page 3: Knowledge
    │   └── api/                  # Node.js API routes
    ├── components/
    │   ├── VoiceAgent.js         # call loop: listen -> ask -> speak
    │   └── Nav.js
    └── lib/
        ├── db.js                 # cached MongoDB connection
        ├── models.js             # Customer, Deal, Doc, Chunk, Edge
        ├── rag.js  cag.js  kag.js
        ├── agent.js              # combines RAG + CAG + KAG, calls the LLM
        ├── llm.js                # Groq API call
        └── cache.js              # in-memory caches
```

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/api/customers` | List / create customers |
| PATCH / DELETE | `/api/customers/:id` | Update status or notes / delete customer and deals |
| GET / POST | `/api/deals` | List / create deals |
| PATCH / DELETE | `/api/deals/:id` | Change stage / delete deal |
| GET / POST | `/api/docs` | List / add knowledge documents |
| DELETE | `/api/docs/:id` | Delete a document and its chunks |
| GET / POST | `/api/graph` | List graph facts / rebuild the graph |
| POST | `/api/agent` | `{ question, history }` returns `{ answer, sources, cached, ms }` |
| GET | `/api/health` | Server check (`?db=1` also checks MongoDB) |

## Getting started

### Requirements
- Node.js **20.9 or newer**
- A free **MongoDB Atlas** cluster
- A free **Groq** API key
- Chrome or Edge for voice

### 1. Install
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
npm install
```

### 2. Set up MongoDB Atlas
1. Create a free **M0** cluster.
2. **Database Access:** add a user (letters and numbers in the password avoid URL problems).
3. **Network Access:** allow `0.0.0.0/0` (required for Vercel).
4. **Connect -> Drivers:** copy the connection string, replace `<password>`, and add your database name before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/ai_voice_agents?retryWrites=true&w=majority
   ```

### 3. Configure environment variables
```bash
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local
```
Edit **`.env.local`** (never `.env.example`):

| Variable | Description |
|---|---|
| `MONGODB_URI` | Your Atlas connection string |
| `GROQ_API_KEY` | Key from https://console.groq.com/keys |
| `GROQ_MODEL` | Model name, default `openai/gpt-oss-20b` |
| `GROQ_REASONING_EFFORT` | Optional: `low`, `medium` or `high` for faster replies on reasoning models |

### 4. Load sample data (optional)
```bash
npm run seed
```
Creates 3 customers, 4 deals, 4 documents and the graph.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000. Check the database at http://localhost:3000/api/health?db=1.

## Try it

Open **Voice Agent**, press **Start call**, allow the microphone, and say:

| Say | Uses |
|---|---|
| "What is the refund policy?" | CAG |
| "What discount do I get for 50 seats?" | RAG |
| "Tell me about Ali Khan" | KAG + RAG |
| "Who works at Acme Corp?" | KAG |

## Deploy to Vercel

1. Push the project to GitHub.
2. In MongoDB Atlas, make sure **Network Access** allows `0.0.0.0/0`.
3. On [vercel.com](https://vercel.com): **Add New -> Project**, import the repository (framework: Next.js).
4. Add the environment variables `MONGODB_URI`, `GROQ_API_KEY`, `GROQ_MODEL`.
5. Click **Deploy**.
6. Test `https://YOUR-APP.vercel.app/api/health?db=1`, then open `/agent`.

After adding or changing variables on Vercel, **redeploy** so the new values apply.

## Security

- Keep real keys only in `.env.local` and in Vercel's Environment Variables.
- `.env.local` is in `.gitignore`. `.env.example` must stay blank.
- GitHub push protection will reject pushes that contain API keys. If a key was ever committed or pasted somewhere public, **create a new key and delete the old one**.
- Text from documents is passed to the AI as data and the prompt tells it to ignore instructions hidden inside. Only add documents you trust.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find package 'mongoose'` / `'next' is not recognized` | Run `npm install` first |
| `MONGODB_URI is missing` | `.env.local` is missing, unsaved, or not next to `package.json`. Restart `npm run dev` after editing. |
| `Invalid scheme, expected connection string to start with "mongodb://"` | The value must start exactly with `mongodb+srv://`, with no quotes or extra text |
| `querySrv ENOTFOUND` | The cluster address is wrong. Copy it from Atlas, do not type it |
| Health check fails or times out | Atlas Network Access does not allow your IP (`0.0.0.0/0`), or the username/password is wrong |
| `bad auth` | Wrong user or password. Special characters in a password must be URL-encoded |
| `GROQ_API_KEY is missing` | Add it to `.env.local` and restart (on Vercel: add it and redeploy) |
| AI service error 400 | Check `GROQ_MODEL`, and clear `GROQ_REASONING_EFFORT` |
| Agent says "I do not have that information" | The data is not there yet. Run `npm run seed` or add data |
| Microphone does nothing | Use Chrome or Edge, allow the mic in the address bar, use `localhost` or https |

## About free voice calling

- **Voice in the browser (this app):** speech recognition and speech synthesis come from the browser, so there is no voice bill.
- **Real phone calls** need a phone number and a telephony or voice provider (such as Twilio or Vapi). These typically offer only limited trial credit. `/api/agent` is plain JSON in and out, so a provider's webhook can call it later without changing the RAG / CAG / KAG code.

## Limitations

- The graph is rebuilt after each customer or deal change (simple, fine for small data).
- Caches live in memory. On Vercel each server instance has its own cache, which expires after 5 minutes.
- RAG uses keyword ranking (BM25), not embeddings, so it matches words rather than meaning.
- Speech recognition is English (`en-US`) and works in Chrome and Edge.

## Roadmap

- Login and per-user data
- Vector search with MongoDB Atlas Vector Search for RAG
- Automatic graph extraction from documents for KAG
- Phone-call integration
- Rate limiting on `/api/agent`

## License

Add a license of your choice (for example MIT) before sharing publicly.
