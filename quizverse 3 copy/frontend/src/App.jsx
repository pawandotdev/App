import { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Link, Navigate, useNavigate, useParams } from "react-router-dom";
import api from "./api.js";
const Auth = createContext();
const useAuth = () => useContext(Auth);
const errMsg = e => e.response?.data?.error || "Something went wrong";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="wrap">Loading...</p>;
  return user ? children : <Navigate to="/login" />;
}
function Nav() {
  const { user, setUser } = useAuth(); const nav = useNavigate();
  const out = async () => { await api.post("/auth/logout"); setUser(null); nav("/"); };
  return <nav><Link to="/" className="logo">QuizVerse</Link><Link to="/categories">Quizzes</Link><Link to="/leaderboard">Leaderboard</Link>
    {user ? <><Link to="/dashboard">{user.username} · Lv {user.level}</Link><button onClick={out}>Logout</button></>
          : <><Link to="/login">Login</Link><Link to="/register" className="btn">Sign up</Link></>}</nav>;
}
function Landing() {
  return <div className="wrap"><h1>Learn. Play. Level up.</h1><p className="mu">QuizVerse is a quiz platform where every right answer earns XP, badges and a place on the leaderboard.</p>
    <Link to="/categories" className="btn">Explore quizzes</Link></div>;
}
function AuthForm({ mode }) {
  const { setUser } = useAuth(); const nav = useNavigate();
  const [f, setF] = useState({ username: "", email: "", password: "" }); const [err, setErr] = useState("");
  const submit = async e => { e.preventDefault(); setErr("");
    try { const { data } = await api.post(`/auth/${mode}`, f); setUser(data); nav("/dashboard"); } catch (x) { setErr(errMsg(x)); } };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return <div className="wrap"><form className="card" onSubmit={submit}><h2>{mode === "login" ? "Login" : "Create account"}</h2>
    {mode === "register" && <input placeholder="Username (3+ chars)" value={f.username} onChange={set("username")} />}
    <input placeholder="Email" type="email" value={f.email} onChange={set("email")} />
    <input placeholder="Password (8+ chars)" type="password" value={f.password} onChange={set("password")} />
    {err && <p className="err">{err}</p>}<button>{mode === "login" ? "Login" : "Register"}</button></form></div>;
}
function Categories() {
  const [cats, setCats] = useState(null);
  useEffect(() => { api.get("/categories").then(r => setCats(r.data)); }, []);
  if (!cats) return <p className="wrap">Loading...</p>;
  return <div className="wrap">{cats.map(c => <div key={c.id}><h2>{c.name}</h2><div className="grid">
    {c.quizzes.map(q => <div className="card" key={q.id}><h3>{q.title}</h3><span className="tag">{q.difficulty}</span><p><Link className="btn" to={`/quiz/${q.id}`}>Start</Link></p></div>)}</div></div>)}</div>;
}
function Quiz() {
  const { id } = useParams(); const [s, setS] = useState(null); const [i, setI] = useState(0);
  const [sel, setSel] = useState(null); const [locked, setLocked] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState(""); const [t, setT] = useState(0);
  const { setUser } = useAuth();
  useEffect(() => { api.post(`/quizzes/${id}/start`).then(r => setS(r.data)).catch(x => setErr(errMsg(x))); }, [id]);
  useEffect(() => { const h = setInterval(() => setT(v => v + 1), 1000); return () => clearInterval(h); }, []);
  if (err) return <p className="wrap err">{err}</p>;
  if (res) return <Result r={res} />;
  if (!s) return <p className="wrap">Loading...</p>;
  const q = s.questions[i];
  const next = async () => {
    setLocked(true);
    try {
      await api.post(`/attempts/${s.attemptId}/answer`, { questionId: q.id, optionId: sel });
      if (i + 1 < s.questions.length) { setI(i + 1); setSel(null); }
      else { const { data } = await api.post(`/attempts/${s.attemptId}/submit`); setRes(data); setUser((await api.get("/auth/me")).data); }
    } catch (x) { setErr(errMsg(x)); }
    setLocked(false);
  };
  return <div className="wrap"><div className="card"><p className="mu">{s.title} · Question {i + 1}/{s.questions.length} · {t}s</p>
    <div className="bar"><div style={{ width: `${(i / s.questions.length) * 100}%` }} /></div><h2>{q.text}</h2>
    {q.options.map(o => <button key={o.id} className={`opt ${sel === o.id ? "sel" : ""}`} onClick={() => setSel(o.id)}>{o.text}</button>)}
    <button disabled={!sel || locked} onClick={next}>{i + 1 < s.questions.length ? "Next" : "Finish"}</button></div></div>;
}
function Result({ r }) {
  return <div className="wrap"><div className="card"><h1>Result</h1><p>{r.correct} / {r.total} correct ({r.incorrect} wrong)</p>
    <p>+{r.xpEarned} XP · Total {r.totalXp} XP · Level {r.level} ({r.title})</p>
    {r.newAchievements.map(a => <p key={a}>Unlocked: <b>{a}</b></p>)}<Link className="btn" to="/categories">More quizzes</Link></div></div>;
}
function Dashboard() {
  const { user, setUser } = useAuth(); const [h, setH] = useState([]); const [ach, setAch] = useState([]); const [bio, setBio] = useState(user.bio);
  useEffect(() => { api.get("/users/history").then(r => setH(r.data)); api.get("/users/achievements").then(r => setAch(r.data)); }, []);
  const save = async () => setUser((await api.patch("/users/profile", { bio })).data);
  return <div className="wrap"><div className="card"><h2>{user.username}</h2><p>Level {user.level} · {user.title} · {user.xp} XP</p>
    <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Your bio" /><button onClick={save}>Save bio</button></div>
    <div className="card"><h3>Achievements</h3>{ach.length ? ach.map(a => <span className="tag" key={a.achievementId}>{a.achievement.name} </span>) : <p className="mu">None yet. Take a quiz!</p>}</div>
    <div className="card"><h3>Recent activity</h3>{h.length ? h.map(a => <p key={a.id}>{a.quiz.title}: {a.score} correct, +{a.xpEarned} XP</p>) : <p className="mu">No quizzes yet.</p>}</div></div>;
}
function Leaderboard() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/leaderboard").then(r => setRows(r.data)); }, []);
  if (!rows) return <p className="wrap">Loading...</p>;
  return <div className="wrap"><h2>Leaderboard</h2>{rows.map(u => <div className="card" key={u.id}>#{u.rank} <b>{u.username}</b> · {u.xp} XP · Lv {u.level} {u.title}</div>)}</div>;
}
export default function App() {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/auth/me").then(r => setUser(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return <Auth.Provider value={{ user, setUser, loading }}><Nav /><Routes>
    <Route path="/" element={<Landing />} /><Route path="/login" element={<AuthForm mode="login" />} /><Route path="/register" element={<AuthForm mode="register" />} />
    <Route path="/categories" element={<Categories />} /><Route path="/leaderboard" element={<Leaderboard />} />
    <Route path="/quiz/:id" element={<Protected><Quiz /></Protected>} /><Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
  </Routes></Auth.Provider>;
}
