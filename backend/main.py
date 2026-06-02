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
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS body VARCHAR",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP",
        
        # New columns for scalability refactor
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS etag VARCHAR",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_modified VARCHAR",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS previous_karma INTEGER",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMP",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0",
        "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS health_status VARCHAR DEFAULT 'healthy'",
        
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS etag VARCHAR",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_modified VARCHAR",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS previous_score INTEGER",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMP",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS health_status VARCHAR DEFAULT 'healthy'",
        
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS etag VARCHAR",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS last_modified VARCHAR",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS previous_score INTEGER",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMP",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS health_status VARCHAR DEFAULT 'healthy'"
    ]
    with database.engine.connect() as conn:
        for sql in migrations:
            try:
                # SQLite doesn't natively support IF NOT EXISTS in ADD COLUMN in older versions
                if "sqlite" in str(database.engine.url):
                    sql_clean = sql.replace("IF NOT EXISTS ", "")
                    conn.execute(text(sql_clean))
                else:
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

from routers import history, admin

app.include_router(routes.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Reddit Stealth Proxy is running"}
