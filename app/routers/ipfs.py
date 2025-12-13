from fastapi import APIRouter, UploadFile, File, Response
import requests

from app.crypto import encrypt_bytes, decrypt_bytes

router = APIRouter(prefix="/ipfs", tags=["IPFS"])

IPFS_API = "http://127.0.0.1:5001/api/v0"

# In-memory metadata (demo)
FILE_META = {}  # cid -> { filename, mime }

@router.post("/upload")
async def upload_to_ipfs(file: UploadFile = File(...)):
    raw = await file.read()

    encrypted = encrypt_bytes(raw)

    files = {
        "file": (file.filename + ".enc", encrypted)
    }

    r = requests.post(f"{IPFS_API}/add", files=files)
    r.raise_for_status()
    data = r.json()

    cid = data["Hash"]

    FILE_META[cid] = {
        "filename": file.filename,
        "mime": file.content_type
    }

    return {
        "cid": cid,
        "filename": file.filename,
        "mime": file.content_type
    }


@router.get("/cat/{cid}")
def get_from_ipfs(cid: str):
    r = requests.post(f"{IPFS_API}/cat?arg={cid}")
    if r.status_code != 200:
        return Response(status_code=404)

    decrypted = decrypt_bytes(r.content)

    meta = FILE_META.get(cid, {})
    filename = meta.get("filename", "file")
    mime = meta.get("mime", "application/octet-stream")

    return Response(
        content=decrypted,
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
