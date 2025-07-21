# FriendSwap - P2P Cross-Chain Token Swaps

## Project Overview

**Name**: FriendSwap  
**Title**: Decentralized P2P Cross-Chain Token Exchange on Farcaster  
**Category**: DeFi Infrastructure / Cross-Chain Protocol

## Description

FriendSwap is a peer-to-peer cross-chain token swap protocol that enables users to exchange tokens directly across different blockchain networks without relying on centralized exchanges or bridges. Built as a Farcaster Mini App, it combines the social aspect of Farcaster with trustless cross-chain DeFi functionality, allowing users to discover and fulfill swap requests within their social network.

The protocol implements atomic cross-chain swaps using hashlock and timelock mechanisms, ensuring that either both parties receive their tokens or the swap fails completely - eliminating counterparty risk.

## What We're Solving

### 1. **Peer-to-Peer Token Exchange Risk**
- People hold different tokens but have no safe way to exchange them directly
- Example: Alice has USDC and needs ETH, Bob has ETH and needs USDC
- Current solutions involve centralized exchanges with custody risks and fees
- No trustless platform for direct one-to-one token swaps between individuals

### 2. **Cross-Chain Liquidity Fragmentation**
- Traditional DEXs are limited to single chains
- Users must use complex bridge protocols with high fees and risks
- Limited liquidity across different blockchain ecosystems

### 3. **Centralized Exchange Dependencies**
- Users rely on CEXs for cross-chain trades
- Custody risks and regulatory concerns
- High fees and withdrawal limits

### 4. **Social Discovery Gap**
- No easy way to find trusted counterparties for OTC trades
- Lack of social context in DeFi transactions
- Difficulty in discovering fair swap opportunities

### 5. **Complex User Experience**
- Multi-step bridge processes
- High technical barriers for cross-chain operations
- Poor mobile/social media integration

## How It Works

### Core Protocol Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Source Chain   │    │ Destination Chain│
│   (e.g. Ethereum)│    │  (e.g. Base)     │
│                 │    │                 │
│  ┌─────────────┐│    │┌─────────────┐  │
│  │ EscrowSrc   ││    ││ EscrowDst   │  │
│  │ - Asker's   ││    ││ - Fulfiller's│  │
│  │   Tokens    ││    ││   Tokens    │  │
│  │ - Hashlock  ││    ││ - Same      │  │
│  │ - Timelock  ││    ││   Hashlock  │  │
│  └─────────────┘│    │└─────────────┘  │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┘
              Atomic Swap via
              Secret Revelation
```

### Step-by-Step Process

1. **Request Creation**: Asker creates a swap request specifying:
   - Source token and amount (what they're offering)
   - Destination token and amount (what they want)
   - Source and destination chains
   - Expiration time

2. **Source Escrow Deployment**: Asker deploys and funds the source escrow contract with their tokens

3. **Discovery**: Other users browse available swaps on the Farcaster Mini App

4. **Fulfillment**: Fulfiller deploys destination escrow with their tokens matching the request

5. **Secret Revelation**: The relayer reveals the secret, enabling both parties to claim their tokens atomically

6. **Completion**: Both escrows release tokens to the respective recipients

### Security Mechanisms

- **Hashlock**: Cryptographic commitment ensuring only the secret holder can unlock funds
- **Timelock**: Time-based expiration allowing refunds if swaps aren't completed
- **Deterministic Addresses**: Predictable contract addresses for verification
- **Access Control**: Only authorized parties can deploy and interact with escrows

## Technical Details

### Smart Contract Architecture

#### Core Contracts
- **EscrowFactory**: Deploys and manages escrow instances using minimal proxy pattern (ERC-1167)
- **EscrowSrc**: Source chain escrow holding asker's tokens
- **EscrowDst**: Destination chain escrow holding fulfiller's tokens
- **BaseEscrow**: Abstract contract with common escrow functionality

#### Key Features
- **Gas Fee Rebates**: Callers who execute withdrawals/cancellations receive gas rebates
- **Platform Fees**: Configurable fees (default 1%) collected in native tokens
- **Public Access Control**: Optional ERC-20 access token for public operations
- **Emergency Recovery**: Time-delayed rescue mechanism for stuck funds

### Backend Infrastructure

#### Node.js Relayer
- **Event Monitoring**: Listens to escrow deployment events on both chains
- **Secret Management**: Generates and reveals secrets for atomic swaps
- **Cross-Chain Coordination**: Ensures proper sequencing of operations
- **API Layer**: REST endpoints for frontend integration

#### Technology Stack
- **Smart Contracts**: Solidity 0.8.26 with Foundry framework
- **Backend**: Node.js with TypeScript, Express, and Viem
- **Frontend**: Next.js 14 with Farcaster Mini App SDK
- **Blockchain Interaction**: Wagmi hooks with multiple wallet support

### Farcaster Integration

#### Mini App Features
- **Social Authentication**: Neynar API integration for user verification
- **Mobile-First Design**: Optimized for Farcaster's mobile environment
- **Real-Time Updates**: Live swap status and notifications
- **Wallet Integration**: Auto-detection and connection of Farcaster-compatible wallets
- **Native Notifications**: Leverage Farcaster's notification system for swap alerts
- **Social Discovery**: Find swap opportunities within your social network
- **Trust Indicators**: Social context provides additional security through reputation

## Technical Challenges Overcome

### 1. **Cross-Chain State Synchronization**
**Challenge**: Ensuring atomic operations across different blockchains with different finality times.

**Solution**: Implemented hashlock-timelock pattern with deterministic contract addresses and event-driven relayer coordination.

### 2. **Native ETH vs ERC-20 Handling**
**Challenge**: Different transfer mechanisms for native tokens vs ERC-20 tokens across chains.

**Solution**: Dynamic token handling logic that detects token type (address(0) for ETH) and applies appropriate transfer method.

### 3. **Minimal Proxy Gas Optimization**
**Challenge**: Deploying individual escrow contracts for each swap is expensive.

**Solution**: ERC-1167 minimal proxy pattern reduces deployment costs by ~90% while maintaining isolated state.

### 4. **Factory Initialization with Clones**
**Challenge**: Constructor parameters don't work with cloned contracts.

**Solution**: Implemented initialize() pattern with factory address setting during first call to maintain access control.

### 5. **Farcaster Sandbox Limitations**
**Challenge**: Farcaster Mini Apps run in sandboxed environment blocking standard alert() modals.

**Solution**: Custom notification system with dismissible UI cards for user feedback.

### 6. **BigInt JSON Serialization**
**Challenge**: JavaScript BigInt values can't be directly serialized in JSON API calls.

**Solution**: String conversion on frontend with BigInt parsing on backend for contract interactions.

### 7. **Multi-Chain Wallet Management**
**Challenge**: Users need to switch networks and manage different chain contexts.

**Solution**: Auto-detection of required networks with seamless switching and clear UI guidance.

## Why This Product Matters

### 1. **Democratizing Cross-Chain DeFi**
- Removes technical barriers for average users
- Social context makes DeFi more accessible and trustworthy
- Mobile-first approach reaches broader audience

### 2. **True Decentralization**
- No central authority or custody
- Peer-to-peer discovery and execution
- Trustless atomic swaps

### 3. **Cost Efficiency**
- Direct swaps without intermediate bridges
- Minimal gas costs through optimized contracts
- No trading fees beyond platform maintenance

### 4. **Social Layer Innovation**
- First P2P cross-chain protocol integrated with social media
- Leverages social graphs for counterparty discovery
- Community-driven liquidity provision

### 5. **Native Notification System**
- Farcaster provides built-in notification infrastructure
- Users get real-time alerts when new swap opportunities match their interests
- Push notifications for swap fulfillment requests directly in their social feed
- Perfect platform for discovering time-sensitive trading opportunities within your network

## Supported Networks

**Testnets** (Current):
- Ethereum Sepolia
- Base Sepolia

**Mainnet Roadmap**:
- Ethereum
- Base
- Arbitrum
- Optimism
- Polygon

## Contract Addresses

### Sepolia
- **Factory**: `0x543046076dE28686b3A6BEb34a29C747F26fBA23`
- **EscrowSrc**: `0x976708a30358649CbFaDcFb4583518556bb4699E`
- **EscrowDst**: `0x8DCB7fC8e4BB2bb5c5cB70b5F1a22035d6D79FFe`

### Base Sepolia
- **Factory**: `0xEC9f35Dc7B6bC272Dc874Ae016554FcEBce5f68b`
- **EscrowSrc**: `0xE80a47Ff3C587087Ac2809b82C5ca1d29196cc24`
- **EscrowDst**: `0x4951715141dED8b45a01529e98dC26d24B3da5a0`

## Repository Structure

```
├── cleer/                  # Smart contracts
│   ├── src/               # Solidity contracts
│   ├── test/              # Contract tests
│   └── script/            # Deployment scripts
├── backend/               # Node.js relayer service
│   └── src/               # TypeScript backend code
├── miniapp/friendswap/    # Farcaster Mini App
│   └── src/               # Next.js frontend
└── SUBMISSION.md          # This file
```

## Getting Started

### Prerequisites
- Node.js 18+
- Foundry
- Git

### Installation
```bash
# Clone repository
git clone <repository-url>
cd friendswap

# Install smart contract dependencies
cd cleer && forge install

# Install backend dependencies  
cd ../backend && npm install

# Install frontend dependencies
cd ../miniapp/friendswap && npm install
```

### Testing
```bash
# Run smart contract tests
cd cleer && forge test

# Start backend service
cd backend && npm run dev

# Start frontend development
cd miniapp/friendswap && npm run dev
```

## Future Roadmap

### Phase 1: Enhanced UX
- Advanced filtering and search
- Price discovery mechanisms
- Reputation system

### Phase 2: Protocol Expansion
- Support for additional chains
- NFT swaps
- Batch operations

### Phase 3: Ecosystem Growth
- Developer APIs
- Third-party integrations
- Governance token

---

**Built with ❤️ for the decentralized future of cross-chain finance.**
