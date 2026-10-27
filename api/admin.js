const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { db } = require("../lib/db");
const { currentUser } = require("../lib/auth");
const { loadAll } = require("../lib/data");

module.exports = async (req, res) => {
  try {
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ error: "Please log in." });
    if (me.role !== "admin") return res.status(403).json({ error: "Admins only." });
    const d = await db();

    if (req.method === "GET") return res.json(await loadAll(d));

    if (req.method === "POST") {
      const b = req.body || {};

      if (b.action === "reset") {
        const p = String(b.password || "");
        if (!ObjectId.isValid(b.user) || p.length < 4 || p.length > 100) {
          return res.status(400).json({ error: "Use a password of at least 4 characters." });
        }
        const r = await d.collection("users").updateOne(
          { _id: new ObjectId(b.user) },
          { $set: { passwordHash: await bcrypt.hash(p, 10), failedAttempts: 0, lockUntil: 0 } }
        );
        if (!r.matchedCount) return res.status(404).json({ error: "Profile not found." });
        return res.json({ ok: true });
      }

      if (b.action === "deleteUser") {
        if (!ObjectId.isValid(b.user)) return res.status(400).json({ error: "Bad request" });
        if (String(b.user) === String(me._id)) {
          return res.status(400).json({ error: "Cannot delete the master admin account." });
        }
        const targetId = new ObjectId(b.user);
        await d.collection("users").deleteOne({ _id: targetId });
        await d.collection("bets").deleteMany({ userId: targetId });
        await d.collection("transactions").deleteMany({ userId: targetId });
        return res.json({ ok: true, all: await loadAll(d) });
      }

      if (b.action === "addUser") {
        const name = String(b.name || "").trim();
        const password = String(b.password || "");
        if (!name || name.length > 20) return res.status(400).json({ error: "Name must be 1 to 20 characters." });
        if (password.length < 4 || password.length > 100) return res.status(400).json({ error: "Password needs at least 4 characters." });
        const nameLower = name.toLowerCase();
        const rawBankroll = Number(b.startingBankroll != null ? b.startingBankroll : b.start);
        const startingBankroll = (Number.isFinite(rawBankroll) && rawBankroll >= 0) ? rawBankroll : 10000;
        const COLORS = ["#e50914", "#00b386", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];
        const doc = {
          name, nameLower, role: "user",
          color: COLORS.includes(b.color) ? b.color : COLORS[0],
          passwordHash: await bcrypt.hash(password, 10),
          startingBankroll, failedAttempts: 0, lockUntil: 0, createdAt: new Date()
        };
        try {
          await d.collection("users").insertOne(doc);
        } catch (e) {
          if (e && e.code === 11000) return res.status(409).json({ error: "That name is already taken. Pick another." });
          throw e;
        }
        return res.json({ ok: true, all: await loadAll(d) });
      }
    }
    return res.status(400).json({ error: "Bad request" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
