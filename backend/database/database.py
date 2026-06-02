import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# We can specify separate URLs or default to the single one.
# For PgBouncer, the URL usually looks like postgresql://user:pass@host:6543/db
DATABASE_URL_WRITE = os.getenv("DATABASE_URL", "sqlite:///./redditchecker.db")
DATABASE_URL_READ = os.getenv("DATABASE_URL_READ", DATABASE_URL_WRITE)

def get_connect_args(url):
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}

# We configure the connection pool sizes properly for PgBouncer / high scale
engine_write = create_engine(
    DATABASE_URL_WRITE, 
    connect_args=get_connect_args(DATABASE_URL_WRITE),
    pool_size=10, 
    max_overflow=20,
    pool_pre_ping=True
)

engine_read = create_engine(
    DATABASE_URL_READ, 
    connect_args=get_connect_args(DATABASE_URL_READ),
    pool_size=20, 
    max_overflow=30,
    pool_pre_ping=True
)

WriteSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_write)
ReadSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_read)

Base = declarative_base()

# Default get_db uses write session to be safe, but can be overridden by dependency
def get_db():
    db = WriteSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_read_db():
    db = ReadSessionLocal()
    try:
        yield db
    finally:
        db.close()

# For backward compatibility where engine is referenced
engine = engine_write
