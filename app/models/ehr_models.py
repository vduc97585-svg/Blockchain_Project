from pydantic import BaseModel
from typing import Optional

class HospitalRegisterIn(BaseModel):
    hospital_address: str

class HospitalUnregisterIn(BaseModel):
    hospital_address: str

class DoctorRegisterIn(BaseModel):
    signer_private_key: str
    doctor_address: str

class DoctorUnregisterIn(BaseModel):
    doctor_address: str

class MintIn(BaseModel):
    tokenId: int
    patient: str
    cid: str
    signer_private_key: Optional[str] = None

class AddEntryIn(BaseModel):
    tokenId: int
    cid: str
    signer_private_key: Optional[str] = None

class DelegateHospitalIn(BaseModel):
    tokenId: int
    hospital: str
    signer_private_key: Optional[str] = None

class RevokeHospitalIn(BaseModel):
    tokenId: int
    hospital: str
    signer_private_key: Optional[str] = None

class BurnIn(BaseModel):
    tokenId: int
    signer_private_key: str
