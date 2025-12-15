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

  // doctor (register / unregister)
  const [doctorAddr, setDoctorAddr] = useState("");

  // grant / revoke
  const [grantTokenId, setGrantTokenId] = useState("");
  const [grantDoctorAddr, setGrantDoctorAddr] = useState("");

  // burn (hospital)
  const [burnTokenId, setBurnTokenId] = useState("");

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
        method: "eth_requestAccounts",
      });
      setAccount(accs[0]);
    }
    init();
  }, []);

  function isEth(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
  }

  // =============================
  // UPLOAD FILE
  // =============================
  async function uploadToIPFS() {
    if (!uploadFile) return alert("Chọn file trước");

    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", uploadFile);

      const res = await fetch("http://localhost:8000/ipfs/upload", {
        method: "POST",
        body: fd,
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
  // MINT RECORD
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
  // REGISTER / UNREGISTER DOCTOR
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
  // GRANT / REVOKE WRITE
  // =============================
  async function grantWrite() {
    if (!grantTokenId || !isEth(grantDoctorAddr))
      return alert("Thiếu tokenId hoặc doctor");

    try {
      setLoading(true);
      const { contract } = await loadContract();
      const tx = await contract.hospital_grant_write(
        Number(grantTokenId),
        grantDoctorAddr
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
    if (!grantTokenId || !isEth(grantDoctorAddr))
      return alert("Thiếu tokenId hoặc doctor");

    try {
      setLoading(true);
      const { contract } = await loadContract();
      const tx = await contract.hospital_revoke_write(
        Number(grantTokenId),
        grantDoctorAddr
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
  // BURN RECORD (HOSPITAL)
  // =============================
  async function burnRecordByHospital() {
    if (!burnTokenId)
      return alert("Vui lòng nhập tokenId cần hủy");

    const confirmBurn = window.confirm(
      `CẢNH BÁO!\n\nBạn sắp HỦY VĨNH VIỄN hồ sơ bệnh án tokenId = ${burnTokenId}.\nThao tác này KHÔNG THỂ hoàn tác.\n\nBạn có chắc chắn không?`
    );
    if (!confirmBurn) return;

    try {
      setLoading(true);
      const { contract } = await loadContract();

      const tx = await contract.burn(
        Number(burnTokenId)
      );

      setTxHash(tx.hash);
      await tx.wait();
      alert("Burn hồ sơ bệnh án thành công");
    } catch (e) {
      console.error(e);
      alert(e.info?.error?.message || e.message);
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
        <div style={styles.header}>
          <h2 style={styles.title}>Trang Bệnh viện</h2>
          <p style={styles.subtitle}>
            Ví đã kết nối:
            <span style={styles.address}>{account}</span>
          </p>
        </div>

        <div style={styles.grid}>
          {/* UPLOAD */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Tải lên file hồ sơ</h3>
            <label style={styles.fileLabel}>
              📎 Chọn file hồ sơ
              <input
                type="file"
                style={styles.hiddenFileInput}
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
            </label>

            {uploadFile && (
              <div style={styles.fileName}>{uploadFile.name}</div>
            )}

            <button
              style={styles.primaryBtn1}
              onClick={uploadToIPFS}
              disabled={loading}
            >
              Tải file lên
            </button>

            <input
              style={styles.input}
              placeholder="CID (IPFS Hash)"
              value={cid}
              onChange={(e) => setCid(e.target.value)}
            />
          </section>

          {/* MINT */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Tạo hồ sơ bệnh án</h3>
            <input
              style={styles.input1}
              placeholder="Mã hồ sơ (Token ID)"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
            />
            <input
              style={styles.input2}
              placeholder="Địa chỉ ví của Bệnh nhân"
              value={patientAddr}
              onChange={(e) => setPatientAddr(e.target.value)}
            />
            <button
              style={styles.successBtn}
              onClick={mintRecord}
              disabled={loading}
            >
              Tạo hồ sơ bệnh án
            </button>
          </section>

          {/* DOCTOR */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Đăng ký / Hủy đăng ký Bác sĩ</h3>
            <input
              style={styles.input}
              placeholder="Địa chỉ ví của Bác sĩ"
              value={doctorAddr}
              onChange={(e) => setDoctorAddr(e.target.value)}
            />
            <div style={styles.row}>
              <button
                style={styles.primaryBtn}
                onClick={registerDoctor}
                disabled={loading}
              >
                Đăng ký
              </button>
              <button
                style={styles.grayBtn}
                onClick={unregisterDoctor}
                disabled={loading}
              >
                Hủy đăng ký
              </button>
            </div>
          </section>

          {/* GRANT */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>
              Cấp / Thu hồi quyền thao tác cho Bác sĩ
            </h3>
            <input
              style={styles.input}
              placeholder="Mã hồ sơ (Token ID)"
              value={grantTokenId}
              onChange={(e) => setGrantTokenId(e.target.value)}
            />
            <input
              style={styles.input2}
              placeholder="Địa chỉ ví của Bác sĩ"
              value={grantDoctorAddr}
              onChange={(e) => setGrantDoctorAddr(e.target.value)}
            />
            <div style={styles.row}>
              <button
                style={styles.warnBtn}
                onClick={grantWrite}
                disabled={loading}
              >
                Cấp quyền
              </button>
              <button
                style={styles.dangerBtn}
                onClick={revokeWrite}
                disabled={loading}
              >
                Thu hồi quyền
              </button>
            </div>
          </section>

          {/* BURN */}
          <section style={styles.card}>
            <h3 style={styles.cardTitle}>Hủy hồ sơ bệnh án</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
              Chú ý: Chỉ sử dụng trong trường hợp đặc biệt!
            
            </p>
            <input
              style={styles.input}
              placeholder="Mã hồ sơ (Token ID)"
              value={burnTokenId}
              onChange={(e) => setBurnTokenId(e.target.value)}
            />
            <button
              style={styles.dangerBtn}
              onClick={burnRecordByHospital}
              disabled={loading}
            >
              Hủy hồ sơ bệnh án
            </button>
          </section>
        </div>

        {txHash && (
          <div style={styles.txBox}>
            <b>Last Transaction:</b>
            <div style={styles.tx}>{txHash}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== STYLES ================== */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef2f7, #dbe3f0)",
    padding: 40,
    fontFamily: "Segoe UI, Roboto, sans-serif",
  },
  container: { maxWidth: 1100, margin: "0 auto" },
  header: { marginBottom: 30 },
  title: { fontSize: 40, fontWeight: "bold", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#4b5563" },
  address: { marginLeft: 6, wordBreak: "break-all" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  },
  cardTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  input: {
    width: "95%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    marginBottom: 14,
    marginTop: 14
  },
  input1: {
    width: "95%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    marginBottom: 10,
    marginTop: 10
  },
  input2: {
    width: "95%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    marginBottom: 17,
    marginTop: 10
  },
  row: { display: "flex", gap: 12 },
  primaryBtn: {
    flex: 1,
    padding: "10px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
  },
  primaryBtn1: {
    flex: 1,
    padding: "10px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    marginLeft: 8
  },
  successBtn: {
    width: "100%",
    padding: "10px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
  },
  grayBtn: {
    flex: 1,
    padding: "10px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 10,
  },
  warnBtn: {
    flex: 1,
    padding: "10px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
  },
  dangerBtn: {
    flex: 1,
    padding: "10px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 10,
  },
  txBox: {
    marginTop: 30,
    background: "#fff",
    padding: 16,
    borderRadius: 12,
  },
  tx: { fontSize: 13, wordBreak: "break-all" },
  fileLabel: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 10,
    background: "#f1f5f9",
    border: "1px dashed #94a3b8",
    cursor: "pointer",
  },
  hiddenFileInput: { display: "none" },
  fileName: { fontSize: 13, marginTop: 8 },
};
