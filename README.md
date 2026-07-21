# InfoPay

Investment platform offering daily ROI through forex, crypto, and real estate.
Users sign up, complete a lightweight KYC check, browse investment packages, 
and invest in fixed-return tiers — with amounts displayed in their local currency.

## Stack

- **Backend**: Express + TypeScript, Drizzle ORM, PostgreSQL (Supabase),
  JWT auth, Zod validation.
- **Frontend**: React 18 + Vite + TypeScript, Tailwind CSS, Zustand,
  React Router, Axios.

## Project structure

```
backend/
  src/
    db/          schema.ts (8 tables), index.ts (drizzle client)
    lib/         auth.ts (JWT/bcrypt helpers)
    middleware/  auth.ts (requireAuth, requireAdmin)
    routes/      auth, kyc, projects, investments, payments, users
    index.ts     Express app entry point
frontend/
  src/
    lib/         api.ts (axios client), store.ts (zustand auth store),
                 currency.ts (GHS conversion helpers)
    components/  Layout.tsx
    pages/       Login, Signup, Kyc, Dashboard, Projects, ProjectDetail,
                 Portfolio, NotFound
```

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:push        # creates tables in your Postgres/Supabase instance
npm run dev            # http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev             # http://localhost:5173
```

## Deployment (Render, single service)

Express serves the built frontend directly (see `backend/src/index.ts`),
so the whole app deploys as **one** Render Web Service instead of separate
frontend/backend deployments:

- **Build command**: `npm run build` (installs + builds frontend, then
  installs + builds backend)
- **Start command**: `npm start` (runs the compiled backend, which also
  serves `frontend/dist` and falls back to `index.html` for client-side
  routes)
- **Root directory**: repo root

A `render.yaml` is included for Render's Blueprint deploy — it lists every
env var the backend needs (`DATABASE_URL`, `JWT_SECRET`, `MOOLRE_*`,
`NOWPAYMENTS_*`, etc.) as `sync: false`, meaning Render will prompt you to
fill in the actual values rather than pulling them from this repo (none of
that is committed).

After deploying, update:
- `NOWPAYMENTS_IPN_CALLBACK_URL` to `https://<your-render-url>/api/payments/crypto/ipn`
- `FRONTEND_URL` to your Render URL (used for CORS)

Local dev is unaffected — `frontend` and `backend` still run as two
separate dev servers (`npm run dev` in each), talking to each other via
`VITE_API_URL` in `frontend/.env.local`.

## Notes

- `backend/.env` and `frontend/.env.local` are gitignored — never commit
  real credentials. If a database password was ever shared in a chat or
  doc, rotate it in Supabase before using it.
- Paystack and crypto payment routes (`backend/src/routes/payments.ts`) are
  stubbed — wire up the live Paystack API call and webhook signature
  verification before accepting real payments.
- Currency conversion rates in `frontend/src/lib/currency.ts` are static
  placeholders; swap in a live FX feed for production.
