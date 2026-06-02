# Reddit Stealth Checker

A high-performance system for tracking Reddit accounts, posts, and comments without getting rate-limited or blocked.

## Architecture

This application has been refactored for scale to handle 1000+ accounts and items.

### Frontend
- **Stack:** React, Vite, TailwindCSS
- **Key Changes:** Migrated from bulk-loading Promise.all to `@tanstack/react-virtual` for virtual scrolling and lazy-loaded infinite scroll. Added queue status polling to replace slow, blocked UI states.

### Backend (Web Service)
- **Stack:** Python, FastAPI, SQLAlchemy
- **Key Changes:** Endpoints now return paginated data (limit/offset) instead of all rows. The `/sync` endpoints enqueue background tasks instead of blocking.

### Background Worker (Worker Service)
- **Stack:** Celery, Redis
- **Key Changes:** Scraping (using `curl_cffi`) is now performed asynchronously in a background worker queue with rate-limiting and retry logic to avoid IP bans from Reddit.
- A `celery beat` scheduler automatically checks for stale accounts/posts and enqueues them for background syncing.

### Database
- **Stack:** PostgreSQL

## Local Development (Docker Compose)

You can spin up the entire stack locally using Docker Compose:

```bash
docker-compose up --build
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379
- FastAPI Backend on port 8000
- Celery Worker
- Celery Beat Scheduler
- Vite Frontend on port 5173

Access the frontend at `http://localhost:5173`.

## Render Deployment

To deploy this architecture on Render:
1. **PostgreSQL:** Create a Render PostgreSQL database.
2. **Redis:** Create a Render Redis instance.
3. **Web Service (FastAPI):** Deploy the backend folder.
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Set `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`.
4. **Background Worker (Celery):** Deploy a new Background Worker service pointing to the backend folder.
   - Start Command: `celery -A celery_config.app worker --loglevel=info`
   - Set the exact same environment variables as the Web Service.
5. **Static Site (Vite):** Deploy the frontend folder.
   - Set `VITE_API_URL` to your Web Service URL.

## PgBouncer Sidecar Integration

For massive scale, deploy PgBouncer as a sidecar to manage database connections.

Create a `pgbouncer.ini` configuration file:

```ini
[databases]
redditchecker = host=your-db-host port=5432 dbname=your-db user=your-user password=your-password

[pgbouncer]
listen_port = 6543
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
```

Deploy it alongside your FastAPI application. Then, update your `DATABASE_URL` and `DATABASE_URL_READ` to point to PgBouncer instead of Postgres directly:

```
DATABASE_URL=postgresql://your-user:your-password@pgbouncer-service:6543/redditchecker
DATABASE_URL_READ=postgresql://your-user:your-password@pgbouncer-service:6543/redditchecker
```
