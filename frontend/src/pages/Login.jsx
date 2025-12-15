import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadContract, rpcProvider, CONTRACT_ADDRESS } from "../web3";

export default function Login({ setRole }) {
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [role, setRoleLocal] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | connected | error
  const [message, setMessage] = useState("");

  async function handleLogin() {
    try {
      if (!window.ethereum) {
        alert("MetaMask chưa được cài đặt!");
        return;
      }

      setStatus("loading");
      setMessage("Đang kết nối MetaMask...");

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const user = accounts[0];
      setAddress(user);

      // Switch Sepolia
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xAA36A7" }],
      });

      const { contract, signer } = await loadContract();
      if (!contract || !signer) throw new Error("Không load được contract");

      const code = await rpcProvider.getCode(CONTRACT_ADDRESS);
      if (code === "0x") {
        throw new Error("Contract chưa deploy trên Sepolia");
      }

      const userRole = await contract.getRole(user);
      setRoleLocal(userRole);

      setStatus("connected");
      setMessage("Kết nối thành công");

    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "Lỗi đăng nhập");
    }
  }

  function enterSystem() {
    switch (role) {
      case "contract_owner":
        setRole("admin");
        navigate("/admin");
        break;
      case "hospital":
        setRole("hospital");
        navigate("/hospital");
        break;
      case "doctor":
        setRole("doctor");
        navigate("/doctor");
        break;
      case "patient":
        setRole("patient");
        navigate("/patient");
        break;
      default:
        alert("Không có quyền truy cập");
    }
  }

  return (
  <div style={styles.wrapper}>
    {/* ===== TIÊU ĐỀ ===== */}
    <div style={styles.header}>
      <h1 style={styles.title}>HỒ SƠ BỆNH ÁN ĐIỆN TỬ</h1>
    </div>

    <div style={styles.card}>
      <h2 style={{ marginBottom: 20 }}>Đăng nhập</h2>

      <button
        onClick={handleLogin}
        disabled={status === "loading"}
        style={styles.button}
      >
        {status === "loading" ? "Đang kết nối..." : "Kết nối ví Metamask"}
      </button>

      {address && (
        <div style={styles.info}>
          <p><b>Ví:</b> {address}</p>
          <p><b>Vai trò:</b> {role || "Đang xác định..."}</p>
        </div>
      )}

      {message && (
        <p
          style={{
            marginTop: 15,
            color: status === "error" ? "red" : "green",
          }}
        >
          {message}
        </p>
      )}

      {status === "connected" && role && (
        <button onClick={enterSystem} style={styles.enterButton}>
          Vào hệ thống
        </button>
      )}
    </div>
  </div>
);
}

/* ================== STYLE ================== */
const styles = {
  header: {
  position: "absolute",
  top: 50,
  textAlign: "center",
  },

title: {
  fontSize: 60,
  fontWeight: "bold",
  color: "#ffffff",
  letterSpacing: 2,
  marginBottom: 6,
  textShadow: "0 4px 10px rgba(0,0,0,0.3)",
  },

subTitle: {
  fontSize: 60,          // TO HƠN "BỘ Y TẾ"
  fontWeight: "bold",
  color: "#f1f1f1",
  letterSpacing: 1.5,
  textShadow: "0 4px 12px rgba(0,0,0,0.35)",
  },

  wrapper: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
  },
  card: {
    background: "#fff",
    padding: 40,
    borderRadius: 12,
    width: 420,
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    textAlign: "center",
  },
  button: {
    width: "100%",
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#667eea",
    color: "#fff",
  },
  enterButton: {
    marginTop: 20,
    width: "100%",
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    background: "#2ecc71",
    color: "#fff",
  },
  info: {
    marginTop: 20,
    textAlign: "left",
    fontSize: 14,
    background: "#f5f5f5",
    padding: 10,
    borderRadius: 6,
  },
};