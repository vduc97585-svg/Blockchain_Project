from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from app.ipfs.pinata import upload_file_to_pinata

router = APIRouter(prefix="/ipfs", tags=["IPFS"])

class IPFSResponse(BaseModel):
    cid: str

@router.post("/upload", response_model=IPFSResponse)
async def upload_to_ipfs(file: UploadFile = File(...)):
    """
    Upload file to IPFS using Pinata.
    """
    cid = upload_file_to_pinata(file)
    return IPFSResponse(cid=cid)
