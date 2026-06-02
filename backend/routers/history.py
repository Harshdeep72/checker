from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import models, database

router = APIRouter()

@router.get("/accounts/{account_id}/history")
def get_account_history(account_id: int, db: Session = Depends(database.get_read_db)):
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    return {
        "current_karma": account.total_karma,
        "previous_karma": account.previous_karma,
        "last_changed_at": account.last_changed_at,
        "health_status": account.health_status,
        "consecutive_failures": account.consecutive_failures,
        "archived": account.archived,
        "archived_at": account.archived_at
    }

@router.get("/tracked/posts/{post_id}/history")
def get_post_history(post_id: int, db: Session = Depends(database.get_read_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    return {
        "current_score": post.ups,
        "previous_score": post.previous_score,
        "last_changed_at": post.last_changed_at,
        "health_status": post.health_status,
        "consecutive_failures": post.consecutive_failures,
        "archived": post.archived,
        "archived_at": post.archived_at
    }

@router.get("/tracked/comments/{comment_id}/history")
def get_comment_history(comment_id: int, db: Session = Depends(database.get_read_db)):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
        
    return {
        "current_score": comment.ups,
        "previous_score": comment.previous_score,
        "last_changed_at": comment.last_changed_at,
        "health_status": comment.health_status,
        "consecutive_failures": comment.consecutive_failures,
        "archived": comment.archived,
        "archived_at": comment.archived_at
    }
