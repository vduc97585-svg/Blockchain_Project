// src/pages/PatientDashboard.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import CONTRACT_ABI from "../contract/abi.json";
import { CONTRACT_ADDRESS } from "../web3";

const BACKEND_BASE = "http://localhost:8000";
const IPFS_GATEWAY = "http://127.0.0.1:8080/ipfs"; // ✅ LOCAL IPFS NODE

export default function PatientDashboard() {
  const [account, setAccount] = useState("");
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hospitalAddr, setHospitalAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // 🔐 Connect MetaMask (GIỐNG Hospital)
  useEffect(() => {
    async function init() {
      if (!window.ethereum) {
        alert("MetaMask not found");
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);
    }
    init();
  }, []);

  // 📦 Load patient tokens
  async function loadTokens(addr) {
    try {
      const res = await axios.get(
        `${BACKEND_BASE}/record/patient/${addr}`
      );
      setTokens(res.data.records);
    } catch (e) {
      console.error(e);
      alert("Error loading tokens");
    }
  }

  // 📄 Load entries
  async function loadEntries(tokenId, cid) {
    setSelectedToken({ tokenId, cid });
    try {
      const res = await axios.get(
        `${BACKEND_BASE}/record/${tokenId}/entries`
      );
      setEntries(res.data.entries);
    } catch (e) {
      console.error(e);
      alert("Error loading entries");
    }
  }

  // 🦊 Execute transaction
  async function executeTx(callback) {
    try {
      setLoading(true);
      setTxStatus("Submitting...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await callback(contract);
      setTxHash(tx.hash);
      setTxStatus("Pending...");
      await tx.wait();

      setTxStatus("Mined");
      setLoading(false);
    } catch (e) {
      console.error(e);
      alert("Transaction error");
      setLoading(false);
    }
  }

  // 🏥 Delegate / Revoke hospital
  const delegateHospital = () => {
    if (!selectedToken || !hospitalAddr)
      return alert("Select token & hospital address");
    executeTx((c) =>
      c.delegate_hospital(selectedToken.tokenId, hospitalAddr)
    );
  };

  const revokeHospital = () => {
    if (!selectedToken || !hospitalAddr)
      return alert("Select token & hospital address");
    executeTx((c) =>
      c.revoke_hospital_delegate(selectedToken.tokenId, hospitalAddr)
    );
  };

  // 🔁 Auto load tokens
  useEffect(() => {
    if (account) loadTokens(account);
  }, [account]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-2">Patient Dashboard</h2>
      <p className="mb-4">Connected as: {account}</p>

      <h3 className="font-semibold">Your Records ({tokens.length})</h3>
      <ul className="mb-4">
        {tokens.map((t) => (
          <li key={t.tokenId}>
            <button
              className="text-blue-600 underline"
              onClick={() => loadEntries(t.tokenId, t.cid)}
            >
              Token #{t.tokenId}
            </button>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <>
          <section className="mb-6">
            <h4 className="font-semibold">Medical Record File</h4>
            <a
              href={`${IPFS_GATEWAY}/${selectedToken.cid}`}
              target="_blank"
              rel="noreferrer"
              className="text-green-600 underline"
            >
              Download from local IPFS
            </a>
          </section>

          <section className="mb-6">
            <h3 className="font-semibold">Entries</h3>
            {entries.length === 0 && <p>No entries yet.</p>}
            <ul>
              {entries.map((e, idx) => (
                <li key={idx} className="border p-2 mb-2 rounded">
                  <p>Author: {e.author}</p>
                  <p>
                    CID:{" "}
                    <a
                      href={`${IPFS_GATEWAY}/${e.cid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      {e.cid}
                    </a>
                  </p>
                  <p>
                    Time:{" "}
                    {new Date(e.timestamp * 1000).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-semibold">Delegate / Revoke Hospital</h4>
            <input
              className="border p-2 mr-2"
              placeholder="Hospital address (0x...)"
              value={hospitalAddr}
              onChange={(e) => setHospitalAddr(e.target.value)}
            />
            <button
              className="px-3 py-1 bg-amber-600 text-white mr-2"
              onClick={delegateHospital}
              disabled={loading}
            >
              Delegate
            </button>
            <button
              className="px-3 py-1 bg-red-600 text-white"
              onClick={revokeHospital}
              disabled={loading}
            >
              Revoke
            </button>
          </section>
        </>
      )}

      {txHash && (
        <div className="mt-4">
          <p>TX: {txHash}</p>
          <p>Status: {txStatus}</p>
        </div>
      )}
    </div>
  );
}
