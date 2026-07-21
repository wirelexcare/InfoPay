# InfoPay - Two-Service Deployment Guide

This guide covers deploying InfoPay as **two independent services** (Backend API + Frontend Web).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Frontend (React + Vite)      Backend (Express Node)    │
│  Port: 5173 (dev) / 80 (prod) Port: 3001 (dev/prod)     │
│                                                         │
│  ↓ API Calls                  ↓ Database Queries        │
│                                                         │
│  http://localhost:3001 ←→ Supabase PostgreSQL           │
│                         (oljckifwzejgvuejnfwr)          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Get Supabase Credentials

### From Supabase Dashboard:

1. Go to: https://app.supabase.com/project/oljckifwzejgvuejnfwr/settings/database
   - Find **"Connection string"** section
   - Extract database password
   - Build DATABASE_URL: `postgresql://postgres:PASSWORD@oljckifwzejgvuejnfwr.supabase.co:5432/postgres`

2. Go to: https://app.supabase.com/project/oljckifwzejgvuejnfwr/settings/api
   - Copy **"Project URL"** → Use as `SUPABASE_URL`
   - Copy **"anon public"** key → Use as `SUPABASE_ANON_KEY`
   - Copy **"service_role"** key → Use as `SUPABASE_SERVICE_KEY`

---

## Step 2: Configure Backend Service

### Edit `backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@oljckifwzejgvuejnfwr.supabase.co:5432/postgres

# Server
NODE_ENV=production
PORT=3001
API_URL=https://api.your-domain.com    # Your backend domain
FRONTEND_URL=https://your-domain.com   # Your frontend domain

# Supabase
SUPABASE_URL=https://oljckifwzejgvuejnfwr.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...  # Copy from Settings > API
SUPABASE_SERVICE_KEY=eyJhbGc...  # Copy from Settings > API

# JWT (Generate secure random values)
JWT_SECRET=aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d

# Cron
CRON_SECRET=xY9zA8bC7dE6fG5hI4jK3lM2nO1pQ0rS9tU8vW7xY6zA5bC

# Payment gateways (get from their dashboards)
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
MOOLRE_API_KEY=...
NOWPAYMENTS_API_KEY=...
```

### Initialize Database:

```bash
cd backend
npm install
npm run db:push      # Create tables in Supabase
npm run db:seed      # Optional: Load sample investment packages
```

### Test Backend:

```bash
npm run dev
# Should see: "InfoPay API listening on http://localhost:3001"
```

---

## Step 3: Configure Frontend Service

### Edit `frontend/.env.local` (or `.env.production`):

```bash
VITE_API_URL=https://api.your-domain.com    # Backend service URL
VITE_APP_NAME=InfoPay
VITE_APP_URL=https://your-domain.com        # Frontend domain
```

### Test Frontend:

```bash
cd frontend
npm install
npm run dev
# Should open http://localhost:5173
# Verify light blue theme and "Investment Packages" page loads
```

---

## Deployment Option 1: Render (Recommended)

### Backend Deployment:

1. Push code to GitHub
2. In Render: **New Web Service**
3. Connect GitHub repo
4. Settings:
   - **Environment**: Node
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Region**: Choose closest to users
5. Add **Environment Variables** (all from `.env`):
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CRON_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - Payment keys (if needed)
6. Deploy
7. Note the URL: `https://infopay-api-xxxxx.onrender.com`

### Frontend Deployment:

1. Update `frontend/.env.production`:
   ```
   VITE_API_URL=https://infopay-api-xxxxx.onrender.com
   ```

2. In Render: **New Static Site**
3. Connect GitHub repo
4. Settings:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
5. Deploy
6. Access at: `https://infopay-web-xxxxx.onrender.com`

---

## Deployment Option 2: Docker Containers (Advanced)

### Backend Dockerfile:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile:

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      # ... other vars
  
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

---

## Deployment Option 3: Railway, Fly.io, or Vercel

Each has similar workflows. Key points:
- **Backend**: Deploy as API service on your chosen platform
- **Frontend**: Deploy frontend separately, point to backend API
- **Environment Variables**: Set all .env values in platform dashboard

---

## Environment Checklist

### Before Production:

- [ ] DATABASE_URL points to production Supabase database
- [ ] JWT_SECRET is a strong random value (use `openssl rand -hex 32`)
- [ ] CRON_SECRET is changed
- [ ] NODE_ENV=production
- [ ] FRONTEND_URL and API_URL use HTTPS
- [ ] CORS configured for your domains
- [ ] All payment gateway keys are live (not test) keys
- [ ] Database backups enabled in Supabase
- [ ] SSL certificates installed
- [ ] Rate limiting configured

---

## Monitoring & Logs

### Backend Logs:
- Render: View in **Logs** tab
- Local: `npm run dev` outputs to console

### Frontend Logs:
- Check browser console (F12)
- Check Render/platform logs for build errors

### Database:
- Monitor via Supabase Dashboard
- Check query performance in **SQL Editor**

---

## Scaling

### Backend:
- Increase Render plan for more instances
- Consider caching layer (Redis) for frequently accessed packages
- Use database connection pooling

### Frontend:
- Static site caching at edge
- Compress assets
- Lazy load components

---

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Verify Supabase project is active
- Check IP whitelist in Supabase

### "CORS error on frontend"
- Verify FRONTEND_URL in backend .env
- Check browser dev tools for actual origin being blocked

### "ROI calculations not running"
- Ensure backend is running continuously
- Check CRON_SECRET is accessible
- Monitor backend logs for errors

---

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Render Docs**: https://render.com/docs
- **Express.js**: https://expressjs.com
- **React/Vite**: https://vitejs.dev
