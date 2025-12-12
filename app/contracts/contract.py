from web3 import Web3
import json
import os
from dotenv import load_dotenv

load_dotenv()

# --- Load environment variables ---
RPC_URL = os.getenv("RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")
ACCOUNT_ADDRESS = os.getenv("ACCOUNT_ADDRESS")     # owner hoặc hospital
PRIVATE_KEY = os.getenv("PRIVATE_KEY")             # private key tương ứng

# --- Kiểm tra biến môi trường ---
if not RPC_URL:
    raise Exception("RPC_URL không tồn tại trong .env")

if not CONTRACT_ADDRESS:
    raise Exception("CONTRACT_ADDRESS không tồn tại trong .env")

if not ACCOUNT_ADDRESS:
    raise Exception("ACCOUNT_ADDRESS không tồn tại trong .env")

if not PRIVATE_KEY:
    raise Exception("PRIVATE_KEY không tồn tại trong .env")

# --- Connect Web3 ---
web3 = Web3(Web3.HTTPProvider(RPC_URL))

if not web3.is_connected():
    raise Exception(" Không thể kết nối RPC. Kiểm tra RPC_URL trong .env")

# Convert address
try:
    checksum_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
except:
    raise Exception(" CONTRACT_ADDRESS không hợp lệ trong .env")

# Convert account
try:
    ACCOUNT_ADDRESS = Web3.to_checksum_address(ACCOUNT_ADDRESS)
except:
    raise Exception(" ACCOUNT_ADDRESS không hợp lệ trong .env")


# --- Load ABI ---
with open("abi/EHRRegistry.json", "r") as f:
    abi_data = json.load(f)
    ABI = abi_data["abi"]

# --- Create contract instance ---
contract = web3.eth.contract(
    address=checksum_address,
    abi=ABI
)

print(" Contract loaded:", checksum_address)
print(" Using account:", ACCOUNT_ADDRESS)
