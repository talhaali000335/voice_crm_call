"use client";

// PAGE 3 of 3: Knowledge. Documents for RAG + CAG, and the facts of the graph (KAG).
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/client.js";

const CAG_LIMIT = 6000; // must match MAX_CHARS in src/lib/cag.js

export default function Knowledge() {
  const [docs, setDocs] = useState([]);
  const [edges, setEdges] = useState([]);
  const [form, setForm] = useState({ title: "", content: "", pinned: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([api("/api/docs"), api("/api/graph")]);
      setDocs(d.docs);
      setEdges(g.edges);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const addDoc = (e) => {
    e.preventDefault();
    act(async () => {
      await api("/api/docs", { method: "POST", body: form });
      setForm({ title: "", content: "", pinned: false });
    });
  };

  const pinnedChars = docs.filter((d) => d.pinned).reduce((s, d) => s + d.content.length, 0);
  const chunkTotal = docs.reduce((s, d) => s + (d.chunkCount || 0), 0);

  return (
    <>
      <h1>Knowledge</h1>
      <p className="sub">What the voice agent knows besides your customers. Three ways of using knowledge:</p>
      {error && <p className="err">⚠ {error}</p>}

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="tag">RAG · SEARCH</div>
          <p className="small">Every document is cut into small chunks. For each question the agent searches them and reads only the best matches.</p>
          <b>{chunkTotal}</b> <span className="muted small">searchable chunks</span>
        </div>
        <div className="card">
          <div className="tag">CAG · ALWAYS LOADED</div>
          <p className="small">Documents you <b>pin</b> are kept ready and given to the AI on every question. No search needed. Keep them short.</p>
          <b>{pinnedChars}</b> <span className="muted small">of {CAG_LIMIT} characters used</span>
        </div>
        <div className="card">
          <div className="tag">KAG · CONNECTIONS</div>
          <p className="small">Customers, companies and deals are linked as facts. The agent follows the links to answer “who / which / how much” questions.</p>
          <b>{edges.length}</b> <span className="muted small">facts in the graph</span>
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <form className="card row" onSubmit={addDoc}>
          <h2>Add a document</h2>
          <input placeholder="Title (e.g. Refund policy) *" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea style={{ minHeight: 140 }} placeholder="Paste the text here *" required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <label className="small">
            <input type="checkbox" style={{ width: "auto", marginRight: 8 }} checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            Pin it (CAG: always loaded). Leave unchecked for RAG search only.
          </label>
          <button disabled={busy}>Save document</button>
        </form>

        <div className="card scroll">
          <h2>Documents</h2>
          {!docs.length ? <p className="muted">No documents yet.</p> : (
            <table>
              <thead><tr><th>Title</th><th>Mode</th><th>Chunks</th><th></th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d._id}>
                    <td>{d.title}</td>
                    <td><span className="pill">{d.pinned ? "CAG + RAG" : "RAG"}</span></td>
                    <td>{d.chunkCount}</td>
                    <td><button className="ghost" disabled={busy} onClick={() => confirm(`Delete "${d.title}"?`) && act(() => api(`/api/docs/${d._id}`, { method: "DELETE" }))}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card scroll">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Knowledge graph facts</h2>
          <button className="ghost" disabled={busy} onClick={() => act(() => api("/api/graph", { method: "POST" }))}>Rebuild graph</button>
        </div>
        {!edges.length ? <p className="muted">No facts yet. Add customers and deals on the Dashboard.</p> : (
          <table>
            <thead><tr><th>Source</th><th>Relation</th><th>Target</th></tr></thead>
            <tbody>
              {edges.slice(0, 100).map((e) => (
                <tr key={e._id}><td>{e.source}</td><td><span className="pill">{e.relation}</span></td><td>{e.target}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {edges.length > 100 && <p className="muted small">Showing the first 100 of {edges.length}.</p>}
      </div>
    </>
  );
}
