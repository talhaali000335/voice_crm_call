"use client"; // this page uses state and forms, so it runs in the browser

// PAGE 1 of 3: Dashboard. Add customers and deals; see the numbers.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/client.js";

const emptyCustomer = { name: "", company: "", email: "", phone: "", status: "lead", notes: "" };
const emptyDeal = { customer: "", title: "", value: "", stage: "new" };
const money = (n) => "$" + Number(n || 0).toLocaleString();

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [cForm, setCForm] = useState(emptyCustomer);
  const [dForm, setDForm] = useState(emptyDeal);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Load both lists from the API.
  const load = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([api("/api/customers"), api("/api/deals")]);
      setCustomers(c.customers);
      setDeals(d.deals);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Run an API call, then refresh the lists. Any error is shown on screen.
  async function act(fn) {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const addCustomer = (e) => {
    e.preventDefault();
    act(async () => {
      await api("/api/customers", { method: "POST", body: cForm });
      setCForm(emptyCustomer);
    });
  };
  const addDeal = (e) => {
    e.preventDefault();
    act(async () => {
      await api("/api/deals", { method: "POST", body: dForm });
      setDForm(emptyDeal);
    });
  };

  const open = deals.filter((d) => d.stage === "new" || d.stage === "negotiation");
  const won = deals.filter((d) => d.stage === "won");
  const sum = (list) => list.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">Your customers and deals. Everything you add here is also known by the voice agent.</p>
      {error && <p className="err">⚠ {error}</p>}

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card stat"><b>{customers.length}</b><span>Customers</span></div>
        <div className="card stat"><b>{open.length}</b><span>Open deals</span></div>
        <div className="card stat"><b>{money(sum(open))}</b><span>Pipeline value</span></div>
        <div className="card stat"><b>{money(sum(won))}</b><span>Won value</span></div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <form className="card row" onSubmit={addCustomer}>
          <h2>Add customer</h2>
          <input placeholder="Name *" required value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} />
          <div className="two">
            <input placeholder="Company" value={cForm.company} onChange={(e) => setCForm({ ...cForm, company: e.target.value })} />
            <select value={cForm.status} onChange={(e) => setCForm({ ...cForm, status: e.target.value })}>
              <option value="lead">lead</option><option value="active">active</option><option value="churned">churned</option>
            </select>
          </div>
          <div className="two">
            <input placeholder="Email" type="email" value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} />
            <input placeholder="Phone" value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} />
          </div>
          <textarea placeholder="Notes (the agent can search these)" value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} />
          <button>Save customer</button>
        </form>

        <form className="card row" onSubmit={addDeal}>
          <h2>Add deal</h2>
          <select required value={dForm.customer} onChange={(e) => setDForm({ ...dForm, customer: e.target.value })}>
            <option value="">Choose customer *</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input placeholder="Deal title *" required value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} />
          <div className="two">
            <input placeholder="Value ($)" type="number" min="0" value={dForm.value} onChange={(e) => setDForm({ ...dForm, value: e.target.value })} />
            <select value={dForm.stage} onChange={(e) => setDForm({ ...dForm, stage: e.target.value })}>
              <option value="new">new</option><option value="negotiation">negotiation</option><option value="won">won</option><option value="lost">lost</option>
            </select>
          </div>
          <button disabled={!customers.length}>Save deal</button>
          {!customers.length && <span className="muted small">Add a customer first.</span>}
        </form>
      </div>

      <div className="grid g2">
        <div className="card scroll">
          <h2>Customers</h2>
          {loading ? <p className="muted">Loading…</p> : !customers.length ? <p className="muted">No customers yet.</p> : (
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}<div className="muted small">{c.email || c.phone}</div></td>
                    <td>{c.company}</td>
                    <td>
                      <select value={c.status} onChange={(e) => act(() => api(`/api/customers/${c._id}`, { method: "PATCH", body: { status: e.target.value } }))}>
                        <option>lead</option><option>active</option><option>churned</option>
                      </select>
                    </td>
                    <td><button className="ghost" onClick={() => confirm(`Delete ${c.name} and their deals?`) && act(() => api(`/api/customers/${c._id}`, { method: "DELETE" }))}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card scroll">
          <h2>Deals</h2>
          {loading ? <p className="muted">Loading…</p> : !deals.length ? <p className="muted">No deals yet.</p> : (
            <table>
              <thead><tr><th>Deal</th><th>Value</th><th>Stage</th><th></th></tr></thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d._id}>
                    <td>{d.title}<div className="muted small">{d.customer?.name || "(customer removed)"}</div></td>
                    <td>{money(d.value)}</td>
                    <td>
                      <select value={d.stage} onChange={(e) => act(() => api(`/api/deals/${d._id}`, { method: "PATCH", body: { stage: e.target.value } }))}>
                        <option>new</option><option>negotiation</option><option>won</option><option>lost</option>
                      </select>
                    </td>
                    <td><button className="ghost" onClick={() => act(() => api(`/api/deals/${d._id}`, { method: "DELETE" }))}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
