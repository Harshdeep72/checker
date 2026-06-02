import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = Celery("redditchecker", broker=redis_url, backend=redis_url, include=['tasks.data_layer'])

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Rate limit workers to max 5 requests/sec total for scraping tasks.
    # Note: rate_limit works per worker instance.
    task_annotations={
        'tasks.data_layer.sync_account_task': {'rate_limit': '2/s'},
        'tasks.data_layer.sync_post_task': {'rate_limit': '3/s'},
        'tasks.data_layer.sync_comment_task': {'rate_limit': '3/s'}
    },
    # Ensure Celery Beat schedule for periodic tasks
    beat_schedule={
        'sync-stale-accounts': {
            'task': 'tasks.data_layer.enqueue_stale_syncs',
            'schedule': crontab(minute='*/30'), # Every 30 mins
        },
    }
)

