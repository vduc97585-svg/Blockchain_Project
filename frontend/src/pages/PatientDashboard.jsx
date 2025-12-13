// src/pages/PatientDashboard.jsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import CONTRACT_ABI from "../contract/abi.json";
import {CONTRACT_ADDRESS} from "../web3";

const BACKEND_BASE = "http://localhost:8000";

export default function PatientDashboard() {
  const [account, setAccount] = useState("");
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hospitalAddr, setHospitalAddr] = useState("");
  const [externalAddr, setExternalAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // Connect MetaMask
  async function connectWallet() {
    if (window.ethereum) {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accs[0]);
    } else {
      alert("MetaMask not detected");
    }
  }

  // Load patient tokens
  async function loadTokens() {
    if (!account) return alert("Connect wallet first");
    try {
      const res = await axios.get(`${BACKEND_BASE}/record/patient/${account}`);
      setTokens(res.data.records);
    } catch (e) {
      console.error(e);
      alert("Error loading tokens: " + (e.response?.data?.detail || e.message));
    }
  }

  // Load entries for selected token
  async function loadEntries(tokenId, cid) {
    setSelectedToken({ tokenId, cid });
    try {
      const res = await axios.get(`${BACKEND_BASE}/record/${tokenId}/entries`);
      setEntries(res.data.entries);
    } catch (e) {
      console.error(e);
      alert("Error loading entries: " + (e.response?.data?.detail || e.message));
    }
  }

  // Helper: execute transaction via MetaMask
// Helper: execute transaction via MetaMask (Ethers v6)
  async function executeTx(callback) {
    if (!account) return alert("Connect wallet first");
    try {
      setLoading(true);
      setTxStatus("Submitting...");

      // Ethers v6: dùng BrowserProvider thay cho Web3Provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner(); // must await
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await callback(contract);  // chạy hàm smart contract
      setTxHash(tx.hash);
      setTxStatus("Pending...");

      await tx.wait();  // chờ mined
      setTxStatus("Mined");
      setLoading(false);
    } catch (e) {
      console.error(e);
      alert("Transaction error: " + e.message);
      setTxStatus("");
      setLoading(false);
    }
  }


  // Delegate hospital
  const delegateHospital = () => {
    if (!selectedToken || !hospitalAddr) return alert("Select token & enter hospital address");
    executeTx((contract) => contract.delegate_hospital(selectedToken.tokenId, hospitalAddr));
  };

  // Revoke hospital
  const revokeHospital = () => {
    if (!selectedToken || !hospitalAddr) return alert("Select token & enter hospital address");
    executeTx((contract) => contract.revoke_hospital(selectedToken.tokenId, hospitalAddr));
  };

  // Grant external write
  const grantExternalWrite = () => {
    if (!selectedToken || !externalAddr) return alert("Select token & enter external address");
    executeTx((contract) => contract.grant_external_write(selectedToken.tokenId, externalAddr));
  };

  // Revoke external write
  const revokeExternalWrite = () => {
    if (!selectedToken || !externalAddr) return alert("Select token & enter external address");
    executeTx((contract) => contract.revoke_external_write(selectedToken.tokenId, externalAddr));
  };

  useEffect(() => {
    if (account) loadTokens();
  }, [account]);

  return (
    <div style={{ padding: 40 }}>
      <h2>Patient Dashboard</h2>
      {!account ? (
        <button onClick={connectWallet}>Connect MetaMask</button>
      ) : (
        <p>Connected: {account}</p>
      )}

      <h3>Your Tokens ({tokens.length})</h3>
      <ul>
        {tokens.map(t => (
          <li key={t.tokenId}>
            <button onClick={() => loadEntries(t.tokenId, t.cid)}>
              Token {t.tokenId} - CID: {t.cid}
            </button>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <>
          <div style={{ marginBottom: 20 }}>
            <h4>Record File</h4>
            <p>
              <a
                href={`https://ipfs.io/ipfs/${selectedToken.cid}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download file
              </a>
            </p>
          </div>

          <h3>Entries</h3>
          <ul>
            {entries.length === 0 && <p>No entries yet.</p>}
            {entries.map((e, idx) => (
              <li key={idx} style={{ marginBottom: 10 }}>
                <p>Author: {e.author}</p>
                <p>
                  CID:{" "}
                  <a
                    href={`https://ipfs.io/ipfs/${e.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {e.cid}
                  </a>
                </p>
                <p>Timestamp: {new Date(e.timestamp * 1000).toLocaleString()}</p>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 20 }}>
            <h4>Delegate / Revoke Hospital</h4>
            <input
              placeholder="Hospital Address"
              value={hospitalAddr}
              onChange={(e) => setHospitalAddr(e.target.value)}
            />
            <button onClick={delegateHospital} disabled={loading}>Delegate</button>
            <button onClick={revokeHospital} disabled={loading}>Revoke</button>
          </div>

          <div style={{ marginTop: 20 }}>
            <h4>Grant / Revoke External Write</h4>
            <input
              placeholder="External Address"
              value={externalAddr}
              onChange={(e) => setExternalAddr(e.target.value)}
            />
            <button onClick={grantExternalWrite} disabled={loading}>Grant</button>
            <button onClick={revokeExternalWrite} disabled={loading}>Revoke</button>
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
