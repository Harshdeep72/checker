from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import models, database
from api import routes

# Create any brand-new tables
models.Base.metadata.create_all(bind=database.engine)

# Safe column migrations — ADD COLUMN IF NOT EXISTS never errors on existing columns.
# Add any new columns here whenever the model changes.
def run_migrations():
    migrations = [
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS total_karma INTEGER",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS icon_img VARCHAR",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auto_track BOOLEAN DEFAULT FALSE",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS ups INTEGER DEFAULT 0",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS subreddit VARCHAR",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS ups INTEGER DEFAULT 0",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS subreddit VARCHAR",
    ]
    with database.engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception as e:
                print(f"Migration skipped ({sql[:50]}...): {e}")
        conn.commit()

run_migrations()

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
