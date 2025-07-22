import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbiItem, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS, CHAIN_RPC } from "./chains";
import { EscrowDstAbi, EscrowSrcAbi } from "./abi";
import { getSwapByHashlock, upsertSwap } from "./store";
import { EscrowFactoryAbi } from "./factoryAbi";

type Addresses = {
  sepolia: { EscrowSrc: `0x${string}`; EscrowDst: `0x${string}`; Factory: `0x${string}` };
  baseSepolia: { EscrowSrc: `0x${string}`; EscrowDst: `0x${string}`; Factory: `0x${string}` };
};

function normalizePk(pk?: string): `0x${string}` | null {
  if (!pk) return null;
  const trimmed = pk.trim();
  const hex = trimmed.startsWith("0x") ? trimmed : ("0x" + trimmed) as `0x${string}`;
  if (hex.length !== 66) return null;
  return hex as `0x${string}`;
}

export function startRelayer(addresses: Addresses) {
  console.log("🚀 [relayer] Starting relayer service...");
  console.log("📋 [relayer] Contract addresses:", addresses);
  
  const pk = normalizePk(process.env.RELAYER_PRIVATE_KEY);
  if (!pk) {
    console.warn("⚠️  [relayer] RELAYER_PRIVATE_KEY missing or invalid. Skipping relayer startup.");
    return;
  }
  const account = privateKeyToAccount(pk);
  console.log("🔑 [relayer] Using account:", account.address);

  console.log("🔗 [relayer] RPC URLs being used:");
  console.log("📡 [relayer] Sepolia RPC:", CHAIN_RPC.sepolia);
  console.log("📡 [relayer] Base Sepolia RPC:", CHAIN_RPC.baseSepolia);

  const dstClients = {
    sepolia: createPublicClient({ chain: CHAINS.sepolia, transport: http(CHAIN_RPC.sepolia) }),
    baseSepolia: createPublicClient({ chain: CHAINS.baseSepolia, transport: http(CHAIN_RPC.baseSepolia) }),
  };
  const srcWallets = {
    sepolia: createWalletClient({ account, chain: CHAINS.sepolia, transport: http(CHAIN_RPC.sepolia) }),
    baseSepolia: createWalletClient({ account, chain: CHAINS.baseSepolia, transport: http(CHAIN_RPC.baseSepolia) }),
  };

  console.log("🌐 [relayer] Initialized clients for chains:", Object.keys(dstClients));

  // Listen to factory events for escrow deployments and secret revelations
  async function subscribe(chain: keyof typeof dstClients) {
    const client = dstClients[chain];
    const srcWallet = srcWallets[chain];
    const factory = addresses[chain].Factory;

    console.log(`👂 [${chain}] Setting up factory event listeners for:`, factory);

    // Test RPC connectivity before starting listener
    try {
      const blockNumber = await client.getBlockNumber();
      console.log(`✅ [${chain}] RPC connectivity test passed - latest block:`, blockNumber);
    } catch (rpcError) {
      console.error(`❌ [${chain}] RPC connectivity test failed:`, rpcError);
      console.log(`🔄 [${chain}] Retrying in 10 seconds...`);
      setTimeout(() => subscribe(chain), 10000);
      return;
    }

    let lastProcessedBlock = await client.getBlockNumber();
    console.log(`🎯 [${chain}] Starting factory event polling from block:`, lastProcessedBlock);

    async function pollForFactoryEvents() {
      try {
        const currentBlock = await client.getBlockNumber();
        
        if (currentBlock > lastProcessedBlock) {
          console.log(`🔍 [${chain}] Checking blocks ${lastProcessedBlock + 1n} to ${currentBlock} for factory events...`);
          
          // Get all factory logs and decode them
          const allFactoryLogs = await client.getLogs({
            address: factory,
            fromBlock: lastProcessedBlock + 1n,
            toBlock: currentBlock,
          });

          if (allFactoryLogs.length > 0) {
            console.log(`📋 [${chain}] Found ${allFactoryLogs.length} raw factory log(s) to process`);
          }

          const srcLogs = [];
          const dstLogs = [];
          
          // Decode each log to determine its type
          for (const log of allFactoryLogs) {
            try {
              // Try to decode as SrcEscrowCreated
              const decoded = decodeEventLog({
                abi: EscrowFactoryAbi,
                data: log.data,
                topics: log.topics,
              });
              
              if (decoded.eventName === 'SrcEscrowCreated') {
                srcLogs.push({ ...log, args: decoded.args });
              } else if (decoded.eventName === 'DstEscrowCreated') {
                dstLogs.push({ ...log, args: decoded.args });
              }
            } catch (e) {
              // Log couldn't be decoded with factory ABI, skip
              console.warn(`⚠️ [${chain}] Could not decode factory log:`, e.message);
            }
          }

          // Process SrcEscrowCreated events
          for (const log of srcLogs) {
            const executionData = (log.args as any).srcExecutionData;
            const hashlock = executionData.hashlock;
            
            console.log(`📥 [${chain}] SrcEscrowCreated for hashlock:`, hashlock?.slice(0, 10) + '...');
            
            // Update swap record to mark source as deployed
            const swap = getSwapByHashlock(hashlock);
            if (swap) {
              swap.srcDeployed = true;
              console.log(`✅ [${chain}] Marked source escrow as deployed for hashlock:`, hashlock?.slice(0, 10) + '...');
            }
          }

          // Process DstEscrowCreated events
          for (const log of dstLogs) {
            const { escrow, hashlock, asker } = (log.args as any);
            
            console.log(`📥 [${chain}] DstEscrowCreated for hashlock:`, hashlock?.slice(0, 10) + '...');
            console.log(`🏠 [${chain}] Destination escrow address:`, escrow);
            
            // Update swap record to mark destination as deployed
            const swap = getSwapByHashlock(hashlock);
            if (swap) {
              swap.dstDeployed = true;
              swap.dstEscrow = escrow; // Update with actual deployed address
              console.log(`✅ [${chain}] Marked destination escrow as deployed for hashlock:`, hashlock?.slice(0, 10) + '...');
            }
          }

          // Also listen for DstSecretRevealed events from any deployed destination escrows
          // We need to check all destination escrows we know about
          const allSwaps = Object.values(global.swapStore || {});
          for (const swap of allSwaps) {
            if (swap.dstDeployed && swap.dstEscrow) {
              try {
                const secretLogsRaw = await client.getLogs({
                  address: swap.dstEscrow as `0x${string}`,
                  fromBlock: lastProcessedBlock + 1n,
                  toBlock: currentBlock,
                });

                const secretLogs = [];
                for (const rawLog of secretLogsRaw) {
                  try {
                    const decoded = decodeEventLog({
                      abi: EscrowDstAbi,
                      data: rawLog.data,
                      topics: rawLog.topics,
                    });
                    
                    if (decoded.eventName === 'DstSecretRevealed') {
                      secretLogs.push({ ...rawLog, args: decoded.args });
                    }
                  } catch (e) {
                    // Not a DstSecretRevealed event, skip
                  }
                }

                for (const secretLog of secretLogs) {
                  const { secret, hashlock } = (secretLog.args as any);
                  
                  console.log(`🔐 [${chain}] Secret revealed for hashlock:`, hashlock?.slice(0, 10) + '...');
                  
                  const rec = getSwapByHashlock(hashlock);
                  if (rec) {
                    console.log(`🎯 [${chain}] Processing secret revelation - withdrawing from source escrow:`, rec.srcEscrow);
                    
                    try {
                      const txHash = await srcWallet.writeContract({
                        address: rec.srcEscrow,
                        abi: EscrowSrcAbi as any,
                        functionName: "withdraw",
                        args: [secret, rec.executionData],
                      });
                      
                      console.log(`🎉 [${chain}] Source withdraw transaction submitted successfully!`);
                      console.log(`📋 [${chain}] Transaction hash:`, txHash);
                      
                    } catch (e) {
                      console.error(`❌ [${chain}] Source withdraw transaction failed:`, e);
                    }
                  }
                }
              } catch (error) {
                // Ignore errors for individual escrow checks
                console.warn(`⚠️ [${chain}] Error checking escrow ${swap.dstEscrow} for secret events:`, error.message);
              }
            }
          }

          if (srcLogs.length > 0 || dstLogs.length > 0) {
            console.log(`📊 [${chain}] Processed ${srcLogs.length} SrcEscrowCreated and ${dstLogs.length} DstEscrowCreated events`);
          } else {
            console.log(`⏰ [${chain}] No new factory events in blocks ${lastProcessedBlock + 1n}-${currentBlock}`);
          }

          lastProcessedBlock = currentBlock;
        }
      } catch (error) {
        console.error(`💥 [${chain}] Error polling for factory events:`, error);
      }

      // Poll every 10 seconds
      setTimeout(pollForFactoryEvents, 10000);
    }

    // Start polling
    pollForFactoryEvents();
    console.log(`✅ [${chain}] Factory event polling successfully started (10s intervals)`);
  }

  subscribe("sepolia");
  subscribe("baseSepolia");
  
  console.log("🎯 [relayer] All event listeners are now active!");
  console.log("⏳ [relayer] Waiting for DstSecretRevealed events to trigger source withdrawals...");
}


