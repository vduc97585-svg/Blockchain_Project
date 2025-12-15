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
    <div style={styles.page}>
      <div style={styles.container}>

        {/* ===== HEADER ===== */}
        <div style={styles.header}>
          <h2 style={styles.title}>Trang Bác sĩ</h2>
          <p style={styles.subtitle}>
            Ví kết nối:
            <span style={styles.address}>{account}</span>
          </p>
        </div>

        {/* ===== MAIN LAYOUT ===== */}
        <div style={styles.layout}>

          {/* ===== LEFT: TOKEN LIST ===== */}
          <aside style={styles.sidebar}>
            <h3 style={styles.sectionTitle}>
              Danh sách hồ sơ bệnh án (SL: {tokens.length})
            </h3>

            {tokens.length === 0 && (
              <p style={styles.muted}>Hiện không có hồ sơ bệnh án</p>
            )}

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
                    <div><b>Mã hồ sơ: {t.tokenId}</b></div>
                    <div style={styles.smallText}>
                      Địa chỉ của Bệnh nhân: 
                      <span style={styles.wallet}>{t.patient}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* ===== RIGHT: DETAILS ===== */}
          <main style={styles.content}>
            {!selectedToken && (
              <div style={styles.emptyState}>
                Chọn một hồ sơ bệnh án để xem chi tiết
              </div>
            )}

            {selectedToken && (
              <>
                {/* ===== MINT RECORD ===== */}
                <section style={styles.card}>
                  <h4 style={styles.cardTitle}>Chi tiết hồ sơ bệnh án</h4>

                  <div style={styles.row}>
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
                          <p><b>Tên bệnh nhân:</b> {recordContent.patientName}</p>
                          <p><b>Mã bệnh nhân:</b> {recordContent.patientId}</p>
                          <p><b>Bệnh viện:</b> {recordContent.hospital}</p>
                          <p><b>Thời điểm tạo:</b> {recordContent.createdAt}</p>
                          <p><b>Mô tả:</b> {recordContent.description}</p>
                      
                        </>
                      )}
                    </div>
                  )}
                </section>

                {/* ===== ENTRIES ===== */}
                <section style={styles.card}>
                  <h4 style={styles.cardTitle}>
                    Bản ghi (SL: {entries.length})
                  </h4>

                  {entries.length === 0 && (
                    <p style={styles.muted}>No entries yet</p>
                  )}

                  {entries.map((e, i) => (
                    <div key={i} style={styles.entryItem}>
                      <p><b>Bác sĩ khám:</b> {e.author}</p>
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

                {/* ===== ADD ENTRY ===== */}
                <section style={styles.card}>
                  <h4 style={styles.cardTitle}>➕ Thêm bản ghi </h4>

                  <div style={styles.row}>
                    <label style={styles.fileLabel}>
                      📎 Chọn file hồ sơ
                      <input
                        type="file"
                        style={styles.hiddenFileInput}
                        onChange={(e) => setUploadFile(e.target.files[0])}
                      />
                    </label>

                    {uploadFile && (
                      <div style={styles.fileName}>
                        {uploadFile.name}
                      </div>
                    )}

                    <button
                      style={styles.primaryBtn}
                      onClick={handleUploadToIPFS}
                      disabled={loading}
                    >
                      Tải lên IPFS
                    </button>
                  </div>

                  <input
                    style={styles.input}
                    placeholder="CID từ IPFS"
                    value={cid}
                    onChange={(e) => setCid(e.target.value)}
                  />

                  <button
                    style={styles.successBtn}
                    onClick={addEntry}
                    disabled={loading || !cid}
                  >
                    Thêm bản ghi vào hồ sơ bệnh án
                  </button>
                </section>
              </>
            )}
          </main>
        </div>

        {/* ===== TX STATUS ===== */}
        {txHash && (
          <div style={styles.txBox}>
            <p><b>TX Hash:</b> {txHash}</p>
            <p><b>Status:</b> {txStatus}</p>
          </div>
        )}
      </div>
    </div>
);
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 40,
    fontFamily: "Segoe UI, Roboto, sans-serif",
  },
  wallet: {
  display: "block",
  marginTop: 4,
  fontSize: 14,
  color: "#374151",

  wordBreak: "break-all",     
  overflowWrap: "anywhere",   
  whiteSpace: "normal",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  header: {
    marginBottom: 30,
    textAlign: "center",
  },
  title: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    marginTop: 6,
  },
  address: {
    marginLeft: 6,
    fontWeight: 500,
    wordBreak: "break-all",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 24,
  },
  sidebar: {
    background: "#fff",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  tokenList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  tokenBtn: {
    width: "100%",
    textAlign: "left",
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
  },
  tokenBtnActive: {
    background: "#e0e7ff",
    borderColor: "#6366f1",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  emptyState: {
    background: "#fff",
    borderRadius: 14,
    padding: 40,
    textAlign: "center",
    color: "#64748b",
  },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  recordBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  entryItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  timestamp: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  row: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    marginBottom: 12,
  },
  primaryBtn: {
    padding: "8px 14px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  successBtn: {
    width: "100%",
    padding: "10px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
    padding: 0,
  },
  muted: {
    color: "#6b7280",
    fontSize: 14,
  },
  txBox: {
    marginTop: 30,
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  },
  fileLabel: {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 10,
  background: "#f1f5f9",
  border: "1px dashed #94a3b8",
  color: "#1e293b",
  cursor: "pointer",
  fontSize: 14,
  textAlign: "center",
  transition: "all .2s ease",
  marginBottom: 10,
},

hiddenFileInput: {
  display: "none",
},

fileName: {
  marginTop: 8,
  fontSize: 13,
  color: "#374151",
  wordBreak: "break-word",
},
};
