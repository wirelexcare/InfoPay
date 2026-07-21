# InfoPay Investment Platform - Setup Guide

## Quick Start

### 1. Supabase Configuration

Your Supabase project is already set up:
- **Project ID**: `oljckifwzejgvuejnfwr`
- **Supabase Access Token**: Provided separately (keep secure, do not share)

#### Get Your Database Password:
1. Go to: https://app.supabase.com/project/oljckifwzejgvuejnfwr/settings/database
2. Look for "Database Password" section
3. Copy your database password

#### Update `.env` File:
Replace `YOUR_PASSWORD` in `backend/.env`:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@oljckifwzejgvuejnfwr.supabase.co:5432/postgres
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run db:push        # Creates tables in Supabase
npm run db:seed        # Seeds sample data (optional)
npm run dev            # Starts on http://localhost:3001
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev            # Starts on http://localhost:5173
```

### 4. Test the Application
- Open http://localhost:5173 in your browser
- You should see "Investment Packages" page
- Verify light blue color scheme is applied

---

## Next Steps: Complete Configuration

### Payment Gateway Setup

#### Paystack (Credit/Debit Cards)
1. Sign up at https://dashboard.paystack.com
2. Get your test keys from Settings > API Keys
3. Update `backend/.env`:
   ```
   PAYSTACK_SECRET_KEY=sk_test_your_key
   PAYSTACK_PUBLIC_KEY=pk_test_your_key
   ```

#### Mobile Money (Momo)
1. Set up Moolre account (for account verification)
2. Get API credentials from https://moolre.com
3. Update `backend/.env`:
   ```
   MOOLRE_API_USER=your_api_user
   MOOLRE_API_KEY=your_api_key
   MOOLRE_ACCOUNT_NUMBER=your_account_number
   ```

#### Crypto (USDT)
1. Sign up at https://nowpayments.io
2. Get API key from Settings
3. Update `backend/.env`:
   ```
   NOWPAYMENTS_API_KEY=your_api_key
   NOWPAYMENTS_IPN_SECRET=your_ipn_secret
   NOWPAYMENTS_IPN_CALLBACK_URL=https://your-domain.com/api/payments/crypto/ipn
   ```

---

## Database Schema

The following tables are created automatically:
- `users` - User accounts and KYC status
- `projects` - Investment packages
- `investments` - User investments
- `wallets` - User wallet balances
- `wallet_transactions` - Deposit/withdrawal history
- `payouts` - Daily ROI payouts
- `portfolios` - User investment summaries
- `referrals` - Referral relationships and rewards
- And 8+ more tables for payments, KYC, admin settings

---

## Security Checklist

Before deployment:
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change `CRON_SECRET` to a strong random value
- [ ] Remove `.env` from git (it's already in `.gitignore`)
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS for `FRONTEND_URL` and `API_URL`
- [ ] Rotate database password after initial setup
- [ ] Set up CORS properly for production domain

---

## Daily ROI Accrual

The system automatically runs ROI calculations daily. To manually trigger:
```bash
curl -X POST http://localhost:3001/api/admin/run-daily-roi \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Cron-Secret: YOUR_CRON_SECRET"
```

---

## Deployment (Render)

The `render.yaml` file is configured for one-click deployment:

1. Push to GitHub
2. Connect GitHub repo to Render
3. Set all environment variables (DATABASE_URL, JWT_SECRET, payment keys, etc.)
4. Deploy

See `render.yaml` for all required env vars.

---

## Support

For issues with:
- **Supabase**: https://supabase.com/docs
- **Paystack**: https://paystack.com/docs
- **NOWPayments**: https://nowpayments.io/help-center
- **Render**: https://render.com/docs
