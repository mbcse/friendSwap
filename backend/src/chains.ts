import { sepolia, baseSepolia } from "viem/chains";

export type ChainKey = "sepolia" | "baseSepolia";

export const CHAINS = {
  sepolia,
  baseSepolia,
} as const;

export const CHAIN_RPC: Record<ChainKey, string> = {
  sepolia: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia.therpc.io",
  baseSepolia: process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com",
};


