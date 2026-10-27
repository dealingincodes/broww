const { MongoClient } = require("mongodb");

// Reuse one connection across serverless invocations.
const cache = global._betbook || (global._betbook = { p: null });

async function db() {
  if (!cache.p) {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
    const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
    cache.p = client
      .connect()
      .then(async (c) => {
        const d = c.db(process.env.MONGODB_DB || "betbook");
        await d.collection("users").createIndex({ nameLower: 1 }, { unique: true });
        await d.collection("bets").createIndex({ userId: 1, date: -1 });
        await d.collection("transactions").createIndex({ userId: 1, date: -1 });
        return d;
      })
      .catch((e) => {
        cache.p = null;
        throw e;
      });
  }
  return cache.p;
}

module.exports = { db };
