import os
import time
import uuid
import logging
import threading
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL")
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", 50))

try:
    import redis
    redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None
except ImportError:
    redis_client = None

if not redis_client:
    logger.warning("REDIS_URL not set or redis not installed. RateLimitBudget falling back to in-process lock.")

LUA_ACQUIRE = """
local key = KEYS[1]
local penalty_key = KEYS[2]
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local req_id = ARGV[3]

-- Check penalty
local penalty = redis.call('GET', penalty_key)
if penalty then
    return -1
end

-- Clear old
redis.call('ZREMRANGEBYSCORE', key, 0, now - 60)

-- Count remaining
local count = redis.call('ZCARD', key)
if count >= limit then
    return 0
end

-- Add new
redis.call('ZADD', key, now, req_id)
-- Set TTL so it doesn't grow forever if unused
redis.call('EXPIRE', key, 65)

return 1
"""

class RateLimitBudget:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(RateLimitBudget, cls).__new__(cls, *args, **kwargs)
                cls._instance._init_budget()
        return cls._instance

    def _init_budget(self):
        self.use_redis = redis_client is not None
        if self.use_redis:
            self.acquire_script = redis_client.register_script(LUA_ACQUIRE)
        else:
            self.local_times = []
            self.penalty_until = 0
            self.local_lock = threading.Lock()

    def acquire(self):
        while True:
            if self.use_redis:
                now = time.time()
                req_id = str(uuid.uuid4())
                res = self.acquire_script(
                    keys=["rl:requests", "rl:penalty_until"],
                    args=[now, RATE_LIMIT_PER_MINUTE, req_id]
                )
                if res == 1:
                    return
                elif res == -1:
                    # Penalized
                    time.sleep(1)
                else:
                    # Rate limited
                    time.sleep(1)
            else:
                with self.local_lock:
                    now = time.time()
                    if now < self.penalty_until:
                        pass
                    else:
                        self.local_times = [t for t in self.local_times if t >= now - 60]
                        if len(self.local_times) < RATE_LIMIT_PER_MINUTE:
                            self.local_times.append(now)
                            return
                time.sleep(1)

    def penalise(self):
        if self.use_redis:
            redis_client.setex("rl:penalty_until", 120, "1")
        else:
            with self.local_lock:
                self.penalty_until = time.time() + 120

    def get_stats(self):
        if self.use_redis:
            now = time.time()
            redis_client.zremrangebyscore("rl:requests", 0, now - 60)
            count = redis_client.zcard("rl:requests")
            penalty_ttl = redis_client.ttl("rl:penalty_until")
            return {
                "requests_last_60s": count,
                "rate_limit_cap": RATE_LIMIT_PER_MINUTE,
                "penalty_active": penalty_ttl > 0,
                "penalty_expires_in_seconds": penalty_ttl if penalty_ttl > 0 else 0
            }
        else:
            with self.local_lock:
                now = time.time()
                self.local_times = [t for t in self.local_times if t >= now - 60]
                rem = self.penalty_until - now
                return {
                    "requests_last_60s": len(self.local_times),
                    "rate_limit_cap": RATE_LIMIT_PER_MINUTE,
                    "penalty_active": rem > 0,
                    "penalty_expires_in_seconds": int(rem) if rem > 0 else 0
                }
