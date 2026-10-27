const shapeBet = (b) => ({
  id: String(b._id), date: b.date, sport: b.sport, event: b.event, type: b.type,
  odds: b.odds, stake: b.stake, result: b.result, ret: b.ret || 0, tags: b.tags || "",
});
const shapeTxn = (t) => ({ date: t.date, amt: t.amt });

function shapeUser(u, bets, txns) {
  return {
    id: String(u._id), name: u.name, color: u.color, admin: u.role === "admin",
    start: u.startingBankroll == null ? null : u.startingBankroll,
    bets: bets.map(shapeBet), txns: txns.map(shapeTxn),
  };
}

async function loadOne(d, u) {
  const [bets, txns] = await Promise.all([
    d.collection("bets").find({ userId: u._id }).toArray(),
    d.collection("transactions").find({ userId: u._id }).toArray(),
  ]);
  return shapeUser(u, bets, txns);
}

async function loadAll(d) {
  const [users, bets, txns] = await Promise.all([
    d.collection("users").find({}).sort({ nameLower: 1 }).toArray(),
    d.collection("bets").find({}).toArray(),
    d.collection("transactions").find({}).toArray(),
  ]);
  const gb = {}, gt = {};
  bets.forEach((b) => (gb[b.userId] = gb[b.userId] || []).push(b));
  txns.forEach((t) => (gt[t.userId] = gt[t.userId] || []).push(t));
  return users.map((u) => shapeUser(u, gb[u._id] || [], gt[u._id] || []));
}

module.exports = { loadOne, loadAll };
