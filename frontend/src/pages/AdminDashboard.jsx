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

      // Poll backend every 3s to check if mined
      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`http://localhost:8000/hospital/tx_status/${hash}`);
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
    <div style={{ padding: 40 }}>
      <h2>Admin Dashboard</h2>

      <input
        placeholder="Hospital Address"
        value={hospital}
        onChange={(e) => setHospital(e.target.value)}
      />

      <div style={{ marginTop: 20 }}>
        <button onClick={registerHospital} disabled={loading}>
          {loading ? "Submitting..." : "Register Hospital"}
        </button>
        <button
          onClick={unregisterHospital}
          disabled={loading}
          style={{ marginLeft: 10, backgroundColor: "red", color: "white" }}
        >
          {loading ? "Submitting..." : "Unregister Hospital"}
        </button>
      </div>

      {txHash && (
        <div style={{ marginTop: 20 }}>
          <p>TX Hash: {txHash}</p>
          <p>Status: {txStatus}</p>
        </div>
      )}
    </div>
  );
}
