import requests
import os

PINATA_JWT = os.getenv("PINATA_JWT")

print("DEBUG PINATA_JWT:", repr(PINATA_JWT))


PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"

def upload_file_to_pinata(file):
    if PINATA_JWT is None:
        raise Exception("Missing PINATA_JWT in environment variables")

    headers = {
        "Authorization": f"Bearer {PINATA_JWT}"
    }

    files = {
        "file": (file.filename, file.file, file.content_type)
    }

    response = requests.post(PINATA_UPLOAD_URL, headers=headers, files=files)

    if response.status_code != 200:
        raise Exception(f"Pinata upload failed: {response.text}")

    ipfs_hash = response.json().get("IpfsHash")
    return ipfs_hash
