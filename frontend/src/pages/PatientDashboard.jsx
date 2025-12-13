import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import CONTRACT_ABI from "../contract/abi.json";
import { CONTRACT_ADDRESS } from "../web3";

const BACKEND = "http://localhost:8000";

export default function PatientDashboard() {
  const [account, setAccount] = useState("");
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hospitalAddr, setHospitalAddr] = useState("");

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
  // LOAD TOKENS CỦA PATIENT
  // =============================
  async function loadTokens(addr) {
    try {
      const res = await axios.get(
        `${BACKEND}/record/patient/${addr}`
      );
      setTokens(res.data.records || []);
    } catch (e) {
      console.error(e);
      alert("Không load được record");
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
  // DOWNLOAD FILE (SERVER DECRYPT)
  // =============================
  async function downloadFile(cid) {
    try {
      const res = await fetch(`${BACKEND}/ipfs/cat/${cid}`);
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      window.open(url);
    } catch (e) {
      console.error(e);
      alert("Download thất bại");
    }
  }

  // =============================
  // EXECUTE TX
  // =============================
  async function executeTx(cb) {
    try {
      setLoading(true);
      setTxStatus("Submitting...");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await cb(contract);
      setTxHash(tx.hash);
      setTxStatus("Pending...");
      await tx.wait();

      setTxStatus("Mined");
    } catch (e) {
      console.error(e);
      alert("Transaction lỗi");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // DELEGATE / REVOKE HOSPITAL
  // =============================
  function delegateHospital() {
    if (!selectedToken || !hospitalAddr)
      return alert("Thiếu token hoặc hospital");

    executeTx((c) =>
      c.delegate_hospital(
        selectedToken.tokenId,
        hospitalAddr
      )
    );
  }

  function revokeHospital() {
    if (!selectedToken || !hospitalAddr)
      return alert("Thiếu token hoặc hospital");

    executeTx((c) =>
      c.revoke_hospital_delegate(
        selectedToken.tokenId,
        hospitalAddr
      )
    );
  }

  // =============================
  // UI
  // =============================
  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-2">
        Patient Dashboard
      </h2>
      <p className="mb-4">Connected: {account}</p>

      <h3 className="font-semibold mb-2">
        Your Records ({tokens.length})
      </h3>

      <ul className="mb-4">
        {tokens.map((t) => (
          <li key={t.tokenId}>
            <button
              className="text-blue-600 underline"
              onClick={() => loadEntries(t)}
            >
              Token #{t.tokenId}
            </button>
          </li>
        ))}
      </ul>

      {selectedToken && (
        <>
          {/* MAIN RECORD */}
          <section className="border p-4 rounded mb-6">
            <h4 className="font-semibold mb-2">
              Medical Record
            </h4>
            <button
              className="text-green-600 underline"
              onClick={() =>
                downloadFile(selectedToken.cid)
              }
            >
              Download Record
            </button>
          </section>

          {/* ENTRIES */}
          <section className="border p-4 rounded mb-6">
            <h4 className="font-semibold mb-2">
              Entries ({entries.length})
            </h4>

            {entries.length === 0 && (
              <p>No entries yet</p>
            )}

            <ul>
              {entries.map((e, i) => (
                <li
                  key={i}
                  className="border p-2 mb-2 rounded"
                >
                  <p>Author: {e.author}</p>
                  <p>CID: {e.cid}</p>

                  <button
                    className="text-green-600 underline"
                    onClick={() =>
                      downloadFile(e.cid)
                    }
                  >
                    Download Entry
                  </button>

                  <p className="text-sm text-gray-500">
                    {new Date(
                      e.timestamp * 1000
                    ).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* DELEGATE */}
          <section className="border p-4 rounded">
            <h4 className="font-semibold mb-2">
              Delegate Hospital
            </h4>

            <input
              className="border p-2 w-full mb-2"
              placeholder="Hospital address (0x...)"
              value={hospitalAddr}
              onChange={(e) =>
                setHospitalAddr(e.target.value)
              }
            />

            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-amber-600 text-white rounded"
                onClick={delegateHospital}
                disabled={loading}
              >
                Delegate
              </button>
              <button
                className="px-3 py-1 bg-red-600 text-white rounded"
                onClick={revokeHospital}
                disabled={loading}
              >
                Revoke
              </button>
            </div>
          </section>
        </>
      )}

      {txHash && (
        <div className="mt-4 text-sm break-all">
          <p>TX: {txHash}</p>
          <p>Status: {txStatus}</p>
        </div>
      )}
    </div>
  );
}
