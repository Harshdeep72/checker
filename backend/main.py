from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import models, database
from api import routes

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Reddit Stealth Checker API")

# Configure CORS for the frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development. Restrict in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Reddit Stealth Proxy is running"}
