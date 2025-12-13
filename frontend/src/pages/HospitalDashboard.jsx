import React, { useEffect, useState } from "react";
import { loadContract } from "../web3";

export default function HospitalDashboard() {
  const [account, setAccount] = useState("");

  // upload
  const [uploadFile, setUploadFile] = useState(null);
  const [cid, setCid] = useState("");

  // mint
  const [tokenId, setTokenId] = useState("");
  const [patientAddr, setPatientAddr] = useState("");

  // doctor
  const [doctorAddr, setDoctorAddr] = useState("");
  const [grantTokenId, setGrantTokenId] = useState("");

  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);

  // =============================
  // METAMASK
  // =============================
  useEffect(() => {
    async function init() {
      if (!window.ethereum) {
        alert("MetaMask chưa cài");
        return;
      }
      const accs = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      setAccount(accs[0]);
    }
    init();
  }, []);

  function isEth(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
  }

  // =============================
  // 📤 UPLOAD FILE (SERVER HANDLE CRYPTO)
  // =============================
  async function uploadToIPFS() {
    if (!uploadFile) return alert("Chọn file trước");

    try {
      setLoading(true);

      const fd = new FormData();
      fd.append("file", uploadFile);

      const res = await fetch("http://localhost:8000/ipfs/upload", {
        method: "POST",
        body: fd
      });

      const data = await res.json();
      setCid(data.cid);

      alert("Uploaded file\nCID: " + data.cid);
    } catch (e) {
      console.error(e);
      alert("Upload lỗi");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // 🏥 MINT RECORD
  // =============================
  async function mintRecord() {
    if (!tokenId || !patientAddr || !cid)
      return alert("Thiếu tokenId / patient / cid");
    if (!isEth(patientAddr))
      return alert("Patient address không hợp lệ");

    try {
      setLoading(true);
      const { contract } = await loadContract();

      const tx = await contract.mint_record(
        Number(tokenId),
        patientAddr,
        cid
      );

      setTxHash(tx.hash);
      await tx.wait();
      alert("Mint record thành công");
    } catch (e) {
      console.error(e);
      alert(e.info?.error?.message || e.message);
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // 👨‍⚕️ REGISTER / UNREGISTER DOCTOR
  // =============================
  async function registerDoctor() {
    if (!isEth(doctorAddr))
      return alert("Doctor address không hợp lệ");

    try {
      setLoading(true);
      const { contract } = await loadContract();
      const tx = await contract.register_doctor(doctorAddr);
      setTxHash(tx.hash);
      await tx.wait();
      alert("Đã register doctor");
    } catch (e) {
      console.error(e);
      alert("Register lỗi");
    } finally {
      setLoading(false);
    }
  }

  async function unregisterDoctor() {
    if (!isEth(doctorAddr))
      return alert("Doctor address không hợp lệ");

    try {
      setLoading(true);
      const { contract } = await loadContract();
      const tx = await contract.unregister_doctor(doctorAddr);
      setTxHash(tx.hash);
      await tx.wait();
      alert("Đã unregister doctor");
    } catch (e) {
      console.error(e);
      alert("Unregister lỗi");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // ✍️ GRANT / REVOKE WRITE
  // =============================
  async function grantWrite() {
    if (!grantTokenId || !isEth(doctorAddr))
      return alert("Thiếu tokenId hoặc doctor");

    try {
      setLoading(true);
      const { contract } = await loadContract();
      const tx = await contract.hospital_grant_write(
        Number(grantTokenId),
        doctorAddr
      );
      setTxHash(tx.hash);
      await tx.wait();
      alert("Grant write thành công");
    } catch (e) {
      console.error(e);
      alert("Grant lỗi");
    } finally {
      setLoading(false);
    }
  }

  async function revokeWrite() {
    if (!grantTokenId || !isEth(doctorAddr))
      return alert("Thiếu tokenId hoặc doctor");

    try {
      setLoading(true);
      const { contract } = await loadContract();
      const tx = await contract.hospital_revoke_write(
        Number(grantTokenId),
        doctorAddr
      );
      setTxHash(tx.hash);
      await tx.wait();
      alert("Revoke write thành công");
    } catch (e) {
      console.error(e);
      alert("Revoke lỗi");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // UI
  // =============================
  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">Hospital Dashboard</h2>
      <p className="mb-4">Connected: {account}</p>

      {/* UPLOAD */}
      <section className="border p-4 rounded mb-6">
        <h3 className="font-semibold mb-2">Upload Medical File</h3>
        <input
          type="file"
          onChange={(e) => setUploadFile(e.target.files[0])}
        />
        <button
          className="ml-2 px-3 py-1 bg-sky-600 text-white rounded"
          onClick={uploadToIPFS}
          disabled={loading}
        >
          Upload
        </button>

        <input
          className="border p-2 w-full mt-3"
          placeholder="CID"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
        />
      </section>

      {/* MINT */}
      <section className="border p-4 rounded mb-6">
        <h3 className="font-semibold mb-2">Mint Record</h3>
        <input
          className="border p-2 w-full mb-2"
          placeholder="Token ID"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
        />
        <input
          className="border p-2 w-full mb-2"
          placeholder="Patient address"
          value={patientAddr}
          onChange={(e) => setPatientAddr(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={mintRecord}
          disabled={loading}
        >
          Mint
        </button>
      </section>

      {/* DOCTOR */}
      <section className="border p-4 rounded mb-6">
        <h3 className="font-semibold mb-2">Doctor Management</h3>
        <input
          className="border p-2 w-full mb-2"
          placeholder="Doctor address"
          value={doctorAddr}
          onChange={(e) => setDoctorAddr(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-indigo-600 text-white rounded"
            onClick={registerDoctor}
            disabled={loading}
          >
            Register
          </button>
          <button
            className="px-3 py-1 bg-gray-600 text-white rounded"
            onClick={unregisterDoctor}
            disabled={loading}
          >
            Unregister
          </button>
        </div>
      </section>

      {/* GRANT */}
      <section className="border p-4 rounded">
        <h3 className="font-semibold mb-2">Grant / Revoke Write</h3>
        <input
          className="border p-2 w-full mb-2"
          placeholder="Token ID"
          value={grantTokenId}
          onChange={(e) => setGrantTokenId(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-amber-600 text-white rounded"
            onClick={grantWrite}
            disabled={loading}
          >
            Grant
          </button>
          <button
            className="px-3 py-1 bg-red-600 text-white rounded"
            onClick={revokeWrite}
            disabled={loading}
          >
            Revoke
          </button>
        </div>
      </section>

      {txHash && (
        <p className="mt-4 text-sm break-all">
          Last TX: {txHash}
        </p>
      )}
    </div>
  );
}
