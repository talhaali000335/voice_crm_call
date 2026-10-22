// Connects to MongoDB once and re-uses the connection.
// Why: Next.js reloads files while you code and runs routes many times.
// Without caching we would open a new connection on every request and run out of free-tier connections.
import mongoose from "mongoose";

// globalThis survives hot reloads, so the cached connection is kept.
const cache = (globalThis._mongooseCache ??= { conn: null, promise: null });

export async function connectDB() {
  const uri = process.env.MONGODB_URI; // read here (not at the top) so scripts can load .env first
  if (!uri) throw new Error("MONGODB_URI is missing. Add it to .env.local");

  if (cache.conn) return cache.conn; // already connected -> reuse it

  if (!cache.promise) {
    // Start connecting (only once, even if 5 requests arrive together).
    cache.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000, // give up after 8 seconds if Atlas is unreachable
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null; // allow a retry on the next request
    throw err;
  }
  return cache.conn;
}
