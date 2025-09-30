# Deployment Guide - Reactive CASR

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure you have:

- [ ] Node.js 20+ installed
- [ ] Git repository initialized
- [ ] MetaMask wallet with REACT tokens
- [ ] Supabase project created
- [ ] Vercel account (for frontend)
- [ ] GitHub repository created
- [ ] All environment variables ready

## 🔑 Step 1: Environment Setup

### 1.1 Root Environment (.env)

Create `.env` in the project root:

```bash
# Hardhat / Contracts
REACTIVE_MAINNET_RPC=https://kopli-rpc.rkt.ink
LASNA_TESTNET_RPC=https://lasna-rpc.rkt.ink
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
ETHERSCAN_API_KEY=optional

# Report gas usage
REPORT_GAS=false
```

**⚠️ SECURITY:** Never commit `.env` to git! It's in `.gitignore`.

### 1.2 Frontend Environment (frontend/.env)

Create `frontend/.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_REACTIVE_CHAIN_ID=1597
VITE_LASNA_CHAIN_ID=3441006

# These will be filled after contract deployment
VITE_ORIGIN_POSITION_ADDRESS=
VITE_REACTIVE_MANAGER_ADDRESS=
VITE_DESTINATION_HANDLER_ADDRESS=
```

## 🗄️ Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Visit [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and region
4. Set database password (save it securely!)
5. Wait for project initialization

### 2.2 Run Database Migration

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Create new query
4. Copy entire contents of `supabase/migrations/init.sql`
5. Paste and run
6. Verify tables created in Table Editor

### 2.3 Configure Authentication

1. Go to Authentication → Settings
2. Enable Email provider
3. Configure email templates (optional)
4. Set site URL to your frontend URL
5. Add redirect URLs

### 2.4 Get API Keys

1. Go to Settings → API
2. Copy Project URL → Use for `VITE_SUPABASE_URL`
3. Copy anon/public key → Use for `VITE_SUPABASE_ANON_KEY`
4. Copy service_role key → Use for `SUPABASE_SERVICE_ROLE_KEY` (backend only)

## ⛓️ Step 3: Smart Contract Deployment

### 3.1 Install Dependencies

```bash
cd /workspace
npm install
```

### 3.2 Compile Contracts

```bash
npm run compile
```

Expected output: Compilation successful

### 3.3 Deploy to Lasna Testnet (Recommended First)

```bash
npm run deploy:lasna
```

**What happens:**
1. Deploys OriginPosition contract
2. Deploys DestinationHandler contract
3. Deploys ReactiveManager contract
4. Updates DestinationHandler with ReactiveManager address
5. Registers subscriptions
6. Saves all addresses and tx hashes to `deploy/output.json`

**Output:**
```
✅ OriginPosition deployed to: 0x...
✅ DestinationHandler deployed to: 0x...
✅ ReactiveManager deployed to: 0x...
✅ Subscriptions registered. Tx: 0x...
```

### 3.4 Deploy to Reactive Mainnet (Production)

⚠️ **Only after testing on Lasna!**

```bash
npm run deploy:reactive
```

### 3.5 Update Frontend Environment

After deployment, open `deploy/output.json` and copy addresses to `frontend/.env`:

```bash
VITE_ORIGIN_POSITION_ADDRESS=0xAddress_from_output_json
VITE_REACTIVE_MANAGER_ADDRESS=0xAddress_from_output_json
VITE_DESTINATION_HANDLER_ADDRESS=0xAddress_from_output_json
```

### 3.6 Update Supabase Contract Deployments

Run this SQL in Supabase SQL Editor:

```sql
UPDATE contract_deployments
SET contract_address = '0xYourOriginPositionAddress',
    deployment_tx_hash = '0xYourDeploymentTxHash',
    deployer_address = '0xYourDeployerAddress',
    chain_id = 3441006
WHERE contract_name = 'OriginPosition';

-- Repeat for ReactiveManager and DestinationHandler
```

## 🎨 Step 4: Frontend Deployment

### 4.1 Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4.2 Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000` and verify:
- [ ] App loads without errors
- [ ] Can connect MetaMask
- [ ] Can sign in with Supabase
- [ ] Contract addresses are correct
- [ ] Dashboard shows UI (even if empty)

### 4.3 Build for Production

```bash
npm run build
```

Verify no errors in build output.

### 4.4 Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel --prod
```

#### Option B: Vercel Dashboard

1. Visit [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Set root directory to `frontend`
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_REACTIVE_CHAIN_ID`
   - `VITE_ORIGIN_POSITION_ADDRESS`
   - `VITE_REACTIVE_MANAGER_ADDRESS`
   - `VITE_DESTINATION_HANDLER_ADDRESS`
6. Click Deploy

### 4.5 Configure Custom Domain (Optional)

1. Go to Vercel project settings
2. Click Domains
3. Add your custom domain
4. Update DNS records
5. Wait for SSL certificate

## 🔄 Step 5: Backend Deployment

The backend is deployed automatically with Vercel as serverless functions.

Verify deployment:
```
https://your-app.vercel.app/api/callback
```

Should return: `{"error":"Method not allowed"}`

## 🧪 Step 6: Testing Deployment

### 6.1 Test Smart Contracts

```bash
npm run test
```

All tests should pass.

### 6.2 Test End-to-End Workflow

1. Visit deployed frontend
2. Connect MetaMask to Reactive Mainnet/Lasna
3. Sign up for an account
4. Create a test position
5. Go to Admin panel
6. Run "Demo Workflow"
7. Check Activity page for execution logs

