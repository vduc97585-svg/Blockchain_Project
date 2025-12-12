from fastapi import FastAPI
from app.routers import hospital, doctor, record, ipfs


app = FastAPI(
    title="EHR NFT Backend",
    version="1.0.0",
)

app.include_router(hospital.router, prefix="/hospital", tags=["hospital"])
app.include_router(doctor.router, prefix="/doctor", tags=["doctor"])
app.include_router(record.router, prefix="/record", tags=["record"])
app.include_router(ipfs.router)


@app.get("/")
def root():
    return {"message": "EHR NFT Backend Running"}
