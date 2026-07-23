# InfoPay Investment Platform - Developer Handover

**Date**: July 21, 2026  
**Repository**: https://github.com/wirelexcare/InfoPay  
**Status**: ✅ Ready for Development

---

## Project Overview

**InfoPay** is a unified investment platform where users can:
- Create accounts and complete KYC
- Browse investment packages (Bronze, Silver, Gold tiers)
- Purchase investment packages with fixed daily ROI
- Track investments and earnings in real-time
- Earn passive income through referrals (3-level: 25%, 6%, 2%)
- Withdraw earnings via Mobile Money, Bank Transfer, or Crypto

**Deployment Model**: Single unified service (Backend + Frontend bundled together)

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **UI Components**: Radix UI + Custom

### Hosting
- **Service**: Render.com
- **Deployment**: Single Web Service (Backend serves Frontend)

---

## Key Features Implemented

✅ **User Management**
- Sign up / Login / Password reset
- KYC verification (lightweight)
- Profile management
- Role-based access (investor/admin)

✅ **Investment Packages**
- Browse available packages with daily ROI
- Purchase packages with wallet balance
- Real-time investment tracking
- Daily ROI accrual (automatic)
- Investment maturity detection

✅ **Wallet System**
- Deposit funds (Mobile Money, Bank Transfer, Crypto)
- Withdraw earnings
- Transaction history
- Separate capital/profit tracking

✅ **Referral System**
- Generate unique referral links
- 3-level commission structure (25%, 6%, 2%)
- Automatic reward crediting
- Referral dashboard with analytics

✅ **Admin Dashboard**
- User management
- Investment package CRUD
- Manual ROI adjustment
- Withdrawal approvals
- Financial reports

✅ **Design**
- Light blue color scheme (modern, professional)
- Mobile-first responsive design
- Animated transitions
- Accessibility compliance

---

## Project Structure

```
InfoPay/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts          # Drizzle ORM schema (8+ tables)
│   │   │   ├── index.ts           # Database client
│   │   │   └── seed.ts            # Sample data
│   │   ├── routes/
│   │   │   ├── auth.ts            # Login/Signup
│   │   │   ├── projects.ts        # Investment packages
│   │   │   ├── investments.ts     # Buy/track investments
│   │   │   ├── wallet.ts          # Deposits/withdrawals
│   │   │   ├── payments.ts        # Payment gateway integrations
│   │   │   ├── referrals.ts       # Referral logic
│   │   │   ├── admin.ts           # Admin operations
│   │   │   ├── kyc.ts             # KYC verification
│   │   │   └── users.ts           # User management
│   │   ├── lib/
│   │   │   ├── auth.ts            # JWT/bcrypt helpers
│   │   │   ├── roiAccrual.ts      # Daily ROI calculations (idempotent)
│   │   │   ├── referrals.ts       # Referral reward logic
│   │   │   ├── nowpayments.ts     # Crypto payment integration
│   │   │   ├── manualDeposits.ts  # Manual deposit verification
│   │   │   ├── phone.ts           # Phone number validation
│   │   │   └── storage.ts         # File upload handling
│   │   ├── middleware/
│   │   │   └── auth.ts            # Auth middleware
│   │   └── index.ts               # Express app entry point
│   ├── .env                       # Environment variables (DO NOT COMMIT)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SignupPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── PackagesPage.tsx           # Investment packages list
│   │   │   ├── PackageDetailPage.tsx      # Buy package
│   │   │   ├── PortfolioPage.tsx          # User's investments
│   │   │   ├── InvestmentDetailPage.tsx   # ROI tracking
│   │   │   ├── WalletPage.tsx             # Balance & transactions
│   │   │   ├── ReferralDashboardPage.tsx  # Referral stats
│   │   │   ├── AdminPage.tsx              # Admin hub
│   │   │   ├── AdminUsersPage.tsx
│   │   │   ├── AdminPackagesPage.tsx      # Manage packages
│   │   │   ├── AdminPackageEditPage.tsx   # Edit package
│   │   │   ├── AdminPaymentsPage.tsx      # Payment tracking
│   │   │   ├── AdminWithdrawalsPage.tsx   # Withdrawal approvals
│   │   │   ├── AdminRoiPage.tsx           # ROI management
│   │   │   └── AdminReferralConfigPage.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx          # Header + Navigation
│   │   │   ├── PackageForm.tsx     # Investment package form
│   │   │   ├── ImageUpload.tsx     # File upload handler
│   │   │   └── ui/                 # Radix UI components
│   │   ├── lib/
│   │   │   ├── api.ts              # Axios instance
│   │   │   ├── store.ts            # Zustand auth store
│   │   │   ├── currency.ts         # GHS conversion helpers
│   │   │   └── utils.ts            # Utilities
│   │   └── index.css               # Tailwind + CSS variables
│   ├── .env.local                  # Development config (DO NOT COMMIT)
│   └── package.json
│
├── render.yaml                     # Render deployment config
├── QUICKSTART.md                   # Quick start guide
├── DEPLOYMENT_GUIDE.md             # Detailed deployment instructions
├── SETUP_GUIDE.md                  # Environment setup guide
└── package.json                    # Root build orchestration
```

