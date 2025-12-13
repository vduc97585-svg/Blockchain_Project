// src/pages/HospitalDashboard.jsx
import React, { useState } from "react";
import { BrowserProvider } from "ethers"; // ethers v6
import { loadContract } from "../web3";

export default function HospitalDashboard() {
  const [tokenId, setTokenId] = useState("");
  const [patientAddr, setPatientAddr] = useState("");
  const [cid, setCid] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [tx, setTx] = useState(null);

  const [doctorAddr, setDoctorAddr] = useState("");
  const [grantTokenId, setGrantTokenId] = useState("");

  function isValidEthAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  }

  // Upload file to backend → Pinata
  async function handleUploadToIPFS() {
    if (!uploadFile) return alert("Chọn file trước");

    const fd = new FormData();
    fd.append("file", uploadFile);

    try {
      const res = await fetch("http://localhost:8000/ipfs/upload", {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      setCid(data.cid);
      alert("Uploaded: " + data.cid);
    } catch (err) {
      console.error(err);
      alert("Upload error: " + err.message);
    }
  }

  // ----------------- SMART CONTRACT CALLS -----------------

  // ✅ Hospital chỉ được mint record
  async function mintRecord() {
    if (!tokenId || !patientAddr || !cid)
      return alert("tokenId, patient, cid required");
    if (!isValidEthAddress(patientAddr))
      return alert("Invalid patient address");

    try {
      const { contract } = await loadContract();
      const txResp = await contract.mint_record(
        Number(tokenId),
        patientAddr,
        cid
      );
      setTx(txResp.hash);
      alert("Mint sent: " + txResp.hash);
      await txResp.wait();
      alert("Record minted!");
    } catch (err) {
      console.error(err);
      alert("Mint error: " + (err.info?.error?.message || err.message));
    }
  }

  async function registerDoctor() {
    if (!doctorAddr)
      return alert("Doctor address required");
    if (!isValidEthAddress(doctorAddr))
      return alert("Invalid doctor address");

    try {
      const { contract } = await loadContract();
      const txResp = await contract.register_doctor(doctorAddr);
      setTx(txResp.hash);
      alert("Sent: " + txResp.hash);
      await txResp.wait();
      alert("Doctor registered!");
    } catch (err) {
      console.error(err);
      alert("Register error: " + (err.info?.error?.message || err.message));
    }
  }

  async function unregisterDoctor() {
    if (!doctorAddr)
      return alert("Doctor address required");
    if (!isValidEthAddress(doctorAddr))
      return alert("Invalid doctor address");

    try {
      const { contract } = await loadContract();
      const txResp = await contract.unregister_doctor(doctorAddr);
      setTx(txResp.hash);
      alert("Sent: " + txResp.hash);
      await txResp.wait();
      alert("Doctor unregistered!");
    } catch (err) {
      console.error(err);
      alert("Unregister error: " + (err.info?.error?.message || err.message));
    }
  }

  async function grantDoctor() {
    if (!grantTokenId || !doctorAddr)
      return alert("TokenId + doctor address required");
    if (!isValidEthAddress(doctorAddr))
      return alert("Invalid doctor address");

    try {
      const { contract } = await loadContract();
      const txResp = await contract.hospital_grant_write(
        Number(grantTokenId),
        doctorAddr
      );
      setTx(txResp.hash);
      alert("Sent: " + txResp.hash);
      await txResp.wait();
      alert("Doctor granted write!");
    } catch (err) {
      console.error(err);
      alert("Grant error: " + (err.info?.error?.message || err.message));
    }
  }

  async function revokeDoctor() {
    if (!grantTokenId || !doctorAddr)
      return alert("TokenId + doctor address required");
    if (!isValidEthAddress(doctorAddr))
      return alert("Invalid doctor address");

    try {
      const { contract } = await loadContract();
      const txResp = await contract.hospital_revoke_write(
        Number(grantTokenId),
        doctorAddr
      );
      setTx(txResp.hash);
      alert("Sent: " + txResp.hash);
      await txResp.wait();
      alert("Doctor revoked!");
    } catch (err) {
      console.error(err);
      alert("Revoke error: " + (err.info?.error?.message || err.message));
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-3">Hospital Dashboard</h2>

      {/* File Upload */}
      <section className="mb-6 border p-4 rounded">
        <h3 className="font-semibold mb-2">Upload file to IPFS</h3>
        <input
          type="file"
          onChange={(e) => setUploadFile(e.target.files?.[0])}
        />
        <button
          className="ml-2 mt-2 px-3 py-1 bg-sky-600 text-white rounded"
          onClick={handleUploadToIPFS}
        >
          Upload
        </button>

        <div className="mt-2">
          <label className="block">CID</label>
          <input
            className="border p-2 w-full"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder="CID from Pinata"
          />
        </div>
      </section>

      {/* Mint Record */}
      <section className="mb-6 border p-4 rounded">
        <h3 className="font-semibold mb-2">Mint Record</h3>

        <input
          className="border p-2 w-full mb-2"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="Token ID"
        />

        <input
          className="border p-2 w-full mb-2"
          value={patientAddr}
          onChange={(e) => setPatientAddr(e.target.value)}
          placeholder="Patient address (0x...)"
        />

        <input
          className="border p-2 w-full mb-2"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          placeholder="CID"
        />

        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={mintRecord}
        >
          Mint Record
        </button>
      </section>

      {/* Doctor Management */}
      <section className="mb-6 border p-4 rounded">
        <h3 className="font-semibold mb-2">Doctor Management</h3>

        <input
          className="border p-2 w-full mb-2"
          value={doctorAddr}
          onChange={(e) => setDoctorAddr(e.target.value)}
          placeholder="Doctor address (0x...)"
        />

        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-amber-600 text-white rounded"
            onClick={registerDoctor}
          >
            Register Doctor
          </button>

          <button
            className="px-4 py-2 bg-red-600 text-white rounded"
            onClick={unregisterDoctor}
          >
            Unregister Doctor
          </button>
        </div>
      </section>

      {/* Grant / Revoke Write */}
      <section className="mb-6 border p-4 rounded">
        <h3 className="font-semibold mb-2">Grant / Revoke Doctor Write</h3>

        <input
          className="border p-2 w-full mb-2"
          value={grantTokenId}
          onChange={(e) => setGrantTokenId(e.target.value)}
          placeholder="Token ID"
        />

        <input
          className="border p-2 w-full mb-2"
          value={doctorAddr}
          onChange={(e) => setDoctorAddr(e.target.value)}
          placeholder="Doctor address (0x...)"
        />

        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-amber-600 text-white rounded"
            onClick={grantDoctor}
          >
            Grant Write
          </button>

          <button
            className="px-4 py-2 bg-red-600 text-white rounded"
            onClick={revokeDoctor}
          >
            Revoke Write
          </button>
        </div>
      </section>

      {tx && <p className="mt-4">Last tx: {tx}</p>}
    </div>
  );
}
