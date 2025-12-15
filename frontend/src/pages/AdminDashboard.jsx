import React, { useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
  const [hospital, setHospital] = useState("");
  const [tokenId, setTokenId] = useState("");

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  /* =========================
     REGISTER HOSPITAL
  ========================= */
  async function registerHospital() {
    try {
      setLoading(true);
      setTxStatus("Submitting...");
      const res = await axios.post("http://localhost:8000/hospital/register", {
        hospital,
      });

      handleTx(res.data.tx_hash);
    } catch (error) {
      handleError(error);
    }
  }

  /* =========================
     UNREGISTER HOSPITAL
  ========================= */
  async function unregisterHospital() {
    try {
      setLoading(true);
      setTxStatus("Submitting...");
      const res = await axios.post(
        "http://localhost:8000/hospital/unregister",
        { hospital }
      );

      handleTx(res.data.tx_hash);
    } catch (error) {
      handleError(error);
    }
  }

  /* =========================
     BURN RECORD (ADMIN)
  ========================= */
  async function burnRecord() {
    if (!tokenId) {
      alert("Vui lòng nhập tokenId");
      return;
    }

    const confirmBurn = window.confirm(
      `CẢNH BÁO!\n\nBạn sắp HỦY VĨNH VIỄN hồ sơ bệnh án tokenId = ${tokenId}.\nThao tác này KHÔNG THỂ hoàn tác.\n\nBạn có chắc chắn không?`
    );
    if (!confirmBurn) return;

    try {
      setLoading(true);
      setTxStatus("Submitting...");

      const res = await axios.post("http://localhost:8000/record/burn", {
        tokenId: Number(tokenId),
      });

      handleTx(res.data.tx_hash, "Burned");
    } catch (error) {
      handleError(error);
    }
  }

  /* =========================
     TX HANDLER
  ========================= */
  function handleTx(hash, action = "Mined") {
    setTxHash(hash);
    setTxStatus("Pending...");

    const interval = setInterval(async () => {
      try {
        const statusRes = await axios.get(
          `http://localhost:8000/hospital/tx_status/${hash}`
        );
        if (statusRes.data.status === "mined") {
          setTxStatus(`${action} at block ${statusRes.data.blockNumber}`);
          clearInterval(interval);
          setLoading(false);
        }
      } catch (err) {
        console.error("Check tx status error:", err);
      }
    }, 3000);
  }

  function handleError(error) {
    console.error(error);
    alert("Error: " + (error.response?.data?.detail || error.message));
    setTxStatus("");
    setLoading(false);
  }

  /* =========================
     UI
  ========================= */
  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={{ marginBottom: 10 }}>🛠 Trang quản trị viên</h2>
        <p style={{ color: "#666", marginBottom: 20 }}>
          Quản lý hệ thống EHR trên Blockchain
        </p>

        {/* ================= HOSPITAL MANAGEMENT ================= */}
        <h3>Quản lý bệnh viện</h3>

        <input
          placeholder="Địa chỉ bệnh viện (0x...)"
          value={hospital}
          onChange={(e) => setHospital(e.target.value)}
          style={styles.input}
        />

        <div style={styles.buttonGroup}>
          <button
            onClick={registerHospital}
            disabled={loading}
            style={styles.primaryButton}
          >
            Đăng ký Bệnh viện
          </button>

          <button
            onClick={unregisterHospital}
            disabled={loading}
            style={styles.dangerButton}
          >
            Hủy đăng ký
          </button>
        </div>

        <hr style={{ margin: "30px 0" }} />

        {/* ================= BURN RECORD ================= */}
        <h3>Hủy hồ sơ bệnh án (Burn)</h3>
        <p style={{ color: "#666", marginBottom: 15 }}>
          Chỉ sử dụng trong trường hợp đặc biệt (mint nhầm, yêu cầu pháp lý).
        </p>

        <input
          placeholder="Token ID cần hủy"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          style={styles.input}
        />

        <button
          onClick={burnRecord}
          disabled={loading}
          style={styles.dangerButton}
        >
          Burn Record
        </button>

        {/* ================= TX INFO ================= */}
        {txHash && (
          <div style={styles.txBox}>
            <p>
              <b>TX Hash:</b>
            </p>
            <p style={styles.hash}>{txHash}</p>
            <p>
              <b>Status:</b> {txStatus}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== STYLE ================== */
const styles = {
  wrapper: {
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1d2671, #c33764)",
  },
  card: {
    background: "#fff",
    padding: 40,
    borderRadius: 14,
    width: 500,
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 12,
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #ccc",
    marginBottom: 15,
  },
  buttonGroup: {
    display: "flex",
    gap: 10,
    marginBottom: 10,
  },
  primaryButton: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#4f46e5",
    color: "#fff",
  },
  dangerButton: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#e11d48",
    color: "#fff",
  },
  txBox: {
    marginTop: 25,
    padding: 15,
    background: "#f4f4f5",
    borderRadius: 8,
    textAlign: "left",
    fontSize: 14,
  },
  hash: {
    wordBreak: "break-all",
    fontSize: 13,
    color: "#333",
  },
};
