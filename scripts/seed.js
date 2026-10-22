// Fills the database with sample data so you can try the agent immediately.
// Run:  npm run seed      (it first deletes the sample collections, then re-creates them)
import { connectDB } from "../src/lib/db.js";
import { Chunk, Customer, Deal, Doc, Edge } from "../src/lib/models.js";
import { chunkText } from "../src/lib/rag.js";
import { rebuildGraph } from "../src/lib/kag.js";

await connectDB();
await Promise.all([Customer.deleteMany({}), Deal.deleteMany({}), Doc.deleteMany({}), Chunk.deleteMany({}), Edge.deleteMany({})]);

// 1) customers
const [ali, sara, john] = await Customer.insertMany([
  { name: "Ali Khan", company: "Acme Corp", email: "ali@acme.example", phone: "+92 300 1111111", status: "active",
    notes: "Prefers phone calls in the morning. Asked about a volume discount for 50 seats. Very happy with onboarding." },
  { name: "Sara Ahmed", company: "Acme Corp", email: "sara@acme.example", phone: "+92 300 2222222", status: "lead",
    notes: "Met at the Lahore expo. Wants a demo next week. Worried about data security." },
  { name: "John Smith", company: "Globex", email: "john@globex.example", phone: "+1 555 0100", status: "lead",
    notes: "Compares us with a competitor. Budget is limited, asked for a monthly payment plan." },
]);

// 2) deals
await Deal.insertMany([
  { customer: ali._id, title: "Website redesign", value: 5000, stage: "negotiation" },
  { customer: ali._id, title: "Support plan", value: 1200, stage: "won" },
  { customer: sara._id, title: "CRM rollout", value: 9000, stage: "new" },
  { customer: john._id, title: "Starter package", value: 800, stage: "new" },
]);

// 3) knowledge documents (pinned ones become CAG knowledge)
const docs = [
  { title: "Opening hours", pinned: true,
    content: "Our office is open Monday to Friday, 9 AM to 6 PM Pakistan time. We are closed on Saturday and Sunday. Phone support is available during office hours." },
  { title: "Refund policy", pinned: true,
    content: "Customers can request a full refund within 14 days of purchase. After 14 days we offer store credit. Refunds are paid back to the original payment method within 5 to 7 business days." },
  { title: "Pricing plans", pinned: false,
    content: "Starter plan costs $20 per seat per month and includes email support.\n\nTeam plan costs $45 per seat per month and includes phone support and basic reports.\n\nEnterprise plan has custom pricing, a dedicated manager and priority support. Volume discounts start at 25 seats: 10 percent off. At 50 seats or more the discount is 15 percent." },
  { title: "Data security", pinned: false,
    content: "All customer data is encrypted in transit and at rest. We run daily backups and keep them for 30 days. Access is protected with two-factor login. We never sell customer data." },
];
for (const d of docs) {
  const pieces = chunkText(d.content);
  const doc = await Doc.create({ ...d, chunkCount: pieces.length });
  await Chunk.insertMany(pieces.map((text) => ({ doc: doc._id, title: doc.title, text })));
}

// 4) graph (KAG)
const edgeCount = await rebuildGraph();

console.log(`Seeded: 3 customers, 4 deals, ${docs.length} documents, ${edgeCount} graph facts.`);
process.exit(0);
