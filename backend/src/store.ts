export type ExecutionData = {
  orderHash: `0x${string}`;
  hashlock: `0x${string}`;
  asker: `0x${string}`;
  fullfiller: `0x${string}`;
  srcToken: `0x${string}`;
  dstToken: `0x${string}`;
  srcChainId: bigint;
  dstChainId: bigint;
  askerAmount: bigint;
  fullfillerAmount: bigint;
  platformFee: bigint;
  feeCollector: `0x${string}`;
  timelocks: bigint;
  parameters: `0x${string}`;
};

export type SwapRecord = {
  chainKey: "sepolia" | "baseSepolia"; // destination chain for listening
  factoryAddress: `0x${string}`;
  executionData: ExecutionData;
  srcEscrow: `0x${string}`;
  dstEscrow: `0x${string}`;
  status?: string;
};

const byHashlock = new Map<string, SwapRecord>();

export function upsertSwap(rec: SwapRecord) {
  const hashlock = rec.executionData.hashlock.toLowerCase();
  const isNew = !byHashlock.has(hashlock);
  
  byHashlock.set(hashlock, rec);
  
  console.log(`💾 [store] ${isNew ? 'Added new' : 'Updated'} swap record:`);
  console.log(`🔑 [store] Hashlock: ${hashlock.slice(0, 10)}...`);
  console.log(`👤 [store] Asker: ${rec.executionData.asker}`);
  console.log(`🏭 [store] Source escrow: ${rec.srcEscrow}`);
  console.log(`🏭 [store] Destination escrow: ${rec.dstEscrow}`);
  console.log(`📊 [store] Total swaps in store: ${byHashlock.size}`);
  
  // Store reference for relayer access
  if (typeof global !== 'undefined') {
    global.swapStore = Object.fromEntries(byHashlock);
  }
}

export function getSwapByHashlock(hashlock: `0x${string}`): SwapRecord | undefined {
  const record = byHashlock.get(hashlock.toLowerCase());
  console.log(`🔍 [store] Lookup for hashlock ${hashlock.slice(0, 10)}...: ${record ? 'FOUND' : 'NOT FOUND'}`);
  
  if (!record) {
    console.log(`📝 [store] Available hashlocks:`, Array.from(byHashlock.keys()).map(h => h.slice(0, 10) + '...'));
  }
  
  return record;
}

export function listSwaps(): SwapRecord[] {
  return Array.from(byHashlock.values());
}