### 6.3 Verify Transactions

1. Open `deploy/output.json`
2. Copy transaction hashes
3. Search on Reactive Explorer:
   - Reactive Mainnet: https://kopli.reactscan.net/
   - Lasna Testnet: https://lasna.reactscan.net/
4. Verify contracts and transactions exist

## 🔒 Step 7: Security Checklist

Before mainnet deployment with real funds:

- [ ] All private keys stored securely (not in code)
- [ ] .env files in .gitignore
- [ ] GitHub secrets configured for CI/CD
- [ ] Supabase RLS policies tested
- [ ] Contract access controls verified
- [ ] Pausable functionality tested
- [ ] Emergency withdrawal tested
- [ ] Signature verification enabled in callback handler
- [ ] Rate limiting configured (if needed)
- [ ] Third-party audit completed (recommended)

## 🚀 Step 8: CI/CD Setup (Optional)

### 8.1 Configure GitHub Secrets

Go to GitHub repo → Settings → Secrets → Actions

Add secrets:
```
PRIVATE_KEY
REACTIVE_MAINNET_RPC
LASNA_TESTNET_RPC
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

### 8.2 Enable Workflows

GitHub Actions workflows are in `.github/workflows/`:
- `ci.yml` - Runs on every push (tests, build)
- `deploy.yml` - Manual deployment workflow

### 8.3 Test CI/CD

1. Push code to GitHub
2. Check Actions tab
3. Verify CI workflow passes
4. Manually trigger deploy workflow

## 📊 Step 9: Monitoring Setup

### 9.1 Supabase Monitoring

1. Enable Supabase logging
2. Set up database backups
3. Configure alerts for errors

### 9.2 Vercel Monitoring

1. Enable Vercel Analytics
2. Set up error tracking
3. Configure performance monitoring

### 9.3 Contract Monitoring

1. Subscribe to contract events on Reactive Explorer
2. Set up gas price alerts
3. Monitor transaction success rates

## 📝 Step 10: Documentation Updates

After deployment, update:

1. **README.md**
   - Add actual deployed URLs
   - Update contract addresses
   - Add explorer links

2. **deliverable-checklist.md**
   - Fill in actual transaction hashes
   - Add deployed contract addresses
   - Update with real metrics

3. **NOTES_FOR_JUDGES.md**
   - Add live demo URL
   - Update verification instructions
   - Include actual test results

## 🎥 Step 11: Create Demo Materials

### 11.1 Record Demo Video

Follow `docs/demo-script.md`:
1. Set up screen recording (OBS, Loom, etc.)
2. Test audio quality
3. Practice run-through
4. Record 5-minute demo
5. Edit and export
6. Upload to YouTube/Vimeo
7. Update links in documentation

### 11.2 Prepare Pitch Deck

Use `docs/pitch-deck.md`:
1. Create slides (Google Slides, PowerPoint)
2. Add screenshots from deployed app
3. Include actual metrics
4. Export as PDF
5. Add to repository

## ✅ Final Verification

Before submission:

- [ ] All contracts deployed and verified
- [ ] Frontend accessible and functional
- [ ] Backend endpoints responding
- [ ] Database populated with test data
- [ ] All tests passing
- [ ] CI/CD workflows green
- [ ] Documentation complete and accurate
- [ ] Demo video recorded and uploaded
- [ ] Pitch deck prepared
- [ ] Transaction hashes recorded
- [ ] Contract addresses documented
- [ ] Explorer links working
- [ ] README reflects actual deployment

## 🐛 Troubleshooting

### Contract Deployment Fails

**Issue:** Transaction reverts or insufficient funds

**Solutions:**
1. Check wallet has enough REACT tokens
2. Verify RPC URL is correct
3. Increase gas limit in hardhat.config.ts
4. Check network is not congested

### Frontend Build Errors

**Issue:** Vite build fails

**Solutions:**
1. Delete node_modules and reinstall
2. Clear Vite cache: `rm -rf .vite`
3. Check TypeScript errors
4. Verify all imports are correct

### Supabase Connection Fails

**Issue:** Frontend can't connect to Supabase

**Solutions:**
1. Verify VITE_SUPABASE_URL is correct
2. Check VITE_SUPABASE_ANON_KEY is valid
3. Ensure RLS policies allow access
4. Check Supabase project is running

### MetaMask Connection Issues

**Issue:** Can't connect wallet

**Solutions:**
1. Add Reactive Network to MetaMask manually
2. Clear MetaMask cache
3. Try different browser
4. Check frontend console for errors

### Tests Failing

**Issue:** npm run test fails

**Solutions:**
1. Compile contracts first: `npm run compile`
2. Check Hardhat version compatibility
3. Verify test files have correct imports
4. Run specific test: `npx hardhat test tests/YourTest.test.ts`

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Review README.md
3. Check GitHub issues
4. Consult Reactive Network docs: https://dev.reactive.network
5. Ask in Reactive Network Discord/Telegram

## 🎉 Deployment Complete!

Once all steps are verified, your Reactive CASR dApp is live!

**Share your deployment:**
- Tweet about it with #ReactiveNetwork
- Share in Reactive community channels
- Update your GitHub README
- Add to your portfolio

---

**Last Updated:** September 30, 2025  
**Version:** 1.0.0  
**Status:** Production-Ready

Good luck with your deployment! 🚀