---

## Getting Started for Developers

### 1. Clone & Install
```bash
git clone https://github.com/wirelexcare/InfoPay.git
cd InfoPay
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```bash
DATABASE_URL=postgresql://postgres:[password]@oljckifwzejgvuejnfwr.supabase.co:5432/postgres
SUPABASE_URL=https://oljckifwzejgvuejnfwr.supabase.co
SUPABASE_ANON_KEY=[from Supabase dashboard]
SUPABASE_SERVICE_KEY=[from Supabase dashboard]
JWT_SECRET=[generate: openssl rand -hex 32]
CRON_SECRET=[generate: openssl rand -hex 32]
```

**Frontend** (`frontend/.env.local`):
```bash
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=InfoPay
VITE_APP_URL=http://localhost:5173
```

### 3. Initialize Database
```bash
cd backend
npm run db:push        # Create tables in Supabase
npm run db:seed        # Load sample data
```

### 4. Run Locally
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev

# Open http://localhost:5173
```

---

## Database Schema

Key tables:
- **users** - User accounts, KYC status
- **projects** - Investment packages
- **investments** - User investments
- **wallets** - User wallet balances
- **wallet_transactions** - Deposit/withdrawal history
- **payouts** - Daily ROI payouts
- **portfolios** - User portfolio summaries
- **referral_codes** - Referral links
- **referral_relationships** - Referrer/referee relationships
- **referral_rewards** - Referral earnings
- And more...

**ORM**: Drizzle (type-safe, migrations via `db:push`)

---

## API Endpoints

### Authentication
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Investments
- `GET /api/projects` - List packages
- `GET /api/projects/:id` - Package detail
- `POST /api/investments` - Buy package
- `GET /api/investments` - User's investments
- `GET /api/investments/:id` - Investment detail

### Wallet
- `GET /api/wallet` - Get balance
- `POST /api/wallet/deposit` - Start deposit
- `POST /api/wallet/withdraw` - Request withdrawal

### Referrals
- `GET /api/referrals/me` - Referral dashboard
- `POST /api/referrals/claim` - Claim rewards

### Admin
- `GET /api/admin/projects` - List all packages
- `POST /api/admin/projects` - Create package
- `PATCH /api/admin/projects/:id` - Edit package
- `GET /api/admin/users` - List users
- `GET /api/admin/payments` - Payment tracking
- And more...

---

## Important Implementation Details

### ROI Accrual
- **File**: `backend/src/lib/roiAccrual.ts`
- **Trigger**: Runs hourly via `setInterval` in `index.ts`
- **Calculation**: `(investmentAmount × expectedReturnPct / 100) / (durationMonths × 30)`
- **Idempotent**: Won't double-credit if run multiple times in same day

### Referral System
- **File**: `backend/src/lib/referrals.ts`
- **Trigger**: Automatic when referee makes first investment
- **Levels**: 3 levels (25%, 6%, 2%)
- **Flow**: Referral relationships established → Rewards calculated → Credited to wallet

### Payment Integration
- **Paystack**: Credit/debit card payments
- **Binance Pay**: USDT crypto
- **Manual**: Bank transfers & Mobile Money with admin verification
- **Webhook**: Handles payment confirmations

---

## Configuration Checklist

Before deployment:
- [ ] Get Supabase credentials (database, anon key, service key)
- [ ] Generate JWT_SECRET (`openssl rand -hex 32`)
- [ ] Generate CRON_SECRET (`openssl rand -hex 32`)
- [ ] Configure payment gateways (if needed)
- [ ] Set production domain in FRONTEND_URL
- [ ] Enable CORS for production domain
- [ ] Set up Supabase backups
- [ ] Configure email service (for notifications)
- [ ] Set up monitoring/error tracking

---

## Deployment to Render

See `QUICKSTART.md` for step-by-step deployment instructions.

**Summary**:
1. Push to GitHub
2. Connect repo to Render
3. Set environment variables
4. Deploy (automatic build & start)

---

## Next Steps

1. ✅ Review this handover document
2. ✅ Set up local environment
3. ✅ Run locally and test features
4. ✅ Deploy to staging/production
5. ✅ Configure payment gateways
6. ✅ Set up monitoring & alerting
7. ✅ Create support/help documentation

---

## Support & Documentation

- **Supabase**: https://supabase.com/docs
- **Express.js**: https://expressjs.com
- **React**: https://react.dev
- **Render**: https://render.com/docs
- **Drizzle ORM**: https://orm.drizzle.team

---

## Notes for Developers

- **Don't commit `.env` files** - They're in `.gitignore`
- **ROI runs automatically** - Don't manually trigger unless needed
- **Backend serves frontend** - No separate CDN needed
- **Database is PostgreSQL** - All standard SQL operations supported
- **TypeScript everywhere** - Full type safety, no `any` types
- **Tests**: Test suite should be added before production (currently minimal)

---

**Ready to go! 🚀**

Questions? Check QUICKSTART.md, DEPLOYMENT_GUIDE.md, or SETUP_GUIDE.md for detailed instructions.
