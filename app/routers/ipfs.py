from fastapi import APIRouter, UploadFile, File, Response
import requests, json, io
from fastapi.responses import StreamingResponse
from app.crypto import encrypt_bytes, decrypt_bytes

router = APIRouter(prefix="/ipfs", tags=["IPFS"])
IPFS_API = "http://127.0.0.1:5001/api/v0"


@router.post("/upload")
async def upload_to_ipfs(file: UploadFile = File(...)):
    raw = await file.read()

    # 1. encrypt file
    encrypted = encrypt_bytes(raw)

    # 2. upload encrypted file
    r1 = requests.post(
        f"{IPFS_API}/add",
        files={"file": (file.filename + ".enc", encrypted)}
    )
    r1.raise_for_status()
    file_cid = r1.json()["Hash"]

    # 3. create metadata.json
    metadata = {
        "filename": file.filename,
        "mime": file.content_type,
        "encrypted": True,
        "fileCID": file_cid
    }

    meta_bytes = json.dumps(metadata).encode()

    # 4. upload metadata.json
    r2 = requests.post(
        f"{IPFS_API}/add",
        files={"file": ("metadata.json", meta_bytes)}
    )
    r2.raise_for_status()
    meta_cid = r2.json()["Hash"]

    # ⚠️ frontend vẫn nhận field "cid"
    return {
        "cid": meta_cid
    }
@router.get("/cat/{cid}")
def get_from_ipfs(cid: str):
    # 1. load metadata.json
    r_meta = requests.post(f"{IPFS_API}/cat?arg={cid}")
    if r_meta.status_code != 200:
        return Response(status_code=404)

    try:
        meta = json.loads(r_meta.content)
    except Exception:
        return Response(status_code=400, content="Invalid metadata")

    # 2. load encrypted file
    file_cid = meta["fileCID"]
    r_file = requests.post(f"{IPFS_API}/cat?arg={file_cid}")
    if r_file.status_code != 200:
        return Response(status_code=404)

    # 3. decrypt
    decrypted = decrypt_bytes(r_file.content)

    return StreamingResponse(
        io.BytesIO(decrypted),
        media_type=meta.get("mime", "application/octet-stream"),
        headers={
            "Content-Disposition":
                f'inline; filename="{meta.get("filename", "file")}"'
        }
    )
