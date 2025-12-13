import os
from dotenv import load_dotenv

load_dotenv()

SERVER_SECRET = os.getenv("SERVER_SECRET")

if not SERVER_SECRET:
    raise RuntimeError("SERVER_SECRET is not set in .env")