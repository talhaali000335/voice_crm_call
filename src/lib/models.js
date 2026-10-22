// The 5 MongoDB collections (tables) of the app.
//   Customer + Deal -> the CRM data
//   Doc + Chunk     -> the knowledge base (RAG / CAG)
//   Edge            -> the knowledge graph (KAG)
import mongoose from "mongoose";

const { Schema, models, model } = mongoose;

// "models.X || model(...)" stops Next.js hot reload from registering the same model twice.
export const Customer =
  models.Customer ||
  model(
    "Customer",
    new Schema(
      {
        name: { type: String, required: true, trim: true, maxlength: 100 },
        company: { type: String, trim: true, default: "", maxlength: 100 },
        email: { type: String, trim: true, default: "", maxlength: 120 },
        phone: { type: String, trim: true, default: "", maxlength: 40 },
        status: { type: String, enum: ["lead", "active", "churned"], default: "lead" },
        notes: { type: String, default: "", maxlength: 2000 }, // free text -> searchable by RAG
      },
      { timestamps: true }
    )
  );

export const Deal =
  models.Deal ||
  model(
    "Deal",
    new Schema(
      {
        customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        value: { type: Number, default: 0, min: 0 },
        stage: { type: String, enum: ["new", "negotiation", "won", "lost"], default: "new" },
      },
      { timestamps: true }
    )
  );

// A knowledge document, e.g. "Refund policy". If pinned=true it is loaded into every answer (CAG).
export const Doc =
  models.Doc ||
  model(
    "Doc",
    new Schema(
      {
        title: { type: String, required: true, trim: true, maxlength: 120 },
        content: { type: String, required: true, maxlength: 20000 },
        pinned: { type: Boolean, default: false },
        chunkCount: { type: Number, default: 0 },
      },
      { timestamps: true }
    )
  );

// A small piece of a Doc (about 500 characters). RAG searches these pieces.
export const Chunk =
  models.Chunk ||
  model(
    "Chunk",
    new Schema({
      doc: { type: Schema.Types.ObjectId, ref: "Doc", required: true, index: true },
      title: { type: String, required: true },
      text: { type: String, required: true },
    })
  );

// One fact in the graph: source --relation--> target  (e.g. "Ali Khan" --works_at--> "Acme")
export const Edge =
  models.Edge ||
  model(
    "Edge",
    new Schema({
      source: { type: String, required: true, index: true },
      relation: { type: String, required: true },
      target: { type: String, required: true, index: true },
    })
  );
