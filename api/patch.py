import sys
import re

with open('index.js', 'r') as f:
    code = f.read()

# 1. Imports
code = code.replace("import fs from 'node:fs';", "import { createClient } from '@supabase/supabase-js';")
code = code.replace("import path from 'node:path';", "")

# 2. Supabase setup
sb_setup = """
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function kvGet(key, defaultVal) {
  const { data } = await supabase.from('kv_store').select('value').eq('key', key).single();
  return data ? data.value : defaultVal;
}
async function kvSet(key, value) {
  await supabase.from('kv_store').upsert({ key, value });
}
"""
code = code.replace("fs.mkdirSync(DATA, { recursive: true });", sb_setup)
code = code.replace("try { fs.chmodSync(DATA, 0o700); } catch { /* host filesystem says no — carry on */ }", "")

# 3. DB logic replacement
old_db = """/* ---------- secret + db ---------- */
const secretFile = path.join(DATA, 'secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();

const dbFile = path.join(DATA, 'db.json');
let db = { users: [], creds: [], subs: [], invites: [] };
try { db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch {}
db.subs = db.subs || [];
db.invites = db.invites || [];
const isAdmin = user => !!user && (user.admin === true || ADMIN_UIDS.includes(user.id));
function saveDb() { atomicWrite(dbFile, JSON.stringify(db, null, 2)); }
function atomicWrite(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
const stateFile = uid => path.join(DATA, 'state-' + uid.replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
function readState(uid) {
  try { return JSON.parse(fs.readFileSync(stateFile(uid), 'utf8')); } catch { return null; }
}"""

new_db = """/* ---------- secret + db ---------- */
let SECRET = process.env.SESSION_SECRET || 'dev_secret_replace_me_in_prod';

async function getDb() {
  const data = await kvGet('db.json', { users: [], creds: [], subs: [], invites: [] });
  data.subs = data.subs || [];
  data.invites = data.invites || [];
  return data;
}

const isAdmin = user => !!user && (user.admin === true || ADMIN_UIDS.includes(user.id));
async function saveDb(dbObj) { await kvSet('db.json', dbObj); }

async function readState(uid) {
  return await kvGet('state-' + uid, null);
}
async function writeState(uid, state) {
  await kvSet('state-' + uid, state);
}"""
code = code.replace(old_db, new_db)

# 4. Vapid
old_vapid = """/* ---------- push notifications (Web Push / VAPID) ---------- */
const vapidFile = path.join(DATA, 'vapid.json');
let vapid;
try { vapid = JSON.parse(fs.readFileSync(vapidFile, 'utf8')); }
catch { vapid = webpush.generateVAPIDKeys(); fs.writeFileSync(vapidFile, JSON.stringify(vapid), { mode: 0o600 }); }
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || (SECURE ? ORIGIN : 'mailto:admin@localhost');
webpush.setVapidDetails(VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);"""

new_vapid = """/* ---------- push notifications (Web Push / VAPID) ---------- */
let vapid = { publicKey: process.env.VAPID_PUBLIC_KEY || '', privateKey: process.env.VAPID_PRIVATE_KEY || '' };
if (vapid.publicKey && vapid.privateKey) {
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || (SECURE ? ORIGIN : 'mailto:admin@localhost');
  webpush.setVapidDetails(VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);
}"""
code = code.replace(old_vapid, new_vapid)

# 5. We need to inject `let db = await getDb();` at the beginning of EVERY route
# and replace `saveDb()` with `await saveDb(db)`

# A dirty but effective hack is to replace the router executor:
# Find:
#   const handler = routes[key];
#   if (!handler) return json(res, 404, { error: 'not found' });
#   try { await handler(req, res); }
# Replace with:
#   const handler = routes[key];
#   if (!handler) return json(res, 404, { error: 'not found' });
#   req.db = await getDb();
#   try { await handler(req, res); }

router_old = """  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  try { await handler(req, res); }"""
router_new = """  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  req.db = await getDb();
  try { await handler(req, res); }"""
code = code.replace(router_old, router_new)

