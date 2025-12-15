from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from app.services.blockchain import contract, send_tx, Web3

OWNER_PRIVATE_KEY = os.getenv("PRIVATE_KEY")
router = APIRouter(prefix="/doctor", tags=["doctor"])

# --- Input model ---
class DoctorRegisterIn(BaseModel):
    doctor_address: str

# --- Register doctor ---
@router.post("/register")
def register_doctor(data: DoctorRegisterIn):
    try:
        # Validate & checksum address
        try:
            doctor = Web3.to_checksum_address(data.doctor_address.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Ethereum address")

        # Send tx with backend owner's private key
        tx_hash = send_tx(contract.functions.register_doctor(doctor), OWNER_PRIVATE_KEY)
        return {"status": "submitted", "tx_hash": tx_hash}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Unregister doctor ---
@router.post("/unregister")
def unregister_doctor(data: DoctorRegisterIn):
    try:
        try:
            doctor = Web3.to_checksum_address(data.doctor_address.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Ethereum address")

        tx_hash = send_tx(contract.functions.unregister_doctor(doctor), OWNER_PRIVATE_KEY)
        return {"status": "submitted", "tx_hash": tx_hash}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/{doctor}/tokens")
def get_doctor_tokens(doctor: str):
    doctor = Web3.to_checksum_address(doctor)
    tokens = []

    token_counter = contract.functions.token_counter().call()

    for token_id in range(1, token_counter + 1):

        # === 1. TOKEN CÒN SỐNG? ===
        try:
            patient_addr = contract.functions.ownerOf(token_id).call()
        except Exception:
            # token đã burn
            continue

        # === 2. DOCTOR CÓ QUYỀN WRITE? ===
        if not contract.functions.can_write(token_id, doctor).call():
            continue

        cid = contract.functions.token_cid(token_id).call()

        tokens.append({
            "tokenId": token_id,
            "cid": cid,
            "patient": patient_addr,
        })

    return {"tokens": tokens}





