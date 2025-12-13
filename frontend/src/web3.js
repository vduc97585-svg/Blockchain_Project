// src/web3.js
import { ethers } from "ethers";
import json from "./contract/abi.json"; // đọc file ABI JSON

export const contractABI = json; // hoặc json.abi nếu file JSON có cấu trúc { "abi": [...] }
export const CONTRACT_ADDRESS = "0xfD0E594B705CE3db8A8503Ae8a3bD672dcDC2333";

// RPC provider Infura
export const rpcProvider = new ethers.JsonRpcProvider(
  "https://sepolia.infura.io/v3/485cdafb66d0410caff9b137d883c745"
);

// Load contract với signer từ MetaMask
export async function loadContract() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS missing");
  if (!contractABI || !Array.isArray(contractABI))
    throw new Error("ABI invalid: must be array");

  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
  return { contract, signer };
}
