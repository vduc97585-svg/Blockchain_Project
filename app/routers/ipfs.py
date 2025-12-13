from fastapi import APIRouter, UploadFile, File
import requests

router = APIRouter(prefix="/ipfs", tags=["IPFS"])

IPFS_API = "http://127.0.0.1:5001/api/v0"

@router.post("/upload")
async def upload_to_ipfs(file: UploadFile = File(...)):
    files = {
        "file": (file.filename, await file.read())
    }

    r = requests.post(f"{IPFS_API}/add", files=files)
    r.raise_for_status()

    data = r.json()

    return {
        "cid": data["Hash"],   
        "name": data["Name"],
        "size": data["Size"]
    }


@router.get("/cat/{cid}")
def get_from_ipfs(cid: str):
    r = requests.post(f"{IPFS_API}/cat?arg={cid}")
    return r.text
