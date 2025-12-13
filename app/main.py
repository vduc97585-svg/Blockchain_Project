from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # <-- thêm dòng này
from app.routers import hospital, doctor, record, ipfs

app = FastAPI(
    title="EHR NFT Backend",
    version="1.0.0",
)

# --- CORS middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # frontend Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(hospital.router, prefix="", tags=["hospital"])
app.include_router(doctor.router, prefix="", tags=["doctor"])
app.include_router(record.router, prefix="", tags=["record"])
app.include_router(ipfs.router)

@app.get("/")
def root():
    return {"message": "EHR NFT Backend Running"}
