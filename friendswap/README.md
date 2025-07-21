# friendSwap - Cross-Chain P2P Token Swap System

friendSwap is a decentralized cross-chain token swap system built on the principles of 1inch Fusion, using hashlock and timelock mechanisms for secure peer-to-peer token exchanges.

## Overview

friendSwap enables users to swap tokens across different blockchain networks in a trustless manner. The system uses:
- **Hashlock**: A cryptographic commitment scheme where tokens are locked until a secret is revealed
- **Timelocks**: Time-based restrictions for different operations (withdrawal, cancellation, etc.)
- **Platform Fees**: Configurable fees collected in the traded tokens
- **Gas Fee Rebates**: Native token fees returned to the caller who executes withdrawals

## Architecture

### Core Contracts

1. **EscrowFactory** - Main factory contract that deploys escrow instances
2. **EscrowSrc** - Source chain escrow contract that locks asker's tokens
3. **EscrowDst** - Destination chain escrow contract that locks fullfiller's tokens
4. **BaseEscrow** - Abstract base contract with common escrow functionality

### Key Components

- **ExecutionData**: Struct containing all swap parameters and metadata
- **Timelocks**: Compact storage of time-based restrictions
- **Fee System**: Platform fees (1% default, configurable) + gas fee rebates

## How It Works

### 1. Swap Initiation
- Asker locks tokens on source chain by calling factory
- Factory deploys EscrowSrc clone with execution data
- Asker pays: token amount + platform fee + gas fee

### 2. Swap Fulfillment
- Fullfiller deploys EscrowDst on destination chain
- Fullfiller locks tokens and pays gas fee
- Gas fee will be returned to whoever executes the withdrawal

### 3. Token Exchange
- Once secret is revealed, tokens can be withdrawn
- Asker gets fullfiller's tokens on destination chain
- Fullfiller gets asker's tokens (minus platform fee) on source chain
- Platform fees are sent to fee collector
- Gas fees are returned to withdrawal caller

### 4. Safety Mechanisms
- **Public Withdrawal**: Anyone with access token can withdraw after timelock
- **Public Cancellation**: Anyone with access token can cancel after timelock
- **Rescue Funds**: Emergency fund recovery after rescue delay

## Fee Structure

- **Platform Fee**: 1% of asker amount (configurable, max 10%)
- **Gas Fee**: Native token fee paid by fullfiller, returned to withdrawal caller
- **Fee Collector**: Configurable address to receive platform fees

## Timelock Stages

### Source Chain
- `SrcWithdrawal`: Only asker can withdraw with secret
- `SrcPublicWithdrawal`: Anyone with access token can withdraw
- `SrcCancellation`: Only asker can cancel
- `SrcPublicCancellation`: Anyone with access token can cancel

### Destination Chain
- `DstWithdrawal`: Only asker can withdraw with secret
- `DstPublicWithdrawal`: Anyone with access token can withdraw
- `DstCancellation`: Only fullfiller can cancel

## Security Features

- **Hashlock Verification**: Secret must match hashlock to unlock tokens
- **Execution Data Validation**: All operations verify execution data integrity
- **Access Token Control**: Public functions require access token ownership
- **Timelock Enforcement**: Operations only available after specific time periods
- **Emergency Recovery**: Rescue mechanism for stuck funds

## Usage

### For Asker (Token Sender)
1. Approve tokens for factory
2. Call factory to create source escrow
3. Wait for fullfiller to deploy destination escrow
4. Reveal secret to withdraw tokens on destination chain

### For Fullfiller (Token Provider)
1. Deploy destination escrow with execution data
2. Pay gas fee (will be returned to withdrawal caller)
3. Wait for asker to withdraw or cancel after timelock

### For Public Users
1. Hold access token
2. Execute public withdrawal/cancellation after timelock
3. Receive gas fee rebate

## Development

### Prerequisites
- Foundry (latest version)
- Solidity 0.8.20+

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Deploy
```bash
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --private-key <PRIVATE_KEY> --broadcast
```

