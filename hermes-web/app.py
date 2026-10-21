import os, sqlite3, secrets, hashlib, hmac, time, json
from pathlib import Path
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

ROOT=Path(__file__).parent
DB=os.getenv("DATABASE_PATH",str(ROOT/"data.sqlite3"))
SECRET=os.getenv("SECRET_KEY","")
OWNER=os.getenv("OWNER_EMAIL","").strip().lower()
AI_BASE_URL=os.getenv("AI_BASE_URL","https://openrouter.ai/api").rstrip("/")
AI_API_KEY=os.getenv("AI_API_KEY","")
AI_MODEL=os.getenv("AI_MODEL","openrouter/free")
LIMIT=max(1,int(os.getenv("DAILY_MESSAGE_LIMIT","50")))
app=FastAPI(title="Hermes AI Yosep",docs_url=None,redoc_url=None)

def connect():
    Path(DB).parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB,timeout=20); c.row_factory=sqlite3.Row; return c
with connect() as c:
    c.execute("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,password TEXT,salt TEXT,role TEXT,created TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY,uid INTEGER,title TEXT,messages TEXT,updated TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS usage(uid INTEGER,day TEXT,n INTEGER,PRIMARY KEY(uid,day))")

def pw_hash(p,s): return hashlib.scrypt(p.encode(),salt=s,n=16384,r=8,p=1).hex()
def token(uid):
    if len(SECRET)<32: raise HTTPException(503,"Admin harus mengatur SECRET_KEY minimal 32 karakter.")
    payload=f"{uid}.{int(time.time())+1209600}"
    sig=hmac.new(SECRET.encode(),payload.encode(),hashlib.sha256).hexdigest()
    return payload+"."+sig
def user(request:Request):
    t=request.cookies.get("hermes_session","")
    try:
        uid,exp,sig=t.split(".")
        p=f"{uid}.{exp}"; good=hmac.new(SECRET.encode(),p.encode(),hashlib.sha256).hexdigest()
        if len(SECRET)<32 or not hmac.compare_digest(sig,good) or int(exp)<time.time(): raise ValueError()
        with connect() as c: u=c.execute("SELECT id,email,role FROM users WHERE id=?",(int(uid),)).fetchone()
        if not u: raise ValueError()
        return dict(u)
    except Exception: raise HTTPException(401,"Silakan masuk kembali.")
class Auth(BaseModel):
    email:str=Field(min_length=5,max_length=254)
    password:str=Field(min_length=10,max_length=200)
class Message(BaseModel):
    message:str=Field(min_length=1,max_length=10000)
    chat_id:str|None=None

@app.get("/api/health")
def health(): return {"ok":True,"ai_configured":bool(AI_BASE_URL and AI_API_KEY and AI_MODEL)}
@app.get("/",response_class=HTMLResponse)
def home(): return (ROOT/"index.html").read_text(encoding="utf-8")
@app.post("/api/register")
def register(a:Auth,res:Response):
    email=a.email.strip().lower()
    if "@" not in email or len(SECRET)<32: raise HTTPException(400,"Email tidak valid atau server belum dikonfigurasi.")
    salt=secrets.token_bytes(16); role="admin" if OWNER and email==OWNER else "user"
    try:
        with connect() as c:
            cur=c.execute("INSERT INTO users(email,password,salt,role,created) VALUES(?,?,?,?,?)",(email,pw_hash(a.password,salt),salt.hex(),role,datetime.now(timezone.utc).isoformat()))
            uid=cur.lastrowid
    except sqlite3.IntegrityError: raise HTTPException(409,"Email sudah terdaftar.")
    res.set_cookie("hermes_session",token(uid),httponly=True,secure=True,samesite="lax",max_age=1209600)
    return {"ok":True,"email":email,"role":role}
@app.post("/api/login")
def login(a:Auth,res:Response):
    email=a.email.strip().lower()
    with connect() as c: u=c.execute("SELECT * FROM users WHERE email=?",(email,)).fetchone()
    if not u or not hmac.compare_digest(pw_hash(a.password,bytes.fromhex(u["salt"])),u["password"]): raise HTTPException(401,"Email atau kata sandi salah.")
    res.set_cookie("hermes_session",token(u["id"]),httponly=True,secure=True,samesite="lax",max_age=1209600)
    return {"ok":True,"email":email,"role":u["role"]}
@app.post("/api/logout")
def logout(res:Response):
    res.delete_cookie("hermes_session",httponly=True,secure=True,samesite="lax"); return {"ok":True}
@app.get("/api/me")
def me(u=Depends(user)): return {"user":u}
@app.get("/api/chats")
def chats(u=Depends(user)):
    with connect() as c: rows=c.execute("SELECT id,title,updated FROM chats WHERE uid=? ORDER BY updated DESC LIMIT 100",(u["id"],)).fetchall()
    return {"chats":[dict(x) for x in rows]}
@app.get("/api/chats/{cid}")
def get_chat(cid:str,u=Depends(user)):
    with connect() as c: x=c.execute("SELECT * FROM chats WHERE id=? AND uid=?",(cid,u["id"])).fetchone()
    if not x: raise HTTPException(404,"Chat tidak ditemukan.")
    return {"id":x["id"],"title":x["title"],"messages":json.loads(x["messages"])}
@app.get("/api/admin/stats")
def stats(u=Depends(user)):
    if u["role"]!="admin": raise HTTPException(403,"Khusus admin.")
    today=datetime.now(timezone.utc).date().isoformat()
    with connect() as c:
        users=c.execute("SELECT count(*) n FROM users").fetchone()["n"]
        chats=c.execute("SELECT count(*) n FROM chats").fetchone()["n"]
        msgs=c.execute("SELECT coalesce(sum(n),0) n FROM usage WHERE day=?",(today,)).fetchone()["n"]
    return {"users":users,"chats":chats,"messages_today":msgs,"daily_limit":LIMIT}
@app.post("/api/chat")
async def chat(a:Message,u=Depends(user)):
    if not AI_BASE_URL or not AI_API_KEY or not AI_MODEL: raise HTTPException(503,"AI belum terhubung. Admin perlu mengatur AI_BASE_URL, AI_API_KEY, dan AI_MODEL.")
    today=datetime.now(timezone.utc).date().isoformat()
    with connect() as c:
        used=c.execute("SELECT n FROM usage WHERE uid=? AND day=?",(u["id"],today)).fetchone()
        if used and used["n"]>=LIMIT: raise HTTPException(429,f"Batas harian tercapai: {LIMIT} pesan.")
        if a.chat_id:
            row=c.execute("SELECT * FROM chats WHERE id=? AND uid=?",(a.chat_id,u["id"])).fetchone()
            if not row: raise HTTPException(404,"Chat tidak ditemukan.")
            cid=row["id"]; msgs=json.loads(row["messages"])
        else:
            cid=secrets.token_urlsafe(18); msgs=[]
            c.execute("INSERT INTO chats VALUES(?,?,?,?,?)",(cid,u["id"],a.message[:60],"[]",datetime.now(timezone.utc).isoformat()))
        msgs.append({"role":"user","content":a.message}); msgs=msgs[-30:]
        c.execute("INSERT INTO usage VALUES(?,?,1) ON CONFLICT(uid,day) DO UPDATE SET n=n+1",(u["id"],today))
    session=hashlib.sha256(f"{u['id']}:{cid}".encode()).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            r=await client.post(AI_BASE_URL+"/v1/chat/completions",headers={"Authorization":"Bearer "+AI_API_KEY,"HTTP-Referer":"https://hermes-yosep.onrender.com","X-Title":"Hermes AI Yosep","X-Hermes-Session-Key":session},json={"model":AI_MODEL,"messages":msgs,"stream":False})
        if r.status_code>=400: raise HTTPException(502,f"Server AI error {r.status_code}. Periksa model, API key, dan provider.")
        answer=r.json()["choices"][0]["message"]["content"]
        if not isinstance(answer,str) or not answer.strip(): raise ValueError()
    except HTTPException: raise
    except httpx.TimeoutException: raise HTTPException(504,"Layanan AI terlalu lama merespons.")
    except Exception: raise HTTPException(502,"Tidak bisa menghubungi layanan AI atau format jawaban tidak valid.")
    msgs.append({"role":"assistant","content":answer})
    with connect() as c: c.execute("UPDATE chats SET messages=?,updated=? WHERE id=? AND uid=?",(json.dumps(msgs,ensure_ascii=False),datetime.now(timezone.utc).isoformat(),cid,u["id"]))
    return {"chat_id":cid,"answer":answer,"used_today":(used["n"] if used else 0)+1,"daily_limit":LIMIT}
