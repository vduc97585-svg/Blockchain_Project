from fastapi import APIRouter, HTTPException
from app.models.ehr_models import DoctorRegisterIn
from app.services.blockchain import contract, send_tx, Web3

router = APIRouter(prefix="/doctor", tags=["doctor"])


@router.post("/register")
def register_doctor(data: DoctorRegisterIn):
    try:
        doctor = Web3.to_checksum_address(data.doctor_address)
        tx = send_tx(contract.functions.register_doctor(doctor), data.signer_private_key)
        return {"status": "submitted", "tx_hash": tx}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unregister")
def unregister_doctor(data: DoctorRegisterIn):
    try:
        doctor = Web3.to_checksum_address(data.doctor_address)
        tx = send_tx(contract.functions.unregister_doctor(doctor), data.signer_private_key)
        return {"status": "submitted", "tx_hash": tx}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
