import os
import datetime
import structlog
import uuid
import requests as sync_requests
from celery import shared_task
from sqlalchemy import func
from database.database import SessionLocal
from database import models
from scraper import scraper
import time

logger = structlog.get_logger()

ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "")

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()

def send_alert(message: str):
    if ALERT_WEBHOOK_URL:
        try:
            sync_requests.post(ALERT_WEBHOOK_URL, json={"text": message}, timeout=5)
        except Exception:
            pass

def log_failure(db, item_type, item_id, url, exc):
    # Log to failed_syncs table
    fs = db.query(models.FailedSync).filter_by(item_type=item_type, item_id=item_id).first()
    if fs:
        fs.retry_count += 1
        fs.error_message = str(exc)
        fs.failed_at = datetime.datetime.utcnow()
    else:
        fs = models.FailedSync(
            item_type=item_type,
            item_id=item_id,
            item_url=url,
            error_message=str(exc)
        )
        db.add(fs)
    db.commit()

@shared_task(bind=True, max_retries=3)
def sync_account_task(self, account_id):
    req_id = str(uuid.uuid4())
    log = logger.bind(request_id=req_id, item_type="account", item_id=account_id)
    start_time = time.time()
    
    db = get_db()
    account = db.query(models.Account).filter(models.Account.id == account_id).first()
    if not account:
        log.warning("Account not found")
        return f"Account {account_id} not found"
        
    try:
        # Think pause for rate limit / steath
        time.sleep(1)
        
        raw_data = scraper.check_reddit_user(account.username, etag=account.etag)
        
        if raw_data.get("status") == "unchanged":
            log.info("unchanged_304")
        else:
            account.is_live = raw_data.get("is_live", False)
            account.etag = raw_data.get("etag") or account.etag
            account.last_modified = raw_data.get("last_modified") or account.last_modified
            
            if raw_data.get("status") == "live" and raw_data.get("raw_data"):
                data = raw_data["raw_data"]
                new_karma = data.get("total_karma", 0)
                
                if new_karma != account.total_karma:
                    account.previous_karma = account.total_karma
                    account.total_karma = new_karma
                    account.last_changed_at = datetime.datetime.utcnow()
                    log.info("value_changed", old_karma=account.previous_karma, new_karma=new_karma)
                    
                account.icon_img = data.get("icon_img", "")
                
                # Auto-track logic
                if account.auto_track:
                    newly_added = 0
                    tracked_post_urls = {p.url for p in account.posts}
                    for post in data.get("recent_posts", []):
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
                    for comment in data.get("recent_comments", []):
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
                                
        account.last_checked = datetime.datetime.utcnow()
        account.last_synced_at = datetime.datetime.utcnow()
        account.consecutive_failures = 0
        account.health_status = 'healthy'
        db.commit()
        
        duration = int((time.time() - start_time) * 1000)
        log.info("sync_success", duration_ms=duration)
        return f"Synced account {account.username}"
    except Exception as exc:
        db.rollback()
        account.consecutive_failures += 1
        if account.consecutive_failures > 5:
            account.health_status = 'degraded'
            if account.consecutive_failures > 10:
                account.health_status = 'unreachable'
                send_alert(f"Account {account.username} reached unreachable status after {account.consecutive_failures} failures.")
        db.commit()
        
        log_failure(db, "account", account_id, f"/user/{account.username}", exc)
        log.error("sync_failed", error=str(exc), retry=self.request.retries)
        
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

