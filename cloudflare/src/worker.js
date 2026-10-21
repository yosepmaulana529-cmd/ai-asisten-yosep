const encoder = new TextEncoder();
const COOKIE = "yosep_session";
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
});
const fail = (message, status = 400) => json({ detail: message }, status);
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = (s) => { const raw=s.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(raw+"=".repeat((4-raw.length%4)%4)), c=>c.charCodeAt(0)); };
async function digestPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({name:"PBKDF2", salt:unb64(salt), iterations:210000, hash:"SHA-256"}, key, 256));
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}
async function sessionToken(uid, env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const payload = uid + "." + (Math.floor(Date.now()/1000) + 1209600);
  return payload + "." + await sign(payload, env.SESSION_SECRET);
}
async function currentUser(request, env) {
  const cookies = Object.fromEntries((request.headers.get("Cookie")||"").split(";").map(v=>v.trim().split(/=(.*)/s).slice(0,2)).filter(v=>v.length===2));
  const token = cookies[COOKIE] || "";
  const parts = token.split(".");
  if (parts.length !== 3 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return null;
  const payload = parts[0]+"."+parts[1];
  if (Number(parts[1]) < Math.floor(Date.now()/1000) || await sign(payload,env.SESSION_SECRET) !== parts[2]) return null;
  return await env.DB.prepare("SELECT id,email,role FROM users WHERE id=?").bind(parts[0]).first();
}
const cookieHeader = (token, maxAge=1209600) => COOKIE+"="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+maxAge;
const dayKey = () => new Date().toISOString().slice(0,10);
async function handle(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path === "/api/health" && request.method === "GET") { let dbReady=false; try { await env.DB.prepare("SELECT 1 AS ok").first(); dbReady=true; } catch {} return json({ok:true,ai_configured:!!env.AI,database_ready:dbReady,session_secret_ready:!!env.SESSION_SECRET && env.SESSION_SECRET.length>=32,owner_email_configured:!!env.OWNER_EMAIL}); }
  if (path === "/api/register" && request.method === "POST") {
    let a; try {a=await request.json()} catch{return fail("JSON tidak valid")}
    const email=String(a.email||"").trim().toLowerCase(), password=String(a.password||"");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<10 || password.length>200) return fail("Email tidak valid atau kata sandi harus 10–200 karakter.");
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length<32) return fail("Server belum dikonfigurasi.",503);
    let dbReady; try { dbReady=!!env.DB; await env.DB.prepare("SELECT 1").first(); } catch { return fail("Database akun belum terhubung atau tabel belum dibuat. Periksa binding D1 dan jalankan migrasi.",503); }
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))), hash=await digestPassword(password,salt), id=crypto.randomUUID();
    const role=env.OWNER_EMAIL && email===env.OWNER_EMAIL.toLowerCase() ? "admin" : "user";
    try { await env.DB.prepare("INSERT INTO users(id,email,password_hash,salt,role,created_at) VALUES(?,?,?,?,?,?)").bind(id,email,hash,salt,role,new Date().toISOString()).run(); }
    catch { return fail("Email sudah terdaftar atau database belum siap.",409); }
    return json({ok:true,email,role},200,{ "set-cookie": await sessionToken(id,env).then(t=>cookieHeader(t)) });
  }
  if (path === "/api/login" && request.method === "POST") {
    let a; try {a=await request.json()} catch{return fail("JSON tidak valid")}
    const email=String(a.email||"").trim().toLowerCase(), password=String(a.password||"");
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length<32) return fail("Server belum dikonfigurasi: SESSION_SECRET belum disetel.",503);
    let u; try { u=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first(); } catch { return fail("Database akun belum siap. Periksa binding D1 dan migrasi tabel users.",503); }
    if (!u || await digestPassword(password,u.salt) !== u.password_hash) return fail("Email atau kata sandi salah.",401);
    return json({ok:true,email:u.email,role:u.role},200,{"set-cookie":await sessionToken(u.id,env).then(t=>cookieHeader(t))});
  }
  if (path === "/api/logout" && request.method === "POST") return json({ok:true},200,{"set-cookie":cookieHeader("",0)});
  if (path.startsWith("/api/")) {
    const u=await currentUser(request,env);
    if (!u) return fail("Silakan masuk kembali.",401);
    if (path === "/api/me" && request.method === "GET") return json({user:u});
    if (path === "/api/chats" && request.method === "GET") {
      const rows=await env.DB.prepare("SELECT id,title,updated_at AS updated FROM chats WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(u.id).all();
      return json({chats:rows.results||[]});
    }
    const chatMatch=path.match(/^\/api\/chats\/([^/]+)$/);
    if (chatMatch && request.method==="GET") {
      const c=await env.DB.prepare("SELECT id,title,messages FROM chats WHERE id=? AND user_id=?").bind(chatMatch[1],u.id).first();
      return c?json({id:c.id,title:c.title,messages:JSON.parse(c.messages)}):fail("Chat tidak ditemukan.",404);
    }
    if (path === "/api/admin/stats" && request.method==="GET") {
      if (u.role!=="admin") return fail("Khusus admin.",403);
      const [users,chats,msgs]=await Promise.all([
        env.DB.prepare("SELECT COUNT(*) n FROM users").first(),
        env.DB.prepare("SELECT COUNT(*) n FROM chats").first(),
        env.DB.prepare("SELECT COALESCE(SUM(n),0) n FROM usage WHERE day=?").bind(dayKey()).first()
      ]);
      return json({users:users.n,chats:chats.n,messages_today:msgs.n,daily_limit:Number(env.DAILY_MESSAGE_LIMIT||50)});
    }
    if (path === "/api/chat" && request.method==="POST") {
      let a; try {a=await request.json()} catch{return fail("JSON tidak valid")}
      const message=String(a.message||"").trim();
      if (!message || message.length>10000) return fail("Pesan wajib diisi (maksimum 10.000 karakter).");
      const limit=Math.max(1,Number(env.DAILY_MESSAGE_LIMIT||50)), today=dayKey();
      const used=await env.DB.prepare("SELECT n FROM usage WHERE user_id=? AND day=?").bind(u.id,today).first();
      if (used && used.n>=limit) return fail("Batas harian tercapai: "+limit+" pesan.",429);
      let cid=a.chat_id, messages=[];
      if (cid) {
        const c=await env.DB.prepare("SELECT id,messages FROM chats WHERE id=? AND user_id=?").bind(cid,u.id).first();
        if (!c) return fail("Chat tidak ditemukan.",404);
        messages=JSON.parse(c.messages);
      } else { cid=crypto.randomUUID(); }
      messages.push({role:"user",content:message}); messages=messages.slice(-30);
      try {
        const result=await env.AI.run("@cf/meta/llama-3.1-8b-instruct",{messages, max_tokens:1024});
        const answer=result.response || result.result?.response || "";
        if (!answer.trim()) return fail("Model AI tidak memberikan jawaban. Coba lagi.",502);
        messages.push({role:"assistant",content:answer});
        const now=new Date().toISOString();
        if (a.chat_id) await env.DB.prepare("UPDATE chats SET messages=?,updated_at=? WHERE id=? AND user_id=?").bind(JSON.stringify(messages),now,cid,u.id).run();
        else await env.DB.prepare("INSERT INTO chats(id,user_id,title,messages,updated_at) VALUES(?,?,?,?,?)").bind(cid,u.id,message.slice(0,60),JSON.stringify(messages),now).run();
        await env.DB.prepare("INSERT INTO usage(user_id,day,n) VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET n=n+1").bind(u.id,today).run();
        return json({chat_id:cid,answer,used_today:(used?.n||0)+1,daily_limit:limit});
      } catch(e) { return fail("Layanan AI belum siap atau kuota gratis habis. Coba lagi nanti.",502); }
    }
    return fail("Endpoint tidak ditemukan.",404);
  }
  return env.ASSETS.fetch(request);
}
export default { async fetch(request, env) { try { return await handle(request,env); } catch(e) { return json({detail:"Kesalahan server. Periksa konfigurasi dan database."},500); } } };
