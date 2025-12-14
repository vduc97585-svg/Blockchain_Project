import React, { useState } from "react";
import axios from "axios";

export default function AdminDashboard() {
  const [hospital, setHospital] = useState("");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState("");

  async function registerHospital() {
    try {
      setLoading(true);
      setTxStatus("Submitting...");
      const res = await axios.post("http://localhost:8000/hospital/register", { hospital });

      const hash = res.data.tx_hash;
      setTxHash(hash);
      setTxStatus("Pending...");

      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(
            `http://localhost:8000/hospital/tx_status/${hash}`
          );
          if (statusRes.data.status === "mined") {
            setTxStatus(`Mined at block ${statusRes.data.blockNumber}`);
            clearInterval(interval);
            setLoading(false);
          }
        } catch (err) {
          console.error("Check tx status error:", err);
        }
      }, 3000);
    } catch (error) {
      console.error(error);
      alert("Error: " + (error.response?.data?.detail || error.message));
      setTxStatus("");
      setLoading(false);
    }
  }

  async function unregisterHospital() {
    try {
      setLoading(true);
      setTxStatus("Submitting...");
      const res = await axios.post(
        "http://localhost:8000/hospital/unregister",
        { hospital }
      );

      const hash = res.data.tx_hash;
      setTxHash(hash);
      setTxStatus("Pending...");

      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(
            `http://localhost:8000/hospital/tx_status/${hash}`
          );
          if (statusRes.data.status === "mined") {
            setTxStatus(`Mined at block ${statusRes.data.blockNumber}`);
            clearInterval(interval);
            setLoading(false);
          }
        } catch (err) {
          console.error("Check tx status error:", err);
        }
      }, 3000);
    } catch (error) {
      console.error(error);
      alert("Error: " + (error.response?.data?.detail || error.message));
      setTxStatus("");
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={{ marginBottom: 10 }}>🛠 Admin Dashboard</h2>
        <p style={{ color: "#666", marginBottom: 20 }}>
          Quản lý bệnh viện trên Blockchain
        </p>

        <input
          placeholder="Hospital Address (0x...)"
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
            {loading ? "Submitting..." : "Register Hospital"}
          </button>

          <button
            onClick={unregisterHospital}
            disabled={loading}
            style={styles.dangerButton}
          >
            {loading ? "Submitting..." : "Unregister Hospital"}
          </button>
        </div>

        {txHash && (
          <div style={styles.txBox}>
            <p><b>TX Hash:</b></p>
            <p style={styles.hash}>{txHash}</p>
            <p><b>Status:</b> {txStatus}</p>
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
    width: 480,
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 12,
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #ccc",
    marginBottom: 20,
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
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
