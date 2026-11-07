# QuizVerse
## Run locally
1. Create a free Neon database and copy its connection string.
2. In backend/: copy .env.example to .env and fill it in, then
   npm install && npx prisma migrate dev --name init && npm run seed && npm run dev
3. In frontend/: copy .env.example to .env, then npm install && npm run dev
4. Open http://localhost:5173
## Deploy
- GitHub: push the repo. Neon: the database.
- Render Web Service: root backend, build "npm install && npm run build", start "npm start", env DATABASE_URL, JWT_SECRET, CLIENT_URL (your Vercel URL), NODE_ENV=production.
- Vercel: root frontend, env VITE_API_URL=https://YOUR-RENDER-URL/api
- Seed production once: put the Neon DATABASE_URL in backend/.env and run npm run seed.
