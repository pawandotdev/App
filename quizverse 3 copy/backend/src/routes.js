import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
const db = new PrismaClient(), r = Router();
const wrap = f => (req, res, next) => f(req, res).catch(next);
const prod = process.env.NODE_ENV === "production";
const LEVELS = [[0,"Beginner"],[100,"Learner"],[300,"Explorer"],[600,"Expert"],[1000,"Master"]];
const level = xp => { let l = 0; LEVELS.forEach(([m], i) => { if (xp >= m) l = i; }); return { level: l+1, title: LEVELS[l][1] }; };
const safe = ({ password, ...u }) => ({ ...u, ...level(u.xp) });
const cookieOpts = { httpOnly: true, secure: prod, sameSite: prod ? "none" : "lax" };
const auth = wrap(async (req, res, next) => {
  try { const { id } = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
    req.user = await db.user.findUnique({ where: { id } }); } catch {}
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  next();
});
const setCookie = (res, id) => res.cookie("token", jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" }), { ...cookieOpts, maxAge: 7*864e5 });

r.post("/auth/register", wrap(async (req, res) => {
  const b = z.object({ username: z.string().min(3), email: z.string().email(), password: z.string().min(8) }).parse(req.body);
  try {
    const u = await db.user.create({ data: { ...b, password: await bcrypt.hash(b.password, 10) } });
    setCookie(res, u.id); res.status(201).json(safe(u));
  } catch { res.status(409).json({ error: "Username or email already taken" }); }
}));
r.post("/auth/login", wrap(async (req, res) => {
  const b = z.object({ email: z.string(), password: z.string() }).parse(req.body);
  const u = await db.user.findUnique({ where: { email: b.email } });
  if (!u || !(await bcrypt.compare(b.password, u.password))) return res.status(401).json({ error: "Invalid credentials" });
  setCookie(res, u.id); res.json(safe(u));
}));
r.post("/auth/logout", (req, res) => { res.clearCookie("token", cookieOpts); res.json({ ok: true }); });
r.get("/auth/me", auth, (req, res) => res.json(safe(req.user)));

r.get("/categories", wrap(async (_, res) => res.json(await db.category.findMany({ include: { quizzes: { select: { id: true, title: true, difficulty: true } } } }))));

r.post("/quizzes/:id/start", auth, wrap(async (req, res) => {
  const quiz = await db.quiz.findUnique({ where: { id: +req.params.id }, include: { questions: { include: { options: { select: { id: true, text: true } } } } } });
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  const a = await db.quizAttempt.create({ data: { userId: req.user.id, quizId: quiz.id } });
  res.status(201).json({ attemptId: a.id, title: quiz.title, timeLimit: quiz.timeLimit, questions: quiz.questions });
}));

const getAttempt = async (req, res) => {
  const a = await db.quizAttempt.findUnique({ where: { id: +req.params.id }, include: { quiz: true } });
  if (!a || a.userId !== req.user.id) { res.status(404).json({ error: "Attempt not found" }); return null; }
  if (a.status !== "IN_PROGRESS") { res.status(409).json({ error: "Attempt already completed" }); return null; }
  return a;
};
r.post("/attempts/:id/answer", auth, wrap(async (req, res) => {
  const { questionId, optionId } = z.object({ questionId: z.number(), optionId: z.number() }).parse(req.body);
  const a = await getAttempt(req, res); if (!a) return;
  const opt = await db.answerOption.findUnique({ where: { id: optionId }, include: { question: true } });
  if (!opt || opt.questionId !== questionId || opt.question.quizId !== a.quizId) return res.status(400).json({ error: "Invalid option" });
  try { await db.userAnswer.create({ data: { attemptId: a.id, questionId, optionId, isCorrect: opt.isCorrect } }); }
  catch { return res.status(409).json({ error: "Already answered" }); }
  res.json({ saved: true });
}));
r.post("/attempts/:id/submit", auth, wrap(async (req, res) => {
  const a = await getAttempt(req, res); if (!a) return;
  const total = await db.question.count({ where: { quizId: a.quizId } });
  const correct = await db.userAnswer.count({ where: { attemptId: a.id, isCorrect: true } });
  const per = { EASY: 10, MEDIUM: 20, HARD: 30 }[a.quiz.difficulty];
  const xp = correct * per + 10 + (correct === total ? 25 : 0);
  const claimed = await db.quizAttempt.updateMany({ where: { id: a.id, status: "IN_PROGRESS" }, data: { status: "COMPLETED", completedAt: new Date(), score: correct, xpEarned: xp } });
  if (claimed.count === 0) return res.status(409).json({ error: "Reward already claimed" });
  const user = await db.user.update({ where: { id: req.user.id }, data: { xp: { increment: xp } } });
  const keys = ["first_quiz"]; if (correct === total) keys.push("perfect_score");
  const unlocked = [];
  for (const k of keys) {
    const ach = await db.achievement.findUnique({ where: { key: k } });
    if (!ach) continue;
    const had = await db.userAchievement.findUnique({ where: { userId_achievementId: { userId: user.id, achievementId: ach.id } } });
    if (!had) { await db.userAchievement.create({ data: { userId: user.id, achievementId: ach.id } }); unlocked.push(ach.name); }
  }
  res.json({ total, correct, incorrect: total - correct, xpEarned: xp, newAchievements: unlocked, ...level(user.xp), totalXp: user.xp });
}));

r.get("/users/history", auth, wrap(async (req, res) => res.json(await db.quizAttempt.findMany({ where: { userId: req.user.id, status: "COMPLETED" }, include: { quiz: { select: { title: true } } }, orderBy: { completedAt: "desc" }, take: 20 }))));
r.get("/users/achievements", auth, wrap(async (req, res) => res.json(await db.userAchievement.findMany({ where: { userId: req.user.id }, include: { achievement: true } }))));
r.patch("/users/profile", auth, wrap(async (req, res) => {
  const { bio } = z.object({ bio: z.string().max(200) }).parse(req.body);
  res.json(safe(await db.user.update({ where: { id: req.user.id }, data: { bio } })));
}));
r.get("/leaderboard", wrap(async (_, res) => {
  const us = await db.user.findMany({ orderBy: { xp: "desc" }, take: 50, select: { id: true, username: true, xp: true } });
  res.json(us.map((u, i) => ({ rank: i+1, ...u, ...level(u.xp) })));
}));
export default r;
