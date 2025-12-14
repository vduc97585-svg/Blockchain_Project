import React, { useEffect, useState } from "react";
import { loadContract } from "../web3";

const BACKEND = "http://localhost:8000";

export default function DoctorDashboard() {
  const [account, setAccount] = useState("");

  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);

  const [recordContent, setRecordContent] = useState(null);
  const [entries, setEntries] = useState([]);

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
        method: "eth_requestAccounts",
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
      const res = await fetch(`${BACKEND}/doctor/${account}/tokens`);
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
  // SHOW MINT RECORD
  // =============================
  async function showRecord(cid) {
    try {
      const res = await fetch(`${BACKEND}/ipfs/cat/${cid}`);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        setRecordContent(data);
      } catch {
        setRecordContent({ raw: text });
      }
    } catch (e) {
      console.error(e);
      alert("Không load được record");
    }
  }

  // =============================
  // LOAD ENTRIES
  // =============================
  async function loadEntries(token) {
    setSelectedToken(token);
    setRecordContent(null); // reset khi chọn token mới
    try {
      // show mint record
      showRecord(token.cid);

      // load entries
      const res = await fetch(`${BACKEND}/record/${token.tokenId}/entries`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.error(e);
      alert("Không load được entries");
    }
  }

  // =============================
  // DOWNLOAD FILE
  // =============================
  async function downloadFile(cid, filename) {
    try {
      const res = await fetch(`${BACKEND}/ipfs/cat/${cid}`);
      const blob = await res.blob();
      const mime = res.headers.get("content-type") || "application/octet-stream";
      const url = URL.createObjectURL(blob);

      if (mime.startsWith("image/") || mime === "application/pdf") {
        const newTab = window.open();
        if (!newTab) return alert("Pop-up bị chặn");
        newTab.document.body.innerHTML = `<iframe src="${url}" style="width:100%;height:100vh;" frameborder="0"></iframe>`;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "file";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error(e);
      alert("Download thất bại");
    }
  }

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

      const res = await fetch(`${BACKEND}/ipfs/upload`, {
        method: "POST",
        body: fd,
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

      const tx = await contract.add_entry(selectedToken.tokenId, cid);

      setTxHash(tx.hash);
      setTxStatus("Pending...");

      const receipt = await tx.wait();
      setTxStatus(`Mined at block ${receipt.blockNumber}`);

      alert("Add entry thành công");
      setCid("");
      setUploadFile(null);

      // reload entries sau khi thêm
      loadEntries(selectedToken);
    } catch (err) {
      console.error(err);
      alert("Transaction error: " + (err.info?.error?.message || err.message));
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
        {tokens.map((t) => (
          <li key={t.tokenId} style={{ marginBottom: 8 }}>
            <button onClick={() => loadEntries(t)}>
              Token #{t.tokenId}
            </button>
            <span style={{ marginLeft: 10 }}>Patient: {t.patient}</span>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <>
          {/* MINT RECORD */}
          <section className="border p-4 rounded mb-6">
            <h4 className="font-semibold mb-2">Medical Record</h4>
            <div className="mb-2">
              <button
                className="text-green-600 underline mr-2"
                onClick={() => showRecord(selectedToken.cid)}
              >
                Show Record
              </button>
              <button
                className="text-blue-600 underline"
                onClick={() => downloadFile(selectedToken.cid)}
              >
                Download Record
              </button>
            </div>
            {recordContent && (
              <div className="mt-2 p-2 bg-gray-50 rounded border">
                {recordContent.raw ? (
                  <pre>{recordContent.raw}</pre>
                ) : (
                  <div>
                    <p><strong>Patient Name:</strong> {recordContent.patientName}</p>
                    <p><strong>Patient ID:</strong> {recordContent.patientId}</p>
                    <p><strong>Hospital:</strong> {recordContent.hospital}</p>
                    <p><strong>Created At:</strong> {recordContent.createdAt}</p>
                    <p><strong>Description:</strong> {recordContent.description}</p>
                    <p><strong>Note:</strong> {recordContent.note}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ENTRIES */}
          <section className="border p-4 rounded mb-6">
            <h4 className="font-semibold mb-2">Entries ({entries.length})</h4>
            {entries.length === 0 && <p>No entries yet</p>}
            <ul>
              {entries.map((e, i) => (
                <li key={i} className="border p-2 mb-2 rounded">
                  <p>Author: {e.author}</p>
                  <p>CID: {e.cid}</p>
                  <button
                    className="text-green-600 underline"
                    onClick={() => downloadFile(e.cid)}
                  >
                    Download Entry
                  </button>
                  <p className="text-sm text-gray-500">
                    {new Date(e.timestamp * 1000).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* UPLOAD / ADD ENTRY */}
          <section className="border p-4 rounded mb-6">
            <h4 className="font-semibold mb-2">Add Entry</h4>
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
          </section>
        </>
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