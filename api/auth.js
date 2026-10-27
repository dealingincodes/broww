const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { db } = require("../lib/db");
const { setSession, clearSession, currentUser } = require("../lib/auth");

const COLORS = ["#e50914", "#00b386", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];
const pub = (u) => ({ id: String(u._id), name: u.name, color: u.color, admin: u.role === "admin", start: u.startingBankroll != null ? u.startingBankroll : 0 });
const adminName = () => (process.env.ADMIN_NAME || "naveen").trim().toLowerCase();

module.exports = async (req, res) => {
  try {
    const d = await db();
    const Users = d.collection("users");

    if (req.method === "GET") {
      if (req.query.action === "profiles") {
        const all = await Users.find({}, { projection: { name: 1, color: 1, role: 1, startingBankroll: 1 } })
          .sort({ nameLower: 1 }).toArray();
        return res.json(all.map(pub));
      }
      if (req.query.action === "me") {
        const u = await currentUser(req);
        return res.json(u ? pub(u) : null);
      }
      return res.status(400).json({ error: "Bad request" });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const b = req.body || {};

    if (b.action === "logout") {
      clearSession(res);
      return res.json({ ok: true });
    }

    if (b.action === "register") {
      const name = String(b.name || "").trim();
      const password = String(b.password || "");
      if (!name || name.length > 20) return res.status(400).json({ error: "Name must be 1 to 20 characters." });
      if (password.length < 4 || password.length > 100) return res.status(400).json({ error: "Password needs at least 4 characters." });
      const nameLower = name.toLowerCase();
      let role = "user";
      if (nameLower === adminName()) {
        const code = process.env.ADMIN_SETUP_CODE;
        if (!code) return res.status(500).json({ error: "ADMIN_SETUP_CODE is not configured on the server." });
        if (!b.adminCode) return res.status(403).json({ error: "ADMIN_CODE_REQUIRED" });
        if (b.adminCode !== code) return res.status(403).json({ error: "Wrong admin setup code." });
        role = "admin";
      }
      const rawBankroll = Number(b.startingBankroll != null ? b.startingBankroll : b.start);
      const startingBankroll = (Number.isFinite(rawBankroll) && rawBankroll >= 0) ? rawBankroll : 10000;
      const doc = {
        name, nameLower, role,
        color: COLORS.includes(b.color) ? b.color : COLORS[0],
        passwordHash: await bcrypt.hash(password, 10),
        startingBankroll, failedAttempts: 0, lockUntil: 0, createdAt: new Date(),
      };
      try {
        const r = await Users.insertOne(doc);
        doc._id = r.insertedId;
      } catch (e) {
        if (e && e.code === 11000) return res.status(409).json({ error: "That name is already taken. Pick another name." });
        throw e;
      }
      setSession(res, doc._id);
      return res.json(pub(doc));
    }

    if (b.action === "login") {
      if (!ObjectId.isValid(b.id)) return res.status(400).json({ error: "Bad request" });
      const u = await Users.findOne({ _id: new ObjectId(b.id) });
      const bad = { error: "Wrong password." };
      if (!u) return res.status(401).json(bad);
      if (u.lockUntil && u.lockUntil > Date.now()) {
        return res.status(429).json({ error: "Too many tries. Try again in a few minutes." });
      }
      const ok = await bcrypt.compare(String(b.password || ""), u.passwordHash);
      if (!ok) {
        const n = (u.failedAttempts || 0) + 1;
        const lock = n >= 5;
        await Users.updateOne({ _id: u._id }, { $set: { failedAttempts: lock ? 0 : n, lockUntil: lock ? Date.now() + 5 * 60000 : 0 } });
        return res.status(lock ? 429 : 401).json(lock ? { error: "Too many tries. Locked for 5 minutes." } : bad);
      }
      await Users.updateOne({ _id: u._id }, { $set: { failedAttempts: 0, lockUntil: 0 } });
      setSession(res, u._id);
      return res.json(pub(u));
    }

    return res.status(400).json({ error: "Bad request" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
