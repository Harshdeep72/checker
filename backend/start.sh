#!/bin/bash
# Start celery worker in the background
celery -A celery_config.app worker --loglevel=info &
# Start uvicorn
uvicorn main:app --host 0.0.0.0 --port $PORT
