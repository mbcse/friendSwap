"use client";
import { useState, useEffect } from "react";
import { backend } from "~/lib/backend";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/Button";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { keccak256, toHex } from "viem";
import sdk from "@farcaster/miniapp-sdk";

// Token addresses for testnets
const TOKENS = {
  sepolia: {
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
    ETH: "0x0000000000000000000000000000000000000000", // Native ETH
  },
  baseSepolia: {
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    ETH: "0x0000000000000000000000000000000000000000", // Native ETH
  }
};

export default function CreateSwapPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  
  const [srcChain, setSrcChain] = useState("sepolia");
  const [dstChain, setDstChain] = useState("baseSepolia");
  const [srcTokenType, setSrcTokenType] = useState("USDC");
  const [dstTokenType, setDstTokenType] = useState("USDC");
  const [srcAmount, setSrcAmount] = useState("1"); // Human readable amount
  const [dstAmount, setDstAmount] = useState("1"); // Human readable amount
  const [srcEscrow, setSrcEscrow] = useState<string|undefined>();
  const [dstEscrow, setDstEscrow] = useState<string|undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Call ready when the page is mounted and ready
    sdk.actions.ready();
  }, []);

  async function submit() {
    if (!isConnected || !address) {
      setError("Please connect your wallet first");
      return;
    }
    
    if (!srcAmount || !dstAmount) {
      setError("Please enter amounts");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Convert human readable amounts to wei (assuming 6 decimals for USDC, 18 for ETH)
      const srcDecimals = srcTokenType === "USDC" ? 6 : 18;
      const dstDecimals = dstTokenType === "USDC" ? 6 : 18;
      const srcAmountWei = BigInt(parseFloat(srcAmount) * Math.pow(10, srcDecimals));
      const dstAmountWei = BigInt(parseFloat(dstAmount) * Math.pow(10, dstDecimals));
      
      // Generate a random hashlock for demo
      // Generate a proper secret and its hashlock
      const secret = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const hashlock = keccak256(secret as `0x${string}`);
      
      // Store secret locally for later claiming
      const swapId = `${hashlock}_${Date.now()}`;
      localStorage.setItem(`secret_${swapId}`, secret);
      localStorage.setItem(`swap_${swapId}`, JSON.stringify({
        secret,
        hashlock,
        srcChain,
        dstChain,
        srcAmount,
        dstAmount,
        srcTokenType,
        dstTokenType,
        created: Date.now()
      }));
      
      const executionData = {
        orderHash: "0x" + "0".repeat(64),
        hashlock,
        asker: address,
        fullfiller: "0x0000000000000000000000000000000000000000", // Anyone can fulfill
        srcToken: TOKENS[srcChain as keyof typeof TOKENS][srcTokenType as keyof typeof TOKENS.sepolia],
        dstToken: TOKENS[dstChain as keyof typeof TOKENS][dstTokenType as keyof typeof TOKENS.sepolia],
        srcChainId: srcChain === "sepolia" ? "11155111" : "84532",
        dstChainId: dstChain === "sepolia" ? "11155111" : "84532",
        askerAmount: srcAmountWei.toString(),
        fullfillerAmount: dstAmountWei.toString(),
        platformFee: "100",
        feeCollector: address as `0x${string}`,
        timelocks: "0",
        parameters: "0x",
      };
      
                    // Factory address should be for the source chain (where we're creating the swap)
      const factoryAddress = srcChain === "sepolia" 
        ? "0xDC9110e9E4A530a28e97933a3D2b381B2dEc7596" 
        : "0x67c08F4936AeE457B44CACcf2934F15473214f0e" as const;
      const res = await backend.createSwap({ 
        chainKey: srcChain, 
        factoryAddress, 
        executionData 
      });
      setSrcEscrow(res.srcEscrow);
      setDstEscrow(res.dstEscrow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create swap");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" onClick={() => router.back()}>
          ← Back
        </Button>
        <h2 className="text-xl font-semibold">Create Swap</h2>
      </div>
      
      {!isConnected && (
        <div className="card p-3 bg-yellow-50 text-yellow-800 text-sm">
          Please connect your wallet to create a swap
        </div>
      )}
      
      {error && (
        <div className="card p-3 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}
      
      <div className="card p-4">
        <h3 className="text-lg font-medium mb-4">Swap Details</h3>
        
        <div className="space-y-4">
          {/* What you're giving */}
          <div className="border rounded-lg p-3 bg-blue-50">
            <Label className="text-sm font-medium text-blue-800">You Give</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <select 
                  className="input text-sm" 
                  value={srcChain} 
                  onChange={(e) => setSrcChain(e.target.value)}
                >
                  <option value="sepolia">Sepolia</option>
                  <option value="baseSepolia">Base Sepolia</option>
                </select>
              </div>
              <div>
                <select 
                  className="input text-sm" 
                  value={srcTokenType} 
                  onChange={(e) => setSrcTokenType(e.target.value)}
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
              <div>
                <Input 
                  value={srcAmount} 
                  onChange={(e) => setSrcAmount(e.target.value)}
                  placeholder="1.0"
                  type="number"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* What you want */}
          <div className="border rounded-lg p-3 bg-green-50">
            <Label className="text-sm font-medium text-green-800">You Want</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div>
                <select 
                  className="input text-sm" 
                  value={dstChain} 
                  onChange={(e) => setDstChain(e.target.value)}
                >
                  <option value="sepolia">Sepolia</option>
                  <option value="baseSepolia">Base Sepolia</option>
                </select>
              </div>
              <div>
                <select 
                  className="input text-sm" 
                  value={dstTokenType} 
                  onChange={(e) => setDstTokenType(e.target.value)}
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
              <div>
                <Input 
                  value={dstAmount} 
                  onChange={(e) => setDstAmount(e.target.value)}
                  placeholder="1.0"
                  type="number"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card p-3 bg-gray-50 text-sm">
            <div className="font-medium mb-1">Swap Summary:</div>
            <div>Give {srcAmount} {srcTokenType} on {srcChain === "sepolia" ? "Sepolia" : "Base Sepolia"}</div>
            <div>Get {dstAmount} {dstTokenType} on {dstChain === "sepolia" ? "Sepolia" : "Base Sepolia"}</div>
            <div className="text-xs text-gray-600 mt-1">Your address: {address?.slice(0, 6)}...{address?.slice(-4)}</div>
          </div>
        </div>
      </div>
      
      <Button 
        onClick={submit} 
        disabled={loading || !isConnected || !srcAmount || !dstAmount}
        isLoading={loading}
        className="w-full"
      >
        {loading ? "Creating Swap..." : "Create Swap"}
      </Button>
      
      {srcEscrow && (
        <div className="card p-4 bg-green-50 border-green-200">
          <div className="text-sm font-medium text-green-800 mb-2">🎉 Swap Created Successfully!</div>
          <div className="text-xs space-y-1 mb-3">
            <div><strong>Source Escrow:</strong> {srcEscrow?.slice(0, 10)}...{srcEscrow?.slice(-6)}</div>
            <div><strong>Destination Escrow:</strong> {dstEscrow?.slice(0, 10)}...{dstEscrow?.slice(-6)}</div>
          </div>
          <div className="text-xs text-green-700 mb-3">
            Next: Approve your {srcTokenType} tokens so they can be locked when someone fulfills your swap.
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => router.push("/")}>
              ← Back to Home
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push("/initialize-source")}>
              Approve Tokens →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


