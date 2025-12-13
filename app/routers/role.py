from fastapi import APIRouter
from web3 import Web3
from contract import contract, web3

router = APIRouter(prefix="/role", tags=["Role"])

@router.get("/{address}")
def get_role(address: str):
    try:
        addr = Web3.to_checksum_address(address)
    except:
        return {"error": "invalid address"}

    # 1. admin?
    owner = contract.functions.owner().call()
    if addr.lower() == owner.lower():
        return {"role": "admin"}

    # 2. hospital?
    is_hospital = contract.functions.hospitals(addr).call()
    if is_hospital:
        return {"role": "hospital"}

    # 3. doctor?
    doctor_hospital = contract.functions.doctor_hospital(addr).call()
    if doctor_hospital != "0x0000000000000000000000000000000000000000":
        return {"role": "doctor"}

    # 4. default = patient
    return {"role": "patient"}
