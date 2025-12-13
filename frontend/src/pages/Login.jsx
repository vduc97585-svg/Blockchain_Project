import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadContract, rpcProvider, CONTRACT_ADDRESS } from "../web3";

export default function Login({ setRole }) {
  const [address, setAddress] = useState("");
  const navigate = useNavigate();

  async function handleLogin() {
    try {
      if (!window.ethereum) {
        alert("MetaMask không được cài đặt!");
        return;
      }

      // 1️⃣ Mở popup MetaMask để user connect
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const user = accounts[0];
      setAddress(user);
      console.log("Logged in:", user);

      // 2️⃣ Tự động chuyển sang Sepolia (chainId 11155111)
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xAA36A7" }] // 11155111 hex
        });
      } catch (switchError) {
        // Nếu chưa có Sepolia, yêu cầu add mạng
        if (switchError.code === 4902) {
          alert("Vui lòng thêm mạng Sepolia vào MetaMask!");
        } else {
          console.error("Switch network error:", switchError);
        }
      }

      // 3️⃣ Load contract
      const { contract, signer } = await loadContract();
      if (!contract || !signer) throw new Error("Không load được contract");

      console.log("Contract address:", CONTRACT_ADDRESS);

      // 4️⃣ Kiểm tra bytecode trên Sepolia
      const code = await rpcProvider.getCode(CONTRACT_ADDRESS);
      if (code === "0x") {
        alert("Contract không tồn tại hoặc deploy sai network!");
        return;
      }
      console.log("Bytecode (Infura):", code);

      // 5️⃣ Kiểm tra owner()
      try {
        const owner = await contract.owner();
        console.log("Owner:", owner);
      } catch (err) {
        console.error("Lỗi owner():", err);
      }

      // 6️⃣ Lấy role
      let role = "none";
      try {
        role = await contract.getRole(user);
        console.log("Role:", role);
      } catch (err) {
        console.error("Lỗi getRole():", err);
      }

      // 7️⃣ Điều hướng theo role
      switch (role) {
        case "contract_owner": setRole("admin"); navigate("/admin"); break;
        case "hospital": setRole("hospital"); navigate("/hospital"); break;
        case "doctor": setRole("doctor"); navigate("/doctor"); break;
        case "patient": setRole("patient"); navigate("/patient"); break;
        default:
          alert("Không tìm thấy vai trò!");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Lỗi đăng nhập, kiểm tra console");
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Đăng nhập bằng MetaMask</h2>
      <button onClick={handleLogin}>Connect Wallet</button>
      <p>{address}</p>
    </div>
  );
}
