# app/routers/record.py
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from eth_utils import event_abi_to_log_topic
from app.models.ehr_models import (
    MintIn,
    AddEntryIn,
    DelegateHospitalIn,
    RevokeHospitalIn,
    BurnIn, 
)
from app.services.blockchain import contract, send_tx, web3, Web3

router = APIRouter(prefix="/record", tags=["record"])


# -----------------------------
# Helpers: topic0 and decode logs
# -----------------------------
def _get_topic0(event_name: str):
    abi_event = next(
        (x for x in contract.abi if x.get("type") == "event" and x.get("name") == event_name),
        None,
    )
    if not abi_event:
        raise ValueError(f"Event {event_name} not found in ABI")
    return event_abi_to_log_topic(abi_event)


def _get_logs_by_event(event_name: str, from_block: int = 0, to_block: str = "latest"):
    topic0 = _get_topic0(event_name)
    logs = web3.eth.get_logs(
        {"fromBlock": from_block, "toBlock": to_block, "address": contract.address, "topics": [topic0]}
    )
    return logs


def _decode_event(event_name: str, log):
    """
    Use contract.events.<Event>().process_log to decode.
    """
    ev = getattr(contract.events, event_name)()
    return ev.process_log(log)


# -----------------------------------------
# GET record (Mint event) - canonical metadata
# -----------------------------------------
@router.get("/{tokenId}")
def get_record(tokenId: int):
    try:
        # ---------------------------------------
        # CHECK TỒN TẠI = ownerOf (contract chỉ có vậy)
        # ---------------------------------------
        try:
            owner = contract.functions.ownerOf(tokenId).call()
            exists = True
        except Exception:
            raise HTTPException(status_code=404, detail="Token does not exist")

        # ---------------------------------------
        # Lấy CID
        # ---------------------------------------
        try:
            cid = contract.functions.token_cid(tokenId).call()
        except Exception:
            cid = None

        # ---------------------------------------
        # Lấy steward
        # ---------------------------------------
        try:
            steward = contract.functions.get_steward(tokenId).call()
        except Exception:
            steward = None

        # ---------------------------------------
        # Lấy patient & createdAt từ Mint event
        # ---------------------------------------
        mint_logs = _get_logs_by_event("Mint")
        patient = None
        created_at = None

        for log in mint_logs:
            decoded = _decode_event("Mint", log)
            if int(decoded.args.tokenId) == int(tokenId):
                patient = decoded.args.patient
                blk = web3.eth.get_block(log.blockNumber)
                created_at = blk.timestamp
                break

        return {
            "tokenId": tokenId,
            "exists": exists,
            "cid": cid,
            "owner": owner,
            "steward": steward,
            "patient": patient,
            "createdAt": created_at,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------
# GET entries for a record (EntryAdded events)
# -----------------------------------------
@router.get("/{tokenId}/entries")
def get_record_entries(tokenId: int):
    try:
        logs = _get_logs_by_event("EntryAdded")
        entries = []
        for log in logs:
            decoded = _decode_event("EntryAdded", log)
            if int(decoded.args.tokenId) == int(tokenId):
                ts = None
                try:
                    blk = web3.eth.get_block(log.blockNumber)
                    ts = blk.timestamp
                except Exception:
                    ts = decoded.args.timestamp if hasattr(decoded.args, "timestamp") else None

                entries.append(
                    {
                        "author": decoded.args.author,
                        "cid": decoded.args.entryCid,
                        "timestamp": ts,
                        "blockNumber": log.blockNumber,
                        "logIndex": log.logIndex,
                    }
                )
        return {"tokenId": tokenId, "entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------
# GET records by patient (scan Mint event)
# -----------------------------------------
@router.get("/patient/{patientAddress}")
def get_patient_records(patientAddress: str):
    try:
        patient = Web3.to_checksum_address(patientAddress)
        logs = _get_logs_by_event("Mint")
        records = []
        for log in logs:
            decoded = _decode_event("Mint", log)
            if Web3.to_checksum_address(decoded.args.patient) == patient:
                records.append({"tokenId": int(decoded.args.tokenId), "cid": decoded.args.cid})
        return {"patient": patient, "records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------------------
# WRITE: mint_record (must be called by registered hospital)
# -----------------------------------------
@router.post("/mint")
def mint_record(data: MintIn):
    """
    Body: { tokenId, patient, cid, signer_private_key (optional) }
    signer_private_key: if provided, used to sign tx (use hospital key)
    Otherwise send_tx will use default PRIVATE_KEY from services.
    """
    try:
        patient = Web3.to_checksum_address(data.patient)
        signer_pk = data.signer_private_key
        func = contract.functions.mint_record(int(data.tokenId), patient, data.cid)
        tx_hash = send_tx(func, signer_pk)
        return {"status": "submitted", "tx_hash": tx_hash, "tokenId": data.tokenId}
    except Exception as e:
        # if revert, send_tx simulates and raises helpful message
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------------------
# WRITE: add_entry
# -----------------------------------------
@router.post("/add-entry")
def add_entry(data: AddEntryIn):
    try:
        signer_pk = data.signer_private_key
        func = contract.functions.add_entry(int(data.tokenId), data.cid)
        tx_hash = send_tx(func, signer_pk)
        return {"status": "submitted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------------------
# WRITE: delegate_hospital (patient delegates hospital)
# -----------------------------------------
@router.post("/delegate-hospital")
def delegate_hospital(data: DelegateHospitalIn):
    try:
        signer_pk = data.signer_private_key
        hosp = Web3.to_checksum_address(data.hospital)
        func = contract.functions.delegate_hospital(int(data.tokenId), hosp)
        tx_hash = send_tx(func, signer_pk)
        return {"status": "submitted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------------------
# WRITE: revoke_hospital_delegate
# -----------------------------------------
@router.post("/revoke-hospital")
def revoke_hospital(data: RevokeHospitalIn):
    try:
        signer_pk = data.signer_private_key
        hosp = Web3.to_checksum_address(data.hospital)
        func = contract.functions.revoke_hospital_delegate(int(data.tokenId), hosp)
        tx_hash = send_tx(func, signer_pk)
        return {"status": "submitted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -----------------------------------------
# WRITE: hospital grant/revoke doctor (hospital owner-only actions)
# -----------------------------------------
@router.post("/hospital/grant-doctor")
def hospital_grant_doctor(data: DelegateHospitalIn):
    try:
        signer_pk = data.signer_private_key
        doctor = Web3.to_checksum_address(data.hospital)  # reuse field name
        func = contract.functions.hospital_grant_write(int(data.tokenId), doctor)
        tx_hash = send_tx(func, signer_pk)
        return {"status": "submitted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/hospital/revoke-doctor")
def hospital_revoke_doctor(data: DelegateHospitalIn):
    try:
        signer_pk = data.signer_private_key
        doctor = Web3.to_checksum_address(data.hospital)  # reuse field name
        func = contract.functions.hospital_revoke_write(int(data.tokenId), doctor)
        tx_hash = send_tx(func, signer_pk)
        return {"status": "submitted", "tx_hash": tx_hash}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -----------------------------------------
# WRITE: burn (patient OR steward OR admin)
# -----------------------------------------
@router.post("/burn")
def burn_record(data: BurnIn):
    try:
        signer_pk = data.signer_private_key
        func = contract.functions.burn(int(data.tokenId))
        tx_hash = send_tx(func, signer_pk)
        return {
            "status": "submitted",
            "tx_hash": tx_hash,
            "tokenId": data.tokenId
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
