import os
import json
from pathlib import Path
from web3 import Web3
from web3.exceptions import ContractLogicError

# ---------------------------------------------------
# Resolve absolute paths
# ---------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ABI_PATH = BASE_DIR / "abi" / "EHRRegistry.json"

# Load environment variables
RPC_URL = os.getenv("RPC_URL")
PRIVATE_KEY = os.getenv("PRIVATE_KEY")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

if not RPC_URL or not PRIVATE_KEY or not CONTRACT_ADDRESS:
    raise RuntimeError("Missing environment variables")

# Web3 init
web3 = Web3(Web3.HTTPProvider(RPC_URL))
ACCOUNT = web3.eth.account.from_key(PRIVATE_KEY)
ACCOUNT_ADDRESS = ACCOUNT.address

# Debug info
print(" Contract loaded:", CONTRACT_ADDRESS)
print(" Using account:", ACCOUNT_ADDRESS)
print(" ABI path:", str(ABI_PATH))

# ---------------------------------------------------
# Load ABI from absolute path
# ---------------------------------------------------
if not ABI_PATH.exists():
    raise FileNotFoundError(f"ABI file not found at {ABI_PATH}")

with open(ABI_PATH, "r") as f:
    raw = json.load(f)
ABI = raw["abi"]

# Contract
contract = web3.eth.contract(
    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
    abi=ABI
)

# ---------------------------------------------------
# Helper functions
# ---------------------------------------------------
def get_nonce(address: str):
    return web3.eth.get_transaction_count(Web3.to_checksum_address(address))


def simulate_tx(tx):
    try:
        web3.eth.call(tx, block_identifier="latest")
    except ContractLogicError as e:
        raise ContractLogicError(f"Reverted: {e}")


def send_tx(func, signer_pk=PRIVATE_KEY):
    signer = web3.eth.account.from_key(signer_pk)
    signer_address = signer.address

    tx = func.build_transaction({
        "from": signer_address,
        "nonce": get_nonce(signer_address),
        "gas": 300000,
        "gasPrice": web3.eth.gas_price,
    })

    simulate_tx(tx)

    signed = web3.eth.account.sign_transaction(tx, signer_pk)
    tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
    return "0x" + tx_hash.hex()
