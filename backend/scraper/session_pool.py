import os
import random
import logging
import threading
from curl_cffi import requests
from .ua_pool import UAPool
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SESSION_POOL_SIZE = int(os.getenv("SESSION_POOL_SIZE", 5))
SESSION_ROTATE_AFTER = int(os.getenv("SESSION_ROTATE_AFTER", 75))
REDDIT_SESSION_COOKIE = os.getenv("REDDIT_SESSION_COOKIE") or os.getenv("REDDIT_COOKIE", "")

class WrappedSession:
    def __init__(self, session_id: int, ua_pool: UAPool):
        self.session_id = session_id
        self.request_count = 0
        self.cooldown_until = 0
        self.ua_pool = ua_pool
        self.session = self._create_session()

    def _create_session(self):
        ua_data = self.ua_pool.get_random()
        s = requests.Session(impersonate="chrome120")
        s.headers.update({
            "User-Agent": ua_data["ua"],
            "Accept-Language": ua_data["lang"],
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "DNT": "1",
            "Upgrade-Insecure-Requests": "1"
        })
        if REDDIT_SESSION_COOKIE:
            s.cookies.set("reddit_session", REDDIT_SESSION_COOKIE, domain=".reddit.com")
        return s

class SessionPool:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(SessionPool, cls).__new__(cls, *args, **kwargs)
                cls._instance._init_pool()
        return cls._instance

    def _init_pool(self):
        self.ua_pool = UAPool()
        self.sessions = [WrappedSession(i, self.ua_pool) for i in range(SESSION_POOL_SIZE)]
        self.index = 0
        self.pool_lock = threading.Lock()

    def get_session(self):
        import time
        with self.pool_lock:
            # Round robin, skipping those on cooldown
            start_index = self.index
            now = time.time()
            for _ in range(SESSION_POOL_SIZE):
                s = self.sessions[self.index]
                self.index = (self.index + 1) % SESSION_POOL_SIZE
                
                if s.cooldown_until < now:
                    s.request_count += 1
                    # Rotate if needed
                    if s.request_count > SESSION_ROTATE_AFTER:
                        logging.info(f"[SESSION] Rotated session #{s.session_id} after {s.request_count - 1} requests")
                        s = WrappedSession(s.session_id, self.ua_pool)
                        s.request_count = 1
                        # Wait, we need to put it back in the array
                        idx_to_replace = (self.index - 1) % SESSION_POOL_SIZE
                        self.sessions[idx_to_replace] = s
                    
                    return s

            # If all are on cooldown, just return the first one anyway and let it block or fail,
            # or wait. For now, just return the next one.
            s = self.sessions[self.index]
            self.index = (self.index + 1) % SESSION_POOL_SIZE
            s.request_count += 1
            return s

    def cooldown_session(self, session_id, seconds=90):
        import time
        with self.pool_lock:
            for s in self.sessions:
                if s.session_id == session_id:
                    s.cooldown_until = time.time() + seconds
                    logging.warning(f"[SOFTBLOCK] Detected for session #{session_id}, cooling session for {seconds}s")
                    break