# Now we need to replace all `db.` accesses inside routes to `req.db.`
# But we have `db.` everywhere.
# Let's replace `db.` with `req.db.` inside routes...
# Actually, the easiest way in JS is to define `global.db = await getDb()` inside the request handler, 
# but that's bad for concurrency. Since Vercel instances process 1 request at a time mostly, maybe it's fine.
# Wait, Vercel Node.js CAN process concurrent requests if enabled, but usually it's fine to just pass `db`.
# Let's just do a string replace for all route code.
# The routes object starts at `const routes = {` and ends before `/* ---------- Coach: `

parts = code.split('const routes = {')
pre_routes = parts[0]
rest = parts[1]
routes_parts = rest.split('/* ---------- Coach: boot recovery')
routes_code = 'const routes = {' + routes_parts[0]
post_routes = '/* ---------- Coach: boot recovery' + routes_parts[1]

# In routes_code, replace `db.` with `req.db.`
routes_code = routes_code.replace(' db.', ' req.db.')
routes_code = routes_code.replace('!db.', '!req.db.')
routes_code = routes_code.replace('(db.', '(req.db.')
routes_code = routes_code.replace('saveDb();', 'await saveDb(req.db);')
routes_code = routes_code.replace('saveDb()', 'await saveDb(req.db)')
routes_code = routes_code.replace('atomicWrite(stateFile(user.id), JSON.stringify(body.state));', 'await writeState(user.id, body.state);')
routes_code = routes_code.replace('atomicWrite(stateFile(user.id), JSON.stringify(body.state))', 'await writeState(user.id, body.state)')
routes_code = routes_code.replace("readSession(req)", "readSession(req, req.db)")

# Update `readSession` to accept `db`
pre_routes = pre_routes.replace('function readSession(req) {', 'function readSession(req, db) {')
pre_routes = pre_routes.replace('function requireAdmin(req, res) {', 'function requireAdmin(req, res) {\\n  const db = req.db;')
pre_routes = pre_routes.replace('const user = readSession(req);', 'const user = readSession(req, db);')
routes_code = routes_code.replace('const user = readSession(req);', 'const user = readSession(req, req.db);')
routes_code = routes_code.replace('requireAdmin(req, res)', 'requireAdmin(req, res)')

# Remove setIntervals from pre_routes because they will hang Vercel
pre_routes = re.sub(r'setInterval\(.*?\}\)\.unref\(\);', '', pre_routes, flags=re.DOTALL)
pre_routes = re.sub(r'setInterval\(.*?\}, \d+\)\.unref\(\);', '', pre_routes, flags=re.DOTALL)
# One interval is `setInterval(() => { for (const user of db.users) ...` we just remove it entirely.
pre_routes = re.sub(r'setInterval\(\(\) => \{\n  for \(const user of db\.users\).*?10000\)\.unref\(\);', '', pre_routes, flags=re.DOTALL)

# Disable Coach background jobs for Vercel
post_routes = post_routes.replace('coachJobs.recoverOnBoot();', '// coachJobs.recoverOnBoot();')
post_routes = post_routes.replace('startCadence({ users: () => db.users, userNow });', '// startCadence({ users: () => req.db.users, userNow });')

# Vercel handler export instead of http.createServer
# Remove `http.createServer(...).listen(...)`
server_code = """http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const key = req.method + ' ' + url.pathname;
  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  req.db = await getDb();
  try { await handler(req, res); }
  catch (e) {
    console.error(key, e);
    if (!res.headersSent) json(res, 500, { error: 'server error' });
  }
}).listen(PORT, () => console.log(`gym-api on :${PORT} (rpID=${RP_ID}, origin=${ORIGIN})`));"""

vercel_export = """export default async function(req, res) {
  const url = new URL(req.url, 'http://x');
  const key = req.method + ' ' + url.pathname;
  const handler = routes[key];
  if (!handler) return json(res, 404, { error: 'not found' });
  req.db = await getDb();
  try { await handler(req, res); }
  catch (e) {
    console.error(key, e);
    if (!res.headersSent) json(res, 500, { error: 'server error' });
  }
}"""
post_routes = post_routes.replace(server_code, vercel_export)

with open('index.js', 'w') as f:
    f.write(pre_routes + routes_code + post_routes)
