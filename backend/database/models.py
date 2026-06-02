from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    is_live = Column(Boolean, default=True)
    total_karma = Column(Integer, nullable=True)
    icon_img = Column(String, nullable=True)
    auto_track = Column(Boolean, default=False)
    last_checked = Column(DateTime, default=datetime.datetime.utcnow)

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
    account_id = Column(Integer, ForeignKey("accounts.id"))

    account = relationship("Account", back_populates="posts")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    is_live = Column(Boolean, default=True)
    ups = Column(Integer, default=0)
    subreddit = Column(String, nullable=True)
    last_checked = Column(DateTime, default=datetime.datetime.utcnow)
    account_id = Column(Integer, ForeignKey("accounts.id"))

    account = relationship("Account", back_populates="comments")
