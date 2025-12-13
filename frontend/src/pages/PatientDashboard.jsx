// src/pages/PatientDashboard.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import CONTRACT_ABI from "../contract/abi.json";
import { CONTRACT_ADDRESS } from "../web3";

const BACKEND_BASE = "http://localhost:8000";

export default function PatientDashboard() {
  const [account, setAccount] = useState("");
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hospitalAddr, setHospitalAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // ✅ Lấy account từ MetaMask (GIỐNG Hospital)
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

  // Load patient tokens
  async function loadTokens(addr) {
    try {
      const res = await axios.get(
        `${BACKEND_BASE}/record/patient/${addr}`
      );
      setTokens(res.data.records);
    } catch (e) {
      console.error(e);
      alert("Error loading tokens: " + (e.response?.data?.detail || e.message));
    }
  }

  // Load entries
  async function loadEntries(tokenId, cid) {
    setSelectedToken({ tokenId, cid });
    try {
      const res = await axios.get(
        `${BACKEND_BASE}/record/${tokenId}/entries`
      );
      setEntries(res.data.entries);
    } catch (e) {
      console.error(e);
      alert("Error loading entries: " + (e.response?.data?.detail || e.message));
    }
  }

  // Execute tx via MetaMask
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
      alert("Transaction error: " + e.message);
      setTxStatus("");
      setLoading(false);
    }
  }

  // ---- Actions ----
  const delegateHospital = () => {
    if (!selectedToken || !hospitalAddr)
      return alert("Select token & hospital");
    executeTx((c) =>
      c.delegate_hospital(selectedToken.tokenId, hospitalAddr)
    );
  };

  const revokeHospital = () => {
    if (!selectedToken || !hospitalAddr)
      return alert("Select token & hospital");
    executeTx((c) =>
      c.revoke_hospital_delegate(selectedToken.tokenId, hospitalAddr)
    );
  };

  // 🔄 Load tokens khi đã có account
  useEffect(() => {
    if (account) loadTokens(account);
  }, [account]);

  return (
    <div style={{ padding: 40 }}>
      <h2>Patient Dashboard</h2>
      <p>Connected as: {account}</p>

      <h3>Your Tokens ({tokens.length})</h3>
      <ul>
        {tokens.map((t) => (
          <li key={t.tokenId}>
            <button onClick={() => loadEntries(t.tokenId, t.cid)}>
              Token {t.tokenId} – CID: {t.cid}
            </button>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <>
          <div style={{ marginBottom: 20 }}>
            <h4>Record File</h4>
            <a
              href={`https://ipfs.io/ipfs/${selectedToken.cid}`}
              target="_blank"
              rel="noreferrer"
            >
              Download file
            </a>
          </div>

          <h3>Entries</h3>
          {entries.length === 0 && <p>No entries yet.</p>}
          <ul>
            {entries.map((e, idx) => (
              <li key={idx}>
                <p>Author: {e.author}</p>
                <p>
                  CID:{" "}
                  <a
                    href={`https://ipfs.io/ipfs/${e.cid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.cid}
                  </a>
                </p>
                <p>
                  Time: {new Date(e.timestamp * 1000).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 20 }}>
            <h4>Delegate / Revoke Hospital</h4>
            <input
              placeholder="Hospital address"
              value={hospitalAddr}
              onChange={(e) => setHospitalAddr(e.target.value)}
            />
            <button onClick={delegateHospital} disabled={loading}>
              Delegate
            </button>
            <button onClick={revokeHospital} disabled={loading}>
              Revoke
            </button>
          </div>
        </>
      )}

      {txHash && (
        <div style={{ marginTop: 20 }}>
          <p>TX Hash: {txHash}</p>
          <p>Status: {txStatus}</p>
        </div>
      )}
    </div>
  );
}
