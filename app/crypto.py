# backend/crypto.py
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from .config import SERVER_SECRET

def derive_key() -> bytes:
    return hashlib.sha256(
        SERVER_SECRET.encode()
    ).digest()

def encrypt_bytes(data: bytes) -> bytes:
    key = derive_key()
    iv = os.urandom(12)
    aes = AESGCM(key)
    encrypted = aes.encrypt(iv, data, None)
    return iv + encrypted   # prepend IV

def decrypt_bytes(data: bytes) -> bytes:
    key = derive_key()
    iv = data[:12]
    enc = data[12:]
    aes = AESGCM(key)
    return aes.decrypt(iv, enc, None)
