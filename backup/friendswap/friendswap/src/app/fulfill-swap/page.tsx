"use client";
import { useEffect, useState } from "react";
import { backend } from "~/lib/backend";
import { Button } from "~/components/ui/Button";
import { NetworkSwitcher } from "~/components/ui/NetworkSwitcher";
import { useAccount, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useContractWrite } from "~/hooks/useContractWrite";
import { useRouter, useSearchParams } from "next/navigation";
import sdk from "@farcaster/miniapp-sdk";
import { formatTokenAmount, getTokenDecimals, getTokenSymbol } from "~/utils/formatAmount";

export default function FulfillSwapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const swapId = searchParams.get('swapId');
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();


  const [swap, setSwap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState<'approve' | 'deploy' | 'done'>('approve');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txStatus, setTxStatus] = useState("");
  const [notification, setNotification] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);
  const { writeContract, isPending } = useContractWrite();
  const { data: txReceipt, isLoading: txLoading } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    loadSwap();
  }, [swapId]);

  const loadSwap = async () => {
    setLoading(true);
    try {
      const swaps = await backend.listSwaps();
      if (swapId && swaps[parseInt(swapId)]) {
        setSwap(swaps[parseInt(swapId)]);
      } else {
        setError("Swap not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load swap");
    } finally {
      setLoading(false);
      // Call ready after content is loaded
      sdk.actions.ready();
    }
  };

  const approveToken = async () => {
    if (!swap || !isConnected) return;
    
    try {
      setTxStatus("Approving tokens...");
      const erc20Abi = [{
        type: "function", stateMutability: "nonpayable", name: "approve",
        inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }]
      }];
      
      const amount = BigInt(swap.executionData.fullfillerAmount);
      const hash = await writeContract({
        address: swap.executionData.dstToken,
        abi: erc20Abi as any,
        functionName: "approve",
        args: [swap.dstEscrow, amount],
        chainId: chainId, // Use current chain for approval
      });
      
      setTxHash(hash);
      setTxStatus("Waiting for confirmation...");
      setStep('deploy');
      
      // Refresh swap data to reflect any backend changes
      await loadSwap();
      
      setNotification({type: 'success', message: 'Tokens approved! Now deploy the destination escrow.'});
    } catch (err) {
      setTxStatus("");
      setNotification({type: 'error', message: `Approval failed: ${err instanceof Error ? err.message : 'Unknown error'}`});
    }
  };

  const deployEscrow = async () => {
    if (!swap || !isConnected) {
      setNotification({type: 'error', message: 'Please connect your wallet first'});
      return;
    }

    console.log("Starting deploy escrow...");
    console.log("Swap data:", swap);
    console.log("Connected address:", address);
    
    try {
      setTxStatus("Deploying destination escrow...");
      const factoryAbi = [{
        type: "function", stateMutability: "payable", name: "createDstEscrow",
        inputs: [{
          type: "tuple", name: "executionData", components: [
            { name: "orderHash", type: "bytes32" },
            { name: "hashlock", type: "bytes32" },
            { name: "asker", type: "address" },
            { name: "fullfiller", type: "address" },
            { name: "srcToken", type: "address" },
            { name: "dstToken", type: "address" },
            { name: "srcChainId", type: "uint256" },
            { name: "dstChainId", type: "uint256" },
            { name: "askerAmount", type: "uint256" },
            { name: "fullfillerAmount", type: "uint256" },
            { name: "platformFee", type: "uint256" },
            { name: "feeCollector", type: "address" },
            { name: "timelocks", type: "uint256" },
            { name: "parameters", type: "bytes" },
          ]
        }], outputs: []
      }];
      
      const ed = swap.executionData;
      const execData = {
        orderHash: ed.orderHash,
        hashlock: ed.hashlock,
        asker: ed.asker,
        fullfiller: address, // Use connected wallet as fullfiller
        srcToken: ed.srcToken,
        dstToken: ed.dstToken,
        srcChainId: BigInt(ed.srcChainId),
        dstChainId: BigInt(ed.dstChainId),
        askerAmount: BigInt(ed.askerAmount),
        fullfillerAmount: BigInt(ed.fullfillerAmount),
        platformFee: BigInt(ed.platformFee),
        feeCollector: ed.feeCollector,
        timelocks: BigInt(ed.timelocks ?? 0),
        parameters: ed.parameters ?? "0x",
      } as const;

      console.log("Execution data:", execData);

      // Use factory address based on the destination chain (where we're deploying)
      // Always compute based on destination chain, ignore stored factoryAddress
      const dstChainId = parseInt(swap.executionData.dstChainId);
      const factoryAddress = dstChainId === 11155111 
        ? "0xDC9110e9E4A530a28e97933a3D2b381B2dEc7596"  // Sepolia factory
        : "0x67c08F4936AeE457B44CACcf2934F15473214f0e"; // Base Sepolia factory
      const gasValue = swap.executionData.dstToken === "0x0000000000000000000000000000000000000000"
        ? BigInt(swap.executionData.fullfillerAmount) + BigInt("100000000000000") // Token amount + gas fee for ETH
        : BigInt("100000000000000"); // Just gas fee for ERC-20
      
      console.log("swap.factoryAddress:", swap.factoryAddress);
      console.log("Computed factory address:", (dstChainId === 11155111 
        ? "0xDC9110e9E4A530a28e97933a3D2b381B2dEc7596"  // Sepolia factory
        : "0x67c08F4936AeE457B44CACcf2934F15473214f0e")); // Base Sepolia factory
      console.log("Final factory address:", factoryAddress);
      console.log("Gas value:", gasValue.toString());
      console.log("Destination chain ID:", dstChainId);
      console.log("Current connected chain:", chainId);
      console.log("Should be on destination chain:", dstChainId === 11155111 ? "Sepolia" : "Base Sepolia");
      console.log("Destination token address:", swap.executionData.dstToken);
      console.log("Is ETH?", swap.executionData.dstToken === "0x0000000000000000000000000000000000000000");
      console.log("Fulfiller amount:", swap.executionData.fullfillerAmount);

      console.log(`Current chain: ${chainId}, Required chain: ${dstChainId}`);
      
      const hash = await writeContract({
        address: factoryAddress,
        abi: factoryAbi as any,
        functionName: "createDstEscrow",
        args: [execData as any],
        value: gasValue,
        chainId: dstChainId,
      });
      
      console.log("Transaction hash:", hash);
      setTxHash(hash);
      setTxStatus("Transaction submitted! Waiting for confirmation...");
      
      // Deployment will be detected automatically via factory events
      
      setStep('done');
      
      // Refresh swap data to reflect any backend changes
      await loadSwap();
      
      setNotification({type: 'success', message: '🎉 Destination escrow deployed! The relayer will finalize the source chain automatically.'});
    } catch (err) {
      console.error("Deploy error:", err);
      setTxStatus("");
      
      let errorMessage = "Unknown error";
      if (err instanceof Error) {
        errorMessage = err.message;
        // Check for common error patterns
        if (errorMessage.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas + token amount";
        } else if (errorMessage.includes("execution reverted")) {
          errorMessage = "Transaction reverted - check token balances and approvals";
        } else if (errorMessage.includes("user rejected")) {
          errorMessage = "Transaction rejected by user";
        } else if (errorMessage.includes('chainId') || errorMessage.includes('chain')) {
          errorMessage = `Chain error: Please ensure your wallet supports ${parseInt(swap.executionData.dstChainId) === 11155111 ? 'Sepolia' : 'Base Sepolia'} testnet`;
        }
      }
      
      setNotification({type: 'error', message: `Deploy failed: ${errorMessage}`});
    }
  };

  if (loading) {
    return (
      <div className="container py-4">
        <div className="text-center py-8">
          <div className="spinner h-6 w-6 mx-auto mb-2"></div>
          <p className="text-sm">Loading swap...</p>
        </div>
      </div>
    );
  }

  if (error || !swap) {
    return (
      <div className="container py-4">
        <div className="card p-4 bg-red-50 text-red-800 text-center">
          <div className="font-medium mb-2">Error</div>
          <div className="text-sm">{error || "Swap not found"}</div>
          <Button className="mt-3" onClick={() => router.push("/")}>
            ← Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" onClick={() => router.back()}>
          ← Back
        </Button>
        <h2 className="text-xl font-semibold">Fulfill Swap</h2>
      </div>

      {!isConnected && (
        <div className="card p-3 bg-yellow-50 text-yellow-800 text-sm">
          Please connect your wallet to fulfill this swap
        </div>
      )}

      {/* Notification Display */}
      {notification && (
        <div className={`card p-3 text-sm ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' :
          notification.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          <div className="flex justify-between items-start">
            <div>{notification.message}</div>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 text-lg leading-none opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Swap Details */}
      <div className="card p-4">
        <h3 className="text-lg font-medium mb-3">Swap Details</h3>
        <div className="space-y-2 text-sm">
          <div><strong>From:</strong> {swap.executionData.asker?.slice(0, 6)}...{swap.executionData.asker?.slice(-4)}</div>
          <div><strong>They give:</strong> {formatTokenAmount(
            swap.executionData.askerAmount,
            getTokenSymbol(swap.executionData.srcToken),
            getTokenDecimals(swap.executionData.srcToken)
          )} on {swap.executionData.srcChainId === "11155111" ? "Sepolia" : "Base Sepolia"}</div>
          <div><strong>You give:</strong> {formatTokenAmount(
            swap.executionData.fullfillerAmount,
            getTokenSymbol(swap.executionData.dstToken),
            getTokenDecimals(swap.executionData.dstToken)
          )} on {swap.executionData.dstChainId === "11155111" ? "Sepolia" : "Base Sepolia"}</div>
          <div><strong>You get:</strong> {formatTokenAmount(
            swap.executionData.askerAmount,
            getTokenSymbol(swap.executionData.srcToken),
            getTokenDecimals(swap.executionData.srcToken)
          )} when complete</div>
        </div>
      </div>

      {/* Network Check */}
      <NetworkSwitcher requiredChainId={parseInt(swap.executionData.dstChainId)} />

      {/* Transaction Status */}
      {(txStatus || txHash) && (
        <div className="card p-3 bg-blue-50 text-blue-800 text-sm">
          <div className="font-medium mb-1">Transaction Status</div>
          <div className="text-xs">
            {txStatus}
            {txHash && (
              <div className="mt-1">
                <a 
                  href={`https://${parseInt(swap.executionData.dstChainId) === 11155111 ? 'sepolia.etherscan.io' : 'sepolia.basescan.org'}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View transaction ↗
                </a>
              </div>
            )}
            {txLoading && <div className="mt-1">⏳ Confirming...</div>}
            {txReceipt && <div className="mt-1">✅ Confirmed!</div>}
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="card p-4">
        <h3 className="text-lg font-medium mb-3">Steps to Complete</h3>
        
        <div className="space-y-3">
          {/* Step 1: Approve */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${step === 'approve' ? 'bg-blue-50 border border-blue-200' : step === 'deploy' || step === 'done' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === 'approve' ? 'bg-blue-500 text-white' : step === 'deploy' || step === 'done' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
              {step === 'deploy' || step === 'done' ? '✓' : '1'}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Approve Tokens</div>
              <div className="text-xs text-gray-600">Allow the escrow to use your tokens</div>
            </div>
            {step === 'approve' && swap.executionData.dstToken !== "0x0000000000000000000000000000000000000000" && (
              <Button 
                size="sm" 
                onClick={approveToken}
                disabled={isPending || !isConnected}
              >
                {isPending ? "Approving..." : "Approve"}
              </Button>
            )}
            {step === 'approve' && swap.executionData.dstToken === "0x0000000000000000000000000000000000000000" && (
              <Button 
                size="sm" 
                onClick={() => setStep('deploy')}
                disabled={!isConnected}
              >
                Skip (ETH)
              </Button>
            )}
          </div>

          {/* Step 2: Deploy */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${step === 'deploy' ? 'bg-blue-50 border border-blue-200' : step === 'done' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === 'deploy' ? 'bg-blue-500 text-white' : step === 'done' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
              {step === 'done' ? '✓' : '2'}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">Deploy Escrow</div>
              <div className="text-xs text-gray-600">Lock your tokens and complete the swap</div>
            </div>
            {step === 'deploy' && (
              <div className="space-y-2">
                <Button 
                  size="sm" 
                  onClick={() => {
                    console.log("Deploy button clicked!");
                    console.log("Step:", step);
                    console.log("isPending:", isPending);
                    console.log("isConnected:", isConnected);
                    deployEscrow();
                  }}
                  disabled={isPending || !isConnected}
                  className="bg-blue-500 text-white"
                >
                  {isPending ? "Deploying..." : "Deploy Escrow"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    console.log("Test button clicked!");
                    setNotification({type: 'info', message: 'Test button works! Issue might be with the transaction.'});
                  }}
                >
                  Test Button
                </Button>
              </div>
            )}
          </div>

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-green-500 text-white">
                ✓
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Swap Complete!</div>
                <div className="text-xs text-gray-600">The relayer will finalize both chains automatically</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {step === 'done' && (
        <div className="card p-4 bg-green-50 border-green-200 text-center">
          <div className="text-lg font-medium text-green-800 mb-2">🎉 Swap Fulfilled!</div>
          <div className="text-sm text-green-700 mb-3">
            Your tokens are locked and the swap will be completed automatically by the relayer.
          </div>
          <Button onClick={() => router.push("/")}>
            ← Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}