@shared_task(bind=True, max_retries=3)
def sync_post_task(self, post_id):
    req_id = str(uuid.uuid4())
    log = logger.bind(request_id=req_id, item_type="post", item_id=post_id)
    start_time = time.time()
    
    db = get_db()
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        return f"Post {post_id} not found"
        
    try:
        time.sleep(1)
        
        details = scraper.get_post_details(post.url, etag=post.etag)
        if details.get("status") == "unchanged":
            log.info("unchanged_304")
        elif details.get("status") == "success":
            post.is_live = True
            post.etag = details.get("etag") or post.etag
            post.last_modified = details.get("last_modified") or post.last_modified
            
            new_ups = details.get("ups", 0)
            if new_ups != post.ups:
                post.previous_score = post.ups
                post.ups = new_ups
                post.last_changed_at = datetime.datetime.utcnow()
                
            post.subreddit = details.get("subreddit") or post.subreddit
        else:
            # Maybe it's a 404
            if details.get("code") == 404:
                post.is_live = False
            
        post.last_checked = datetime.datetime.utcnow()
        post.last_synced_at = datetime.datetime.utcnow()
        post.consecutive_failures = 0
        post.health_status = 'healthy'
        db.commit()
        log.info("sync_success", duration_ms=int((time.time() - start_time) * 1000))
        return f"Synced post {post.id}"
    except Exception as exc:
        db.rollback()
        post.consecutive_failures += 1
        if post.consecutive_failures > 5:
            post.health_status = 'degraded'
        db.commit()
        log_failure(db, "post", post_id, post.url, exc)
        log.error("sync_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

@shared_task(bind=True, max_retries=3)
def sync_comment_task(self, comment_id):
    req_id = str(uuid.uuid4())
    log = logger.bind(request_id=req_id, item_type="comment", item_id=comment_id)
    start_time = time.time()
    
    db = get_db()
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        return f"Comment {comment_id} not found"
        
    try:
        time.sleep(1)
        
        details = scraper.get_post_details(comment.url, etag=comment.etag)
        if details.get("status") == "unchanged":
            log.info("unchanged_304")
        elif details.get("status") == "success":
            comment.is_live = True
            comment.etag = details.get("etag") or comment.etag
            comment.last_modified = details.get("last_modified") or comment.last_modified
            
            new_ups = details.get("ups", 0)
            if new_ups != comment.ups:
                comment.previous_score = comment.ups
                comment.ups = new_ups
                comment.last_changed_at = datetime.datetime.utcnow()
                
            comment.subreddit = details.get("subreddit") or comment.subreddit
        else:
            if details.get("code") == 404:
                comment.is_live = False
            
        comment.last_checked = datetime.datetime.utcnow()
        comment.last_synced_at = datetime.datetime.utcnow()
        comment.consecutive_failures = 0
        comment.health_status = 'healthy'
        db.commit()
        log.info("sync_success", duration_ms=int((time.time() - start_time) * 1000))
        return f"Synced comment {comment.id}"
    except Exception as exc:
        db.rollback()
        comment.consecutive_failures += 1
        if comment.consecutive_failures > 5:
            comment.health_status = 'degraded'
        db.commit()
        log_failure(db, "comment", comment_id, comment.url, exc)
        log.error("sync_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))

@shared_task
def enqueue_stale_syncs():
    """Finds accounts/posts/comments that haven't been synced in a while and enqueues them."""
    db = get_db()
    now = datetime.datetime.utcnow()
    active_cutoff = now - datetime.timedelta(minutes=30)
    
    # Exclude archived and unreachable items from regular syncing
    accounts = db.query(models.Account).filter(
        (models.Account.last_synced_at == None) | (models.Account.last_synced_at < active_cutoff),
        models.Account.archived == False,
        models.Account.health_status != 'unreachable'
    ).limit(500).all()
    for acc in accounts:
        sync_account_task.delay(acc.id)
        
    posts = db.query(models.Post).filter(
        (models.Post.last_synced_at == None) | (models.Post.last_synced_at < active_cutoff),
        models.Post.archived == False,
        models.Post.health_status != 'unreachable'
    ).limit(1000).all()
    for p in posts:
        sync_post_task.delay(p.id)
        
    comments = db.query(models.Comment).filter(
        (models.Comment.last_synced_at == None) | (models.Comment.last_synced_at < active_cutoff),
        models.Comment.archived == False,
        models.Comment.health_status != 'unreachable'
    ).limit(1000).all()
    for c in comments:
        sync_comment_task.delay(c.id)
        
    return f"Enqueued {len(accounts)} accounts, {len(posts)} posts, {len(comments)} comments"

@shared_task
def archive_stale_items():
    """Archives items that haven't changed in 30 days."""
    db = get_db()
    now = datetime.datetime.utcnow()
    stale_cutoff = now - datetime.timedelta(days=30)
    
    count = 0
    # For posts
    posts = db.query(models.Post).filter(
        models.Post.last_changed_at < stale_cutoff,
        models.Post.archived == False
    ).all()
    for p in posts:
        p.archived = True
        p.archived_at = now
        count += 1
        
    # For comments
    comments = db.query(models.Comment).filter(
        models.Comment.last_changed_at < stale_cutoff,
        models.Comment.archived == False
    ).all()
    for c in comments:
        c.archived = True
        c.archived_at = now
        count += 1
        
    db.commit()
    logger.info("archived_items", count=count)
    return f"Archived {count} items."
