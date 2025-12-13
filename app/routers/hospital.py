from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.contracts.contract import contract, web3, ACCOUNT_ADDRESS, PRIVATE_KEY

router = APIRouter(prefix="/hospital", tags=["hospital"])

class HospitalRegister(BaseModel):
    hospital: str   # địa chỉ hospital muốn đăng ký

@router.get("/tx_status/{tx_hash}")
def tx_status(tx_hash: str):
    receipt = web3.eth.get_transaction_receipt(tx_hash)
    if receipt is None:
        return {"status": "pending"}
    return {"status": "mined", "blockNumber": receipt.blockNumber}

@router.post("/register")
def register_hospital(body: HospitalRegister):
    try:
        hospital_addr = web3.to_checksum_address(body.hospital)

        # lấy nonce bao gồm cả tx đang pending
        nonce = web3.eth.get_transaction_count(ACCOUNT_ADDRESS, 'pending')

        # build tx với gasPrice hiện tại của mạng
        tx = contract.functions.register_hospital(hospital_addr).build_transaction({
            "from": ACCOUNT_ADDRESS,
            "nonce": nonce,
            "gas": 300000,
            "gasPrice": web3.eth.gas_price,  # auto đủ cao
        })

        # sign
        signed = web3.eth.account.sign_transaction(tx, PRIVATE_KEY)

        # send
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)

        return {
            "status": "submitted",
            "tx_hash": tx_hash.hex(),
            "hospital": hospital_addr
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UnregisterHospitalIn(BaseModel):
    hospital_address: str
    signer_private_key: str

@router.post("/unregister")
def unregister_hospital(data: UnregisterHospitalIn):
    try:
        account = web3.eth.account.from_key(data.signer_private_key)

        # convert address to checksum
        hospital_addr = web3.to_checksum_address(data.hospital_address)

        tx = contract.functions.unregister_hospital(
            hospital_addr
        ).build_transaction({
            "from": account.address,
            "nonce": web3.eth.get_transaction_count(account.address),
            "gas": 300000,
            "gasPrice": web3.eth.gas_price
        })

        signed_tx = web3.eth.account.sign_transaction(tx, data.signer_private_key)
        tx_hash = web3.eth.send_raw_transaction(signed_tx.raw_transaction)

        return {
            "status": "submitted",
            "tx_hash": tx_hash.hex(),
            "unregistered": hospital_addr
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
