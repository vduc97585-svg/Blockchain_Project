import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { loadContract } from "../web3";

const BACKEND = "http://localhost:8000";

export default function PatientDashboard() {
  const [account, setAccount] = useState("");
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hospitalAddr, setHospitalAddr] = useState("");
  const [recordContent, setRecordContent] = useState(null);

  // burn
  const [burnTokenId, setBurnTokenId] = useState("");

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  // =============================
  // CONNECT METAMASK
  // =============================
  useEffect(() => {
    async function init() {
      if (!window.ethereum) {
        alert("MetaMask chưa cài");
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setAccount(await signer.getAddress());
    }
    init();
  }, []);

  // =============================
  // LOAD TOKENS
  // =============================
  async function loadTokens(addr) {
    try {
      const res = await axios.get(`${BACKEND}/record/patient/${addr}`);
      setTokens(res.data.records || []);
    } catch (e) {
      console.error(e);
      alert("Không load được hồ sơ");
    }
  }

  useEffect(() => {
    if (account) loadTokens(account);
  }, [account]);

  // =============================
  // LOAD ENTRIES
  // =============================
  async function loadEntries(token) {
    setSelectedToken(token);
    setRecordContent(null);
    try {
      const res = await axios.get(
        `${BACKEND}/record/${token.tokenId}/entries`
      );
      setEntries(res.data.entries || []);
    } catch (e) {
      console.error(e);
      alert("Không load được entries");
    }
  }

  // =============================
  // SHOW RECORD
  // =============================
  async function showRecord(cid) {
    try {
      const res = await fetch(`${BACKEND}/ipfs/cat/${cid}`);
      const text = await res.text();
      try {
        setRecordContent(JSON.parse(text));
      } catch {
        setRecordContent({ raw: text });
      }
    } catch (e) {
      alert("Không load được record");
    }
  }

  // =============================
  // DOWNLOAD FILE
  // =============================
  async function downloadFile(cid) {
    const res = await fetch(`${BACKEND}/ipfs/cat/${cid}`);
    const blob = await res.blob();
    const mime = res.headers.get("content-type") || "";
    const url = URL.createObjectURL(blob);

    if (mime.startsWith("image/") || mime === "application/pdf") {
      const w = window.open();
      w.document.body.innerHTML = `<iframe src="${url}" style="width:100%;height:100vh;"></iframe>`;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = "file";
      a.click();
    }
  }

  // =============================
  // TX EXEC
  // =============================
  async function executeTx(fn) {
    setLoading(true);
    try {
      const { contract } = await loadContract();
      const tx = await fn(contract);
      setTxHash(tx.hash);
      setTxStatus("Pending...");
      const receipt = await tx.wait();
      setTxStatus(`Mined at block ${receipt.blockNumber}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  function delegateHospital() {
    executeTx((c) =>
      c.delegate_hospital(selectedToken.tokenId, hospitalAddr)
    );
  }

  function revokeHospital() {
    executeTx((c) =>
      c.revoke_hospital_delegate(selectedToken.tokenId, hospitalAddr)
    );
  }

  // =============================
  // BURN
  // =============================
  async function burnToken() {
    const tokenId = selectedToken?.tokenId ?? burnTokenId;
    if (!tokenId) {
      alert("Chưa có tokenId để burn");
      return;
    }
  
    if (!window.confirm(`Bạn có chắc muốn BURN token ${tokenId}?`)) return;
  
    await executeTx((c) => c.burn(tokenId));
  
    // reload lại token list từ backend
    await loadTokens(account);
  
    setSelectedToken(null);
    setBurnTokenId("");
  }
  
  

  // =============================
  // UI
  // =============================
  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <h2 style={styles.title}>Trang Bệnh nhân</h2>
          <p style={styles.subtitle}>
            Ví kết nối: <span style={styles.address}>{account}</span>
          </p>
        </div>

        <div style={styles.layout}>

          {/* SIDEBAR */}
          <aside style={styles.sidebar}>
            <h3 style={styles.sectionTitle}>
              Hồ sơ bệnh án ({tokens.length})
            </h3>

            <ul style={styles.tokenList}>
              {tokens.map((t) => (
                <li key={t.tokenId}>
                  <button
                    style={{
                      ...styles.tokenBtn,
                      ...(selectedToken?.tokenId === t.tokenId
                        ? styles.tokenBtnActive
                        : {}),
                    }}
                    onClick={() => loadEntries(t)}
                  >
                    <b>Mã hồ sơ: {t.tokenId}</b>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* CONTENT */}
          <main style={styles.content}>
            {!selectedToken && (
              <div style={styles.emptyState}>
                Chọn một hồ sơ để xem chi tiết
              </div>
            )}

            {selectedToken && (
              <>
                {/* RECORD */}
                <section style={styles.card}>
                  <h4 style={styles.cardTitle}>Hồ sơ bệnh án</h4>

                  <div style={styles.row}>
                    <button
                      style={styles.linkBtn}
                      onClick={() => showRecord(selectedToken.cid)}
                    >
                      Xem
                    </button>
                    <button
                      style={styles.linkBtn}
                      onClick={() => downloadFile(selectedToken.cid)}
                    >
                      Tải xuống
                    </button>
                  </div>

                  {recordContent && (
                    <div style={styles.recordBox}>
                      {recordContent.raw ? (
                        <pre>{recordContent.raw}</pre>
                      ) : (
                        <>
                          <p><b>Tên:</b> {recordContent.patientName}</p>
                          <p><b>Mã:</b> {recordContent.patientId}</p>
                          <p><b>Bệnh viện:</b> {recordContent.hospital}</p>
                          <p><b>Ngày tạo:</b> {recordContent.createdAt}</p>
                          <p><b>Mô tả:</b> {recordContent.description}</p>
                        </>
                      )}
                    </div>
                  )}
                </section>

                {/* ENTRIES */}
                <section style={styles.card}>
                  <h4 style={styles.cardTitle}>
                    Bản ghi ({entries.length})
                  </h4>

                  {entries.map((e, i) => (
                    <div key={i} style={styles.entryItem}>
                      <p><b>Bác sĩ:</b> {e.author}</p>
                      <p><b>CID:</b> {e.cid}</p>
                      <button
                        style={styles.linkBtn}
                        onClick={() => downloadFile(e.cid)}
                      >
                        Tải xuống
                      </button>
                      <div style={styles.timestamp}>
                        {new Date(e.timestamp * 1000).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </section>

                {/* DELEGATE */}
                <section style={styles.card}>
                  <h4 style={styles.cardTitle}>Uỷ quyền bệnh viện</h4>

                  <input
                    style={styles.input}
                    placeholder="Địa chỉ bệnh viện (0x...)"
                    value={hospitalAddr}
                    onChange={(e) => setHospitalAddr(e.target.value)}
                  />

                  <div style={styles.row}>
                    <button
                      style={styles.primaryBtn}
                      onClick={delegateHospital}
                      disabled={loading}
                    >
                      Delegate
                    </button>
                    <button
                      style={styles.dangerBtn}
                      onClick={revokeHospital}
                      disabled={loading}
                    >
                      Revoke
                    </button>
                  </div>
                </section>

                {/* 🔥 BURN TOKEN */}
                <section style={{ ...styles.card, border: "2px solid #dc2626" }}>
                  <h4 style={{ ...styles.cardTitle, color: "#dc2626" }}>
                    Burn hồ sơ bệnh án
                  </h4>

                  <p style={{ fontSize: 14, marginBottom: 10 }}>
                    Token đang chọn:{" "}
                    <b>{selectedToken.tokenId}</b>
                  </p>

                  <input
                    style={styles.input}
                    placeholder="Hoặc nhập tokenId khác (tuỳ chọn)"
                    value={burnTokenId}
                    onChange={(e) => setBurnTokenId(e.target.value)}
                  />

                  <button
                    style={styles.dangerBtn}
                    onClick={burnToken}
                    disabled={loading}
                  >
                    Burn Token
                  </button>
                </section>
              </>
            )}
          </main>
        </div>

        {txHash && (
          <div style={styles.txBox}>
            <p><b>TX:</b> {txHash}</p>
            <p><b>Status:</b> {txStatus}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* === styles === */
const styles = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: 40 },
  container: { maxWidth: 1200, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 30 },
  title: { fontSize: 36, fontWeight: "bold" },
  subtitle: { fontSize: 14, color: "#475569" },
  address: { fontWeight: 500, wordBreak: "break-all" },
  layout: { display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 },
  sidebar: { background: "#fff", padding: 20, borderRadius: 14 },
  sectionTitle: { fontWeight: "bold", marginBottom: 12 },
  tokenList: { listStyle: "none", padding: 0 },
  tokenBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    marginBottom: 10,
    cursor: "pointer",
  },
  tokenBtnActive: { background: "#e0e7ff", borderColor: "#6366f1" },
  content: { display: "flex", flexDirection: "column", gap: 20 },
  emptyState: { background: "#fff", padding: 40, borderRadius: 14 },
  card: { background: "#fff", padding: 20, borderRadius: 14 },
  cardTitle: { fontWeight: "bold", marginBottom: 12 },
  recordBox: { background: "#f8fafc", padding: 12, borderRadius: 8 },
  entryItem: { border: "1px solid #e5e7eb", padding: 12, borderRadius: 8 },
  timestamp: { fontSize: 12, color: "#6b7280" },
  row: { display: "flex", gap: 10 },
  input: { width: "100%", padding: 10, marginBottom: 12 },
  linkBtn: { color: "#2563eb", background: "none", border: "none" },
  primaryBtn: { background: "#2563eb", color: "#fff", padding: "8px 14px" },
  dangerBtn: { background: "#dc2626", color: "#fff", padding: "8px 14px" },
  txBox: { marginTop: 20, background: "#fff", padding: 16 },
};