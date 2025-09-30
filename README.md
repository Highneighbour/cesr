# Reactive CASR - Cross-Chain Automated Stop-Rebalance

A production-ready dApp demonstrating **Reactive Smart Contracts** on Reactive Network for automated cross-chain position management and rebalancing.

## 🌟 Overview

Reactive CASR is an innovative DeFi tool that monitors user positions across chains and automatically triggers rebalancing, hedging, or unwinding actions when thresholds are breached. Built on Reactive Network, it showcases the power of truly reactive smart contracts that respond to on-chain events without relying on traditional oracle infrastructure.

### Key Features

- ⚡ **Truly Reactive**: Smart contracts that automatically respond to on-chain events
- 🔗 **Cross-Chain**: Monitors origin chain and executes actions on destination chains
- 🔐 **Secure**: Supabase auth + wallet integration with Row-Level Security
- 📊 **Real-time Dashboard**: Live position monitoring and reactive execution tracking
- ⛽ **REACT Gas Tracking**: Transparent gas usage and execution history
- 🧪 **Production-Ready**: Full test suite, CI/CD, and deployment automation

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Origin Chain   │         │ Reactive Network │         │ Destination     │
│                 │         │                  │         │ Chain           │
│ OriginPosition  │────────>│ ReactiveManager  │────────>│ DestinationHandler │
│  - Create Pos   │ Events  │  - Subscribe     │Callback │  - Execute      │
│  - Update Value │         │  - React         │         │  - Rebalance    │
│  - Emit Events  │         │  - Emit Callback │         │  - Hedge        │
└─────────────────┘         └──────────────────┘         └─────────────────┘
         │                           │                            │
         └───────────────────────────┴────────────────────────────┘
                                     │
                              ┌──────▼──────┐
                              │  Supabase   │
                              │  - Auth     │
                              │  - Logs     │
                              │  - Analytics│
                              └─────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.x
- MetaMask wallet
- Supabase account
- REACT tokens (for gas on Reactive Network)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd reactive-casr
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 2. Environment Setup

#### Root `.env` (Hardhat)
```bash
cp .env.example .env
```

Edit `.env`:
```bash
REACTIVE_MAINNET_RPC=https://kopli-rpc.rkt.ink
LASNA_TESTNET_RPC=https://lasna-rpc.rkt.ink
PRIVATE_KEY=0x... # Your deployer wallet private key
ETHERSCAN_API_KEY=... # Optional
```

#### Frontend `.env`
```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_REACTIVE_CHAIN_ID=1597
VITE_LASNA_CHAIN_ID=3441006
VITE_ORIGIN_POSITION_ADDRESS=0x... # After deployment
VITE_REACTIVE_MANAGER_ADDRESS=0x... # After deployment
VITE_DESTINATION_HANDLER_ADDRESS=0x... # After deployment
```

### 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration:
   ```bash
   # In Supabase Dashboard -> SQL Editor
   # Copy and paste contents of supabase/migrations/init.sql
   ```
3. Enable Email Auth in Authentication settings
4. Copy your project URL and anon key to `.env`

### 4. Deploy Smart Contracts

#### Deploy to Lasna Testnet (Recommended for testing)

```bash
npm run deploy:lasna
```

#### Deploy to Reactive Mainnet

```bash
npm run deploy:reactive
```

**Output:** Contract addresses and tx hashes will be saved to `deploy/output.json`

### 5. Update Frontend Config

After deployment, update `frontend/.env` with the deployed contract addresses from `deploy/output.json`:

```bash
VITE_ORIGIN_POSITION_ADDRESS=0x...
VITE_REACTIVE_MANAGER_ADDRESS=0x...
VITE_DESTINATION_HANDLER_ADDRESS=0x...
```

### 6. Run Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000`

### 7. Fund Your Wallet

To interact with the dApp, you need REACT tokens:

- **Lasna Testnet**: Get testnet REACT from [faucet](https://dev.reactive.network/faucet)
- **Reactive Mainnet**: Bridge or purchase REACT tokens

## 📋 Usage Workflow

### Creating a Position

1. **Connect Wallet**: Click "Connect Wallet" and approve MetaMask
2. **Switch Network**: Ensure you're on Reactive Mainnet or Lasna Testnet
3. **Sign In**: Create account or sign in with email/password
4. **Create Position**:
   - Navigate to "Create Position"
   - Enter token address to monitor
   - Set position amount and threshold
   - Choose action type (rebalance/hedge/unwind)
   - Set gas budget
   - Submit transaction

### Triggering Reactive Workflow

1. **Update Position Value**: 
   - Go to Admin panel
   - Run "Demo Workflow" to simulate threshold breach
   - Or call `updatePositionValue()` manually

2. **Reactive Flow**:
   - OriginPosition emits `PositionUpdate` event
   - ReactiveManager detects event via subscription
   - `react()` function evaluates threshold
   - Emits `Callback` event for destination chain
   - DestinationHandler executes rebalancing action

3. **Monitor**:
   - Dashboard shows active positions
   - Activity page displays all reactive executions
   - View tx hashes and gas usage

## 🧪 Testing

### Run Contract Tests

```bash
npm run test
```

### Test Coverage

```bash
npx hardhat coverage
```

### Integration Tests

Integration tests simulate the full workflow:

```bash
npm run test -- tests/Integration.test.ts
```

## 📦 Project Structure

```
reactive-casr/
├── contracts/              # Solidity smart contracts
│   ├── IReactive.sol       # Reactive Network interfaces
│   ├── OriginPosition.sol  # Origin chain position management
│   ├── ReactiveManager.sol # Reactive contract (subscribes & reacts)
│   └── DestinationHandler.sol # Destination chain executor
├── scripts/
│   ├── deploy.ts           # Deployment script
│   └── registerSubscriptions.ts # Subscription setup
├── tests/                  # Hardhat tests
│   ├── OriginPosition.test.ts
│   ├── ReactiveManager.test.ts
│   └── Integration.test.ts
├── frontend/               # React + TypeScript dApp
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/            # Ethers & Supabase clients
│   │   └── App.tsx
│   └── package.json
├── backend/                # Serverless functions
│   └── api/
│       └── callback.ts     # Callback handler
├── supabase/
│   └── migrations/
│       └── init.sql        # Database schema
├── .github/workflows/      # CI/CD
│   ├── ci.yml
│   └── deploy.yml
├── hardhat.config.ts
├── package.json
└── README.md
```

## 🔑 Key Contracts

### OriginPosition.sol

Manages user positions on the origin chain. Users create positions with configurable thresholds and action types.

**Key Functions:**
- `createPosition()`: Create a new monitored position
- `updatePositionValue()`: Update current value (triggers events)
- `closePosition()`: Deactivate a position

**Events:**
- `PositionCreated`: Emitted when position is created
- `PositionUpdate`: Emitted when value changes (monitored by ReactiveManager)

### ReactiveManager.sol

The core reactive contract that subscribes to origin chain events and triggers callbacks.

**Key Functions:**
- `subscribe()`: Register event subscriptions
- `react()`: Called by Reactive Network when events match subscriptions
- `registerPositionSubscriptions()`: Helper to set up subscriptions

**Events:**
- `ReactiveActionTriggered`: Logs reactive execution
- `Callback`: Triggers destination chain transaction

### DestinationHandler.sol

Executes actions on the destination chain based on callbacks.

**Key Functions:**
- `executeRebalance()`: Perform rebalancing logic
- `executeHedge()`: Execute hedging trades
- `executeUnwind()`: Partial position unwinding

## 🌐 Network Configuration

### Reactive Mainnet

- Chain ID: `1597` (0x63d)
- RPC: `https://kopli-rpc.rkt.ink`
- Explorer: https://kopli.reactscan.net/

### Lasna Testnet

- Chain ID: `3441006` (0x34860e)
- RPC: `https://lasna-rpc.rkt.ink`
- Explorer: https://lasna.reactscan.net/

## 🔐 Security

- ✅ OpenZeppelin contracts for battle-tested security
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Pausable emergency controls
- ✅ Ownable access control
- ✅ Row-Level Security (RLS) in Supabase
- ✅ Signature verification for callbacks (in production)

## 📊 Monitoring & Analytics

The dApp tracks:
- Total positions created
- Active vs. inactive positions
- Total REACT gas consumed
- Success rate of reactive executions
- Average execution time
- Historical transaction logs

All metrics are stored in Supabase and displayed in real-time on the dashboard.

## 🚢 Deployment (CI/CD)

### GitHub Actions

The project includes automated workflows:

1. **CI Workflow** (`.github/workflows/ci.yml`):
   - Runs on every push/PR
   - Compiles contracts
   - Runs tests
   - Builds frontend

2. **Deploy Workflow** (`.github/workflows/deploy.yml`):
   - Manual trigger
   - Deploys contracts to selected network
   - Deploys frontend to Vercel
   - Updates Supabase with contract addresses

### Required Secrets

Configure these in GitHub Settings -> Secrets:

```
PRIVATE_KEY              # Deployer wallet private key
REACTIVE_MAINNET_RPC     # Reactive RPC URL
LASNA_TESTNET_RPC        # Lasna RPC URL
VITE_SUPABASE_URL        # Supabase project URL
VITE_SUPABASE_ANON_KEY   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY # Supabase service role key
VERCEL_TOKEN             # Vercel deployment token
VERCEL_ORG_ID            # Vercel organization ID
VERCEL_PROJECT_ID        # Vercel project ID
```

## 🎥 Demo Video Script

See `docs/demo-script.md` for the 5-minute demo walkthrough.

## 📄 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- Reactive Network team for the innovative reactive smart contract platform
- OpenZeppelin for secure contract libraries
- Supabase for backend infrastructure
- Vercel for hosting

## 📞 Support

For issues or questions:
- GitHub Issues: [Create an issue]
- Documentation: `docs/`
- Demo Video: [Link to video]

---

Built with ❤️ for Reactive Network Hackathon