const { ObjectId } = require("mongodb");
const { db } = require("../lib/db");
const { currentUser } = require("../lib/auth");
const { loadOne } = require("../lib/data");

const SPORTS = ["Cricket", "Football", "Tennis", "Basketball", "Kabaddi", "Other"];
const TYPES = ["Single", "Accumulator", "Live"];
const RESULTS = ["Pending", "Won", "Lost", "Void", "Cashed Out"];

function cleanBet(b) {
  if (!b || typeof b !== "object") return null;
  const o = {
    event: String(b.event || "").trim().slice(0, 100),
    sport: SPORTS.includes(b.sport) ? b.sport : "Other",
    type: TYPES.includes(b.type) ? b.type : "Single",
    odds: Number(b.odds), stake: Number(b.stake),
    result: b.result,
    date: String(b.date || ""),
    ret: Number(b.ret) || 0,
    tags: String(b.tags || "").slice(0, 100),
  };
  if (!o.event || !(o.odds > 1) || o.odds > 10000) return null;
  if (!(o.stake > 0) || o.stake > 1e9) return null;
  if (!RESULTS.includes(o.result)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
  if (o.result === "Cashed Out" && !(o.ret >= 0 && o.ret <= 1e9)) return null;
  if (o.result !== "Cashed Out") o.ret = 0;
  return o;
}

module.exports = async (req, res) => {
  try {
    const me = await currentUser(req);
    if (!me) return res.status(401).json({ error: "Please log in." });

    const body = req.body || {};
    const target = (req.method === "GET" ? req.query.user : body.user) || String(me._id);
    if (!ObjectId.isValid(target)) return res.status(400).json({ error: "Bad request" });
    // Regular users can only touch their own data. Admin can touch anyone's.
    if (target !== String(me._id) && me.role !== "admin") return res.status(403).json({ error: "Not allowed." });

    const d = await db();
    const tid = new ObjectId(target);
    const t = await d.collection("users").findOne({ _id: tid });
    if (!t) return res.status(404).json({ error: "Profile not found." });

    if (req.method === "GET") return res.json(await loadOne(d, t));
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const Bets = d.collection("bets");
    switch (body.action) {
      case "start": {
        const v = Number(body.start);
        if (!Number.isFinite(v) || v < 0 || v > 1e9) return res.status(400).json({ error: "Enter a valid amount." });
        await d.collection("users").updateOne({ _id: tid }, { $set: { startingBankroll: v } });
        t.startingBankroll = v;
        break;
      }
      case "updateProfile": {
        const updates = {};
        if (body.name) {
          const n = String(body.name).trim();
          if (n.length >= 1 && n.length <= 20) {
            updates.name = n;
            updates.nameLower = n.toLowerCase();
            t.name = n;
          }
        }
        if (body.start != null) {
          const v = Number(body.start);
          if (Number.isFinite(v) && v >= 0 && v <= 1e9) {
            updates.startingBankroll = v;
            t.startingBankroll = v;
          }
        }
        if (Object.keys(updates).length > 0) {
          await d.collection("users").updateOne({ _id: tid }, { $set: updates });
        }
        break;
      }
      case "clearBets": {
        await Bets.deleteMany({ userId: tid });
        break;
      }
      case "addBet": {
        const o = cleanBet(body.bet);
        if (!o) return res.status(400).json({ error: "Check the bet details." });
        await Bets.insertOne({ ...o, userId: tid, createdAt: new Date() });
        break;
      }
      case "updateBet": {
        const o = cleanBet(body.bet);
        if (!o || !ObjectId.isValid(body.id)) return res.status(400).json({ error: "Check the bet details." });
        await Bets.updateOne({ _id: new ObjectId(body.id), userId: tid }, { $set: { ...o, updatedAt: new Date() } });
        break;
      }
      case "deleteBet": {
        if (!ObjectId.isValid(body.id)) return res.status(400).json({ error: "Bad request" });
        await Bets.deleteOne({ _id: new ObjectId(body.id), userId: tid });
        break;
      }
      case "txn": {
        const amt = Number(body.amt);
        if (!Number.isFinite(amt) || amt === 0 || Math.abs(amt) > 1e9) return res.status(400).json({ error: "Enter a valid amount." });
        await d.collection("transactions").insertOne({ userId: tid, amt, date: new Date().toISOString().slice(0, 10), createdAt: new Date() });
        break;
      }
      default:
        return res.status(400).json({ error: "Bad request" });
    }
    return res.json(await loadOne(d, t));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
};
