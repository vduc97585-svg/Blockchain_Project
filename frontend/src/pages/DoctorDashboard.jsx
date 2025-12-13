import React, { useEffect, useState } from "react";
import { loadContract } from "../web3";

export default function DoctorDashboard() {
  const [account, setAccount] = useState("");

  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [cid, setCid] = useState("");

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // =============================
  // LOAD METAMASK ACCOUNT
  // =============================
  useEffect(() => {
    async function loadAccount() {
      if (!window.ethereum) {
        alert("MetaMask chưa được cài");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      setAccount(accounts[0]);
    }

    loadAccount();
  }, []);

  // =============================
  // LOAD TOKENS DOCTOR CAN WRITE
  // =============================
  async function loadTokens() {
    if (!account) return;

    try {
      const res = await fetch(
        `http://localhost:8000/doctor/${account}/tokens`
      );
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch (err) {
      console.error(err);
      alert("Không load được token");
    }
  }

  useEffect(() => {
    if (account) loadTokens();
  }, [account]);

  // =============================
  // UPLOAD FILE → IPFS (NO CRYPTO)
  // =============================
  async function handleUploadToIPFS() {
    if (!uploadFile) {
      alert("Chọn file trước");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);

      const res = await fetch("http://localhost:8000/ipfs/upload", {
        method: "POST",
        body: fd
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setCid(data.cid);

      alert("Upload thành công\nCID: " + data.cid);
    } catch (err) {
      console.error(err);
      alert("Upload IPFS thất bại");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // ADD ENTRY TO BLOCKCHAIN
  // =============================
  async function addEntry() {
    if (!selectedToken || !cid) {
      alert("Chọn token và có CID");
      return;
    }

    setLoading(true);
    setTxStatus("Submitting transaction...");

    try {
      const { contract } = await loadContract();

      const tx = await contract.add_entry(
        selectedToken.tokenId,
        cid
      );

      setTxHash(tx.hash);
      setTxStatus("Pending...");

      const receipt = await tx.wait();
      setTxStatus(`Mined at block ${receipt.blockNumber}`);

      alert("Add entry thành công");
      setCid("");
      setUploadFile(null);
    } catch (err) {
      console.error(err);
      alert(
        "Transaction error: " +
          (err.info?.error?.message || err.message)
      );
      setTxStatus("");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // UI
  // =============================
  return (
    <div style={{ padding: 40, maxWidth: 800 }}>
      <h2>Doctor Dashboard</h2>
      <p><b>Connected:</b> {account}</p>

      <hr />

      <h3>Tokens You Can Write ({tokens.length})</h3>
      {tokens.length === 0 && <p>Không có token nào</p>}

      <ul>
        {tokens.map(t => (
          <li key={t.tokenId} style={{ marginBottom: 8 }}>
            <button onClick={() => setSelectedToken(t)}>
              Token #{t.tokenId}
            </button>
            <span style={{ marginLeft: 10 }}>
              Patient: {t.patient}
            </span>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <div style={{ marginTop: 30 }}>
          <h4>Selected Token: #{selectedToken.tokenId}</h4>

          <div style={{ marginTop: 10 }}>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files[0])}
            />
            <button
              onClick={handleUploadToIPFS}
              disabled={loading}
              style={{ marginLeft: 10 }}
            >
              Upload to IPFS
            </button>
          </div>

          <div style={{ marginTop: 15 }}>
            <label>CID</label>
            <input
              type="text"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
              placeholder="CID từ IPFS"
              style={{ width: "100%", padding: 6 }}
            />
          </div>

          <button
            onClick={addEntry}
            disabled={loading || !cid}
            style={{ marginTop: 15 }}
          >
            Add Entry to Blockchain
          </button>
        </div>
      )}

      {txHash && (
        <div style={{ marginTop: 30 }}>
          <p><b>TX Hash:</b> {txHash}</p>
          <p><b>Status:</b> {txStatus}</p>
        </div>
      )}
    </div>
  );
}
