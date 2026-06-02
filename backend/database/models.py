from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class FailedSync(Base):
    __tablename__ = "failed_syncs"
    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String, index=True)
    item_id = Column(Integer)
    item_url = Column(String)
    error_code = Column(Integer, nullable=True)
    error_message = Column(String)
    failed_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    retry_count = Column(Integer, default=0)

class SyncLog(Base):
    __tablename__ = "sync_logs"
    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String, index=True)
    item_id = Column(Integer, index=True)
    request_id = Column(String)
    worker_id = Column(String)
    duration_ms = Column(Integer)
    log_data = Column(String) # JSON payload
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    is_live = Column(Boolean, default=True)
    total_karma = Column(Integer, nullable=True)
    icon_img = Column(String, nullable=True)
    auto_track = Column(Boolean, default=False)
    last_checked = Column(DateTime, default=datetime.datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)
    
    # New Columns
    etag = Column(String, nullable=True)
    last_modified = Column(String, nullable=True)
    previous_karma = Column(Integer, nullable=True)
    last_changed_at = Column(DateTime, nullable=True)
    archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    health_status = Column(String, default='healthy')

    posts = relationship("Post", back_populates="account")
    comments = relationship("Comment", back_populates="account")

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    is_live = Column(Boolean, default=True)
    ups = Column(Integer, default=0)
    subreddit = Column(String, nullable=True)
    last_checked = Column(DateTime, default=datetime.datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)
    
    # New Columns
    etag = Column(String, nullable=True)
    last_modified = Column(String, nullable=True)
    previous_score = Column(Integer, nullable=True)
    last_changed_at = Column(DateTime, nullable=True)
    archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    health_status = Column(String, default='healthy')
    
    account_id = Column(Integer, ForeignKey("accounts.id"))

    account = relationship("Account", back_populates="posts")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    body = Column(String, nullable=True)
    is_live = Column(Boolean, default=True)
    ups = Column(Integer, default=0)
    subreddit = Column(String, nullable=True)
    last_checked = Column(DateTime, default=datetime.datetime.utcnow)
    last_synced_at = Column(DateTime, nullable=True)

    # New Columns
    etag = Column(String, nullable=True)
    last_modified = Column(String, nullable=True)
    previous_score = Column(Integer, nullable=True)
    last_changed_at = Column(DateTime, nullable=True)
    archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    health_status = Column(String, default='healthy')

    account_id = Column(Integer, ForeignKey("accounts.id"))

    account = relationship("Account", back_populates="comments")
