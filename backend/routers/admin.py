from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import models, database

router = APIRouter()

@router.get("/admin/failed-syncs")
def get_failed_syncs(skip: int = 0, limit: int = 50, db: Session = Depends(database.get_db)):
    failures = db.query(models.FailedSync).order_by(models.FailedSync.failed_at.desc()).offset(skip).limit(limit).all()
    total = db.query(models.FailedSync).count()
    return {
        "items": [
            {
                "id": f.id,
                "item_type": f.item_type,
                "item_id": f.item_id,
                "item_url": f.item_url,
                "error": f.error_message,
                "failed_at": f.failed_at,
                "retry_count": f.retry_count
            } for f in failures
        ],
        "total": total,
        "page": (skip // limit) + 1,
        "pages": (total + limit - 1) // limit
    }

@router.post("/admin/failed-syncs/{failed_id}/dismiss")
def dismiss_failed_sync(failed_id: int, db: Session = Depends(database.get_db)):
    fs = db.query(models.FailedSync).filter(models.FailedSync.id == failed_id).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Failed sync not found")
    
    db.delete(fs)
    db.commit()
    return {"message": "Dismissed"}

@router.post("/admin/failed-syncs/{failed_id}/retry")
def retry_failed_sync(failed_id: int, db: Session = Depends(database.get_db)):
    fs = db.query(models.FailedSync).filter(models.FailedSync.id == failed_id).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Failed sync not found")
    
    from tasks.data_layer import sync_account_task, sync_post_task, sync_comment_task
    
    if fs.item_type == "account":
        sync_account_task.delay(fs.item_id)
    elif fs.item_type == "post":
        sync_post_task.delay(fs.item_id)
    elif fs.item_type == "comment":
        sync_comment_task.delay(fs.item_id)
        
    db.delete(fs)
    db.commit()
    return {"message": "Enqueued for retry and removed from failed list"}

@router.get("/admin/item-logs")
def get_item_logs(item_type: str, item_id: int, limit: int = 100, db: Session = Depends(database.get_db)):
    logs = db.query(models.SyncLog).filter_by(
        item_type=item_type, 
        item_id=item_id
    ).order_by(models.SyncLog.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": l.id,
            "request_id": l.request_id,
            "worker_id": l.worker_id,
            "duration_ms": l.duration_ms,
            "log_data": l.log_data,
            "created_at": l.created_at
        } for l in logs
    ]
