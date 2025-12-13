// src/pages/DoctorDashboard.jsx
import React, { useEffect, useState } from "react";
import { loadContract } from "../web3";

export default function DoctorDashboard({ }) {
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [cid, setCid] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [account, setAccount] = useState("");

  useEffect(() => {
    async function load() {
      if (!window.ethereum) {
        alert("MetaMask chưa được cài");
        return;
      }
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      setAccount(accounts[0]);
    }
    load();
  }, []);
  
  
  
  // Load tokens doctor can write to
  async function loadTokens() {
    if (!account) return console.log("No account provided");
    try {
      console.log("Loading tokens for doctor:", account);
      const res = await fetch(`http://localhost:8000/doctor/${account}/tokens`);
      const data = await res.json();
      console.log("Tokens loaded:", data.tokens);
      setTokens(data.tokens || []);
    } catch (e) {
      console.error("Error loading tokens:", e);
      alert("Error loading tokens");
    }
  }

  useEffect(() => {
    if (account) loadTokens();
  }, [account]);

  // Upload file → backend (Pinata)
  async function handleUploadToIPFS() {
    if (!uploadFile) return alert("Chọn file trước");
    setLoading(true);
    console.log("Uploading file:", uploadFile.name);

    const fd = new FormData();
    fd.append("file", uploadFile);

    try {
      const res = await fetch("http://localhost:8000/ipfs/upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      setCid(data.cid);
      console.log("File uploaded, CID:", data.cid);
      alert("Uploaded: " + data.cid);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Add entry → smart contract
  async function addEntry() {
    if (!selectedToken || !cid) return alert("Select token & provide CID first");
    setLoading(true);
    setTxStatus("Submitting...");
    console.log("Adding entry to token:", selectedToken.tokenId, "CID:", cid);

    try {
      const { contract } = await loadContract();
      console.log("Contract loaded:", contract.address);

      const tx = await contract.add_entry(selectedToken.tokenId, cid);
      setTxHash(tx.hash);
      setTxStatus("Pending...");
      console.log("Transaction sent:", tx.hash);

      const receipt = await tx.wait();
      setTxStatus(`Mined at block ${receipt.blockNumber}`);
      console.log("Transaction mined:", receipt);
      alert("Entry added to blockchain!");
    } catch (err) {
      console.error("Transaction error:", err);
      alert("Transaction error: " + (err.message || err.info?.error?.message));
      setTxStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Doctor Dashboard</h2>
      <p>Connected: {account}</p>

      <h3>Tokens You Can Write To ({tokens.length})</h3>
      <ul>
        {tokens.map(t => (
          <li key={t.tokenId}>
            <button onClick={() => setSelectedToken(t)}>
              Token {t.tokenId} - CID: {t.cid}
            </button>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <div style={{ marginTop: 20 }}>
          <h4>Selected Token: {selectedToken.tokenId}</h4>

          <div>
            <input type="file" onChange={(e) => setUploadFile(e.target.files[0])} />
            <button
              onClick={handleUploadToIPFS}
              disabled={loading || !uploadFile}
              style={{ marginLeft: 10 }}
            >
              Upload to IPFS
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <label>CID (or edit manually):</label>
            <input
              type="text"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="CID from Pinata"
              style={{ width: "100%", padding: 4 }}
            />
          </div>

          <button
            onClick={addEntry}
            disabled={loading || !cid}
            style={{ marginTop: 10 }}
          >
            Add Entry to Blockchain
          </button>
        </div>
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
