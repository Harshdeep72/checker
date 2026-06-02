import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./redditchecker.db")
engine = create_engine(DATABASE_URL)

queries = [
    # accounts
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS etag VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_modified VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS previous_karma INTEGER",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMP",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS health_status VARCHAR DEFAULT 'healthy'",
    
    # posts
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS etag VARCHAR",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_modified VARCHAR",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS previous_score INTEGER",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMP",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0",
    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS health_status VARCHAR DEFAULT 'healthy'",
    
    # comments
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS etag VARCHAR",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS last_modified VARCHAR",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS previous_score INTEGER",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS last_changed_at TIMESTAMP",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0",
    "ALTER TABLE comments ADD COLUMN IF NOT EXISTS health_status VARCHAR DEFAULT 'healthy'",
]

# For SQLite, ADD COLUMN IF NOT EXISTS isn't standard in older versions, but postgres supports it if >= 9.6.
# If SQLite fails, we can catch and parse. Wait, SQLite does not support IF NOT EXISTS in ADD COLUMN until version 3.25.0. 
# Render uses Postgres anyway. Let's just run them and ignore errors on duplicate column.

def run_migrations():
    with engine.connect() as conn:
        for q in queries:
            try:
                # Remove 'IF NOT EXISTS' for sqlite compatibility, wrap in try/except
                q_sqlite = q.replace("IF NOT EXISTS ", "")
                if "sqlite" in DATABASE_URL:
                    conn.execute(text(q_sqlite))
                else:
                    conn.execute(text(q))
            except Exception as e:
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    pass # Already exists
                else:
                    print(f"Migration error for query '{q}': {e}")
        
        # also create tables for FailedSync, SyncLog
        from database.models import Base
        Base.metadata.create_all(engine)
        
        conn.commit()

if __name__ == "__main__":
    run_migrations()
    print("Migrations complete.")
