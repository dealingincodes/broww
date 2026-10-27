const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { db } = require("./db");

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set (32+ characters)");
  return s;
}

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
const cookieAttrs = `HttpOnly; ${isProd ? "Secure; " : ""}SameSite=Lax; Path=/`;

function setSession(res, id) {
  const token = jwt.sign({ id: String(id) }, secret(), { expiresIn: "30d" });
  res.setHeader("Set-Cookie", `bb=${token}; ${cookieAttrs}; Max-Age=${30 * 86400}`);
}

function clearSession(res) {
  res.setHeader("Set-Cookie", `bb=; ${cookieAttrs}; Max-Age=0`);
}

// Returns the logged-in user document (role always read fresh from the DB), or null.
async function currentUser(req) {
  const m = (req.headers.cookie || "").match(/(?:^|; )bb=([^;]+)/);
  if (!m) return null;
  try {
    const { id } = jwt.verify(m[1], secret());
    const d = await db();
    return await d.collection("users").findOne({ _id: new ObjectId(id) });
  } catch (e) {
    return null;
  }
}

module.exports = { setSession, clearSession, currentUser };
