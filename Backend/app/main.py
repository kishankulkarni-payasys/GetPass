from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.database import Base, engine
from app.routers import entries

app = FastAPI(title="GatePass API")

Base.metadata.create_all(bind=engine)

app.include_router(entries.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
