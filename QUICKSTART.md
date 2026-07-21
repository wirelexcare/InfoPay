# InfoPay - Quick Start Guide

**Unified Deployment**: Backend + Frontend deployed as ONE service.

---

## Prerequisites

- Node.js 18+
- Git
- Supabase Account (project already set up)

---

## Step 1: Get Supabase Credentials

Your Supabase project is ready at: **oljckifwzejgvuejnfwr**

### Access Token (Already provided):
Store securely - provided separately, do not share or commit to repository.

### Get Connection Details:

1. Go to: https://app.supabase.com/project/oljckifwzejgvuejnfwr/settings/database

2. Copy the **Connection String** section, you'll see:
   ```
   postgresql://postgres:[password]@oljckifwzejgvuejnfwr.supabase.co:5432/postgres
   ```
   - Extract the password from the connection string

3. Go to: https://app.supabase.com/project/oljckifwzejgvuejnfwr/settings/api

4. Copy these keys:
   - **Project URL** (SUPABASE_URL)
   - **anon public** key (SUPABASE_ANON_KEY)
   - **service_role** key (SUPABASE_SERVICE_KEY)

---

## Step 2: Configure Environment

### Backend `.env` setup:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and replace placeholders:

```bash
# Database - from Step 1
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@oljckifwzejgvuejnfwr.supabase.co:5432/postgres

# Supabase URLs/Keys - from Step 1
SUPABASE_URL=https://oljckifwzejgvuejnfwr.supabase.co
SUPABASE_ANON_KEY=eyJ...your_key...
SUPABASE_SERVICE_KEY=eyJ...your_key...

# Generate secure random values (run these commands):
# JWT_SECRET=$(openssl rand -hex 32)
# CRON_SECRET=$(openssl rand -hex 32)
JWT_SECRET=aaaaaaa...
CRON_SECRET=bbbbbbb...

# Keep other values as defaults for development
```

### Frontend `.env.local` setup:

```bash
cd frontend
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=InfoPay
VITE_APP_URL=http://localhost:5173
EOF
```

---

## Step 3: Initialize Database

```bash
cd backend
npm install
npm run db:push        # Creates all tables in Supabase
npm run db:seed        # Optional: Load sample investment packages
```

---

## Step 4: Local Development

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
# Should print: "InfoPay API listening on http://localhost:3001"
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm install
npm run dev
# Should print: "Local: http://localhost:5173"
```

### Verify:
- Open http://localhost:5173 in browser
- Should see "Investment Packages" page with light blue theme
- Try creating an account and exploring features

---

## Step 5: Deploy to Render (Single Service)

### 1. Push to GitHub:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Create Render Service:

Go to: https://render.com/dashboard

**Create** → **Web Service**

- Connect your GitHub repo (wirelexcare/InfoPay)
- Name: `infopay-app`
- Environment: `Node`
- Build Command: `npm run build`
- Start Command: `npm start`
- Region: Choose closest to your users

### 3. Add Environment Variables:

Copy all values from `backend/.env`:

```
DATABASE_URL=postgresql://postgres:...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=...
CRON_SECRET=...
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-render-domain.onrender.com
API_URL=https://your-render-domain.onrender.com
```

### 4. Deploy:

Click **Deploy** in Render. This will:
1. Install dependencies
2. Build frontend (`npm run build` in root)
3. Start backend which serves frontend

---

## Step 6: Update Supabase Settings (After Deployment)

Once deployed and you have your Render URL (e.g., `https://infopay-app.onrender.com`):

1. Go to: https://app.supabase.com/project/oljckifwzejgvuejnfwr/settings/api

2. Update **Authorized redirect URLs**:
   ```
   https://infopay-app.onrender.com
   https://infopay-app.onrender.com/auth/callback
   ```

3. If using OAuth, whitelist your domain

---

## File Structure

```
InfoPay/
├── backend/
│   ├── src/
│   │   ├── db/          # Database schema & migrations
│   │   ├── routes/      # API endpoints
│   │   ├── lib/         # Business logic (ROI, payments, etc.)
│   │   └── index.ts     # Express server entry point
│   ├── .env             # Environment config (don't commit)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/       # React pages
│   │   ├── components/  # Reusable components
│   │   └── lib/         # Utilities
│   ├── .env.local       # Development config (don't commit)
│   └── package.json
│
├── package.json         # Root (orchestrates build)
├── render.yaml          # Render deployment config
└── SETUP_GUIDE.md       # Detailed setup
```

---

## Key Endpoints

### User Authentication:
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Investments:
- `GET /api/projects` - List investment packages
- `POST /api/investments` - Buy a package
- `GET /api/investments` - User's investments

### Wallet:
- `GET /api/wallet` - Check balance
- `POST /api/wallet/withdraw` - Withdraw earnings

### Referrals:
- `GET /api/referrals/me` - Your referral data
- `POST /api/referrals/claim` - Claim referral bonus

---

## Troubleshooting

### "Cannot connect to database"
- Verify DATABASE_URL is correct
- Check Supabase project is active
- Ensure your IP isn't blocked by Supabase

### "Frontend shows blank page"
- Check browser console (F12) for errors
- Verify VITE_API_URL points to correct backend
- Check backend is running

### "Deployment fails on Render"
- Check build logs in Render dashboard
- Verify all env vars are set
- Ensure `render.yaml` is in root directory

### "ROI calculations not running"
- Check backend is running continuously
- Monitor logs for errors
- Verify database connection is active

---

## Next Steps

1. ✅ Set up environment variables
2. ✅ Initialize database
3. ✅ Test locally
4. ✅ Deploy to Render
5. Configure payment providers (Paystack, Moolre, etc.)
6. Set up monitoring & alerts
7. Configure backups

---

## Support

- **Render Deployment**: https://render.com/docs/deploy-node-express-app
- **Supabase Setup**: https://supabase.com/docs/guides/getting-started
- **Environment Variables**: Check `.env.example` files

Enjoy building! 🚀
