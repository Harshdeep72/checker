from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from database import models, database
from scraper import scraper

router = APIRouter()

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Discord Bot / Liveness Endpoints ---

@router.get("/external/check/comment")
def check_comment(url: str = Query(..., description="The Reddit comment URL to check")):
    result = scraper.check_reddit_url(url)
    return result

@router.get("/external/check/post")
def check_post(url: str = Query(..., description="The Reddit post URL to check")):
    result = scraper.check_reddit_url(url)
    return result


# --- Dashboard Endpoints ---

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Aggregated stats for the Overview page."""
    total_accounts = db.query(models.Account).count()
    live_accounts = db.query(models.Account).filter(models.Account.is_live == True).count()
    banned_accounts = total_accounts - live_accounts

    total_posts = db.query(models.Post).count()
    live_posts = db.query(models.Post).filter(models.Post.is_live == True).count()

    total_comments = db.query(models.Comment).count()
    live_comments = db.query(models.Comment).filter(models.Comment.is_live == True).count()

    return {
        "accounts": {
            "total": total_accounts,
            "live": live_accounts,
            "banned": banned_accounts
        },
        "posts": {
            "total": total_posts,
            "live": live_posts
        },
        "comments": {
            "total": total_comments,
            "live": live_comments
        }
    }

@router.get("/accounts/{username}")
def get_account_details(username: str, db: Session = Depends(get_db)):
    """Fetch specific account details. Performs a live check against Reddit first, updates DB, then returns."""
    
    # Perform live check
    live_status = scraper.check_reddit_user(username)
    is_currently_live = live_status["is_live"]
    raw_data = live_status.get("raw_data") or {}
    
    # Extract cacheable fields
    total_karma = raw_data.get("total_karma")
    icon_img = raw_data.get("icon_img") or raw_data.get("snoovatar_img")
    
    # Update or Create in DB
    account = db.query(models.Account).filter(models.Account.username == username).first()
    if not account:
        account = models.Account(username=username, is_live=is_currently_live,
                                 total_karma=total_karma, icon_img=icon_img)
        db.add(account)
        db.commit()
        db.refresh(account)
    else:
        account.is_live = is_currently_live
        account.last_checked = func.now()
        if total_karma is not None:
            account.total_karma = total_karma
        if icon_img:
            account.icon_img = icon_img
        db.commit()
        db.refresh(account)
    
    newly_added = 0
    
    # Auto-track new posts/comments if enabled
    if account.auto_track:
        tracked_post_urls = {p.url for p in account.posts}
        for post in raw_data.get("recent_posts", []):
            url = post.get("url")
            if url and url not in tracked_post_urls:
                try:
                    new_post = models.Post(
                        url=url, is_live=True,
                        account_id=account.id,
                        ups=post.get("ups", 0)
                    )
                    db.add(new_post)
                    newly_added += 1
                except Exception:
                    pass
        
        tracked_comment_urls = {c.url for c in account.comments}
        for comment in raw_data.get("recent_comments", []):
            url = comment.get("url")
            if url and url not in tracked_comment_urls:
                try:
                    new_comment = models.Comment(
                        url=url, is_live=True,
                        account_id=account.id,
                        ups=comment.get("ups", 0),
                        body=comment.get("body", "")[:500] if comment.get("body") else None
                    )
                    db.add(new_comment)
                    newly_added += 1
                except Exception:
                    pass
        
        if newly_added > 0:
            db.commit()
            db.refresh(account)
    
    # Return combined data
    return {
        "id": account.id,
        "username": account.username,
        "is_live": account.is_live,
        "total_karma": account.total_karma,
        "icon_img": account.icon_img,
        "auto_track": account.auto_track,
        "last_checked": account.last_checked,
        "reddit_data": raw_data,
        "newly_added": newly_added,
        "posts": [{"id": p.id, "url": p.url, "is_live": p.is_live} for p in account.posts],
        "comments": [{"id": c.id, "url": c.url, "is_live": c.is_live, "body": c.body} for c in account.comments]
    }

from pydantic import BaseModel

class TrackRequest(BaseModel):
    url: str

class BulkTrackRequest(BaseModel):
    urls: List[str]

class BulkAccountRequest(BaseModel):
    usernames: List[str]

@router.post("/tracked/posts")
def track_new_post(req: TrackRequest, db: Session = Depends(get_db)):
    result = scraper.check_reddit_url(req.url)
    details = scraper.get_post_details(req.url)
    
    author = details.get("author") if details.get("status") == "success" else None
    
    post = db.query(models.Post).filter(models.Post.url == req.url).first()
    if not post:
        account = None
        if author:
            account = db.query(models.Account).filter(models.Account.username == author).first()
            if not account:
                account = models.Account(username=author, is_live=True)
                db.add(account)
                db.commit()
                db.refresh(account)
                
        post = models.Post(url=req.url, is_live=(result["code"] == 200), account_id=account.id if account else None, ups=details.get("ups", 0), subreddit=details.get("subreddit"))
        db.add(post)
    else:
        post.is_live = (result["code"] == 200)
        post.ups = details.get("ups", 0)
        post.subreddit = details.get("subreddit") or post.subreddit
        post.last_checked = func.now()
        
    db.commit()
    db.refresh(post)
    return {"message": "Tracked successfully", "status": result, "post": {"id": post.id, "url": post.url, "is_live": post.is_live, "ups": post.ups, "subreddit": post.subreddit}}

@router.post("/tracked/comments")
def track_new_comment(req: TrackRequest, db: Session = Depends(get_db)):
    result = scraper.check_reddit_url(req.url)
    details = scraper.get_post_details(req.url)
    
    author = details.get("author") if details.get("status") == "success" else None
    
    comment = db.query(models.Comment).filter(models.Comment.url == req.url).first()
    if not comment:
        account = None
        if author:
            account = db.query(models.Account).filter(models.Account.username == author).first()
            if not account:
                account = models.Account(username=author, is_live=True)
                db.add(account)
                db.commit()
                db.refresh(account)
                
        comment = models.Comment(url=req.url, is_live=(result["code"] == 200), account_id=account.id if account else None, ups=details.get("ups", 0), subreddit=details.get("subreddit"))
        db.add(comment)
    else:
        comment.is_live = (result["code"] == 200)
        comment.ups = details.get("ups", 0)
        comment.subreddit = details.get("subreddit") or comment.subreddit
        comment.last_checked = func.now()
        
    db.commit()
    db.refresh(comment)
    return {"message": "Tracked successfully", "status": result, "comment": {"id": comment.id, "url": comment.url, "is_live": comment.is_live, "ups": comment.ups, "subreddit": comment.subreddit}}

@router.get("/accounts")
def get_all_accounts(page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    skip = (page - 1) * per_page
    total = db.query(func.count(models.Account.id)).scalar()
    accounts = db.query(models.Account).order_by(models.Account.id.desc()).offset(skip).limit(per_page).all()
    items = [{
        "id": a.id,
        "username": a.username,
        "is_live": a.is_live,
        "total_karma": a.total_karma,
        "icon_img": a.icon_img,
        "auto_track": a.auto_track,
        "last_checked": a.last_checked
    } for a in accounts]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page
    }

@router.delete("/accounts/{username}")
def delete_account(username: str, db: Session = Depends(get_db)):
    account = db.query(models.Account).filter(models.Account.username == username).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found in tracker")
    db.delete(account)
    db.commit()
    return {"message": f"Stopped tracking account {username}"}

@router.patch("/accounts/{username}/auto_track")
def toggle_auto_track(username: str, db: Session = Depends(get_db)):
    account = db.query(models.Account).filter(models.Account.username == username).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.auto_track = not account.auto_track
    db.commit()
    return {"username": username, "auto_track": account.auto_track}

@router.delete("/tracked/posts/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"message": "Post removed from tracker"}

@router.delete("/tracked/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return {"message": "Comment removed from tracker"}

@router.get("/external/post_details")
def get_external_post_details(url: str):
    return scraper.get_post_details(url)

@router.get("/tracked/posts")
def get_tracked_posts(page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    skip = (page - 1) * per_page
    total = db.query(func.count(models.Post.id)).scalar()
    posts = db.query(models.Post).order_by(models.Post.id.desc()).offset(skip).limit(per_page).all()
    items = [{"id": p.id, "url": p.url, "is_live": p.is_live, "ups": p.ups, "subreddit": p.subreddit, "account": p.account.username if p.account else None} for p in posts]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page
    }

@router.get("/tracked/comments")
def get_tracked_comments(page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    skip = (page - 1) * per_page
    total = db.query(func.count(models.Comment.id)).scalar()
    comments = db.query(models.Comment).order_by(models.Comment.id.desc()).offset(skip).limit(per_page).all()
    items = [{
        "id": c.id,
        "url": c.url,
        "body": c.body,
        "is_live": c.is_live,
        "ups": c.ups,
        "subreddit": c.subreddit,
        "account": c.account.username if c.account else None
    } for c in comments]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page
    }
from tasks.data_layer import sync_post_task, sync_comment_task

@router.post("/tracked/posts/sync")
def sync_tracked_posts(db: Session = Depends(get_db)):
    posts = db.query(models.Post).all()
    for post in posts:
        sync_post_task.apply_async(args=[post.id], queue="high")
    return {"message": f"Enqueued {len(posts)} posts for syncing", "status": "processing"}

@router.post("/tracked/comments/sync")
def sync_tracked_comments(db: Session = Depends(get_db)):
    comments = db.query(models.Comment).all()
    for comment in comments:
        sync_comment_task.apply_async(args=[comment.id], queue="high")
    return {"message": f"Enqueued {len(comments)} comments for syncing", "status": "processing"}

@router.post("/tracked/posts/bulk")
def bulk_track_posts(req: BulkTrackRequest, db: Session = Depends(get_db)):
    results = {"added": 0, "failed": 0, "errors": []}
    for url in req.urls:
        if not url.strip(): continue
        try:
            track_new_post(TrackRequest(url=url.strip()), db)
            results["added"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{url}: {str(e)}")
    return results

@router.post("/tracked/comments/bulk")
def bulk_track_comments(req: BulkTrackRequest, db: Session = Depends(get_db)):
    results = {"added": 0, "failed": 0, "errors": []}
    for url in req.urls:
        if not url.strip(): continue
        try:
            track_new_comment(TrackRequest(url=url.strip()), db)
            results["added"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{url}: {str(e)}")
    return results

@router.post("/accounts/bulk")
def bulk_track_accounts(req: BulkAccountRequest, db: Session = Depends(get_db)):
    results = {"added": 0, "failed": 0, "errors": []}
    for username in req.usernames:
        clean_username = username.strip().replace("u/", "")
        if not clean_username: continue
        try:
            get_account_details(clean_username, db)
            results["added"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{username}: {str(e)}")
    return results

from celery_config import app as celery_app

@router.get("/queue/status")
def get_queue_status():
    try:
        i = celery_app.control.inspect()
        active = i.active() or {}
        reserved = i.reserved() or {}
        
        total_active = sum(len(tasks) for tasks in active.values())
        total_queued = sum(len(tasks) for tasks in reserved.values())
        
        return {
            "active": total_active,
            "queued": total_queued,
            "status": "processing" if total_active > 0 or total_queued > 0 else "idle"
        }
    except Exception as e:
        return {"error": str(e), "status": "unknown"}

