from curl_cffi import requests
from fastapi import HTTPException
import os
import random
import logging
from dotenv import load_dotenv

from .session_pool import SessionPool
from .rate_limit import RateLimitBudget

load_dotenv()
logger = logging.getLogger(__name__)

# Parse proxy list from env.
proxy_env = os.getenv("PROXY_LIST", "")
PROXY_LIST = [p.strip() for p in proxy_env.split(",") if p.strip()]

def get_random_proxy():
    if not PROXY_LIST:
        return None
    return random.choice(PROXY_LIST)

def validate_response(response, item_type="unknown"):
    """
    Soft-block / honeypot detection.
    Raises ValueError if blocked.
    """
    if response.status_code == 200:
        if len(response.content) < 100:
            raise ValueError(f"Empty/Honeypot response (size {len(response.content)})")
        
        try:
            data = response.json()
            if "data" not in data and not isinstance(data, list):
                if "error" not in data: # error key might be legitimate banned response
                    raise ValueError("JSON missing 'data' key")
        except Exception:
            pass # Maybe not JSON, that's fine if it's the HTML stealth check

        # Response time check (under 50ms implies cache/block for .json endpoints)
        if response.elapsed.total_seconds() < 0.05:
            raise ValueError("Response unusually fast (< 50ms)")
            
    return True

def do_fetch(url, etag=None):
    proxy = get_random_proxy()
    proxies = {"http": proxy, "https": proxy} if proxy else None
    
    budget = RateLimitBudget()
    budget.acquire()
    
    pool = SessionPool()
    wrapped_session = pool.get_session()
    
    headers = {}
    if etag:
        headers["If-None-Match"] = etag

    try:
        response = wrapped_session.session.get(
            url, 
            proxies=proxies, 
            timeout=10, 
            headers=headers
        )
        
        if response.status_code == 429:
            budget.penalise()
            raise HTTPException(status_code=429, detail="Rate limited by Reddit")

        if response.status_code != 304:
            validate_response(response)
            
        return response, wrapped_session.session_id
        
    except ValueError as ve:
        # Soft-block detected
        pool.cooldown_session(wrapped_session.session_id, seconds=90)
        # Increment redis counter
        if budget.use_redis:
            import redis
            redis_client = redis.from_url(os.getenv("REDIS_URL"))
            redis_client.incr("stats:soft_blocks")
        logger.warning(f"[SOFTBLOCK] Detected for {url}, cooling session #{wrapped_session.session_id} ({ve})")
        raise HTTPException(status_code=403, detail="Soft-block detected")
    except requests.errors.RequestsError as e:
        logger.error(f"Proxy Connection Error: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Proxy Connection Error: {str(e)}")
    except Exception as e:
        logger.error(f"Internal Error in fetch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")


def check_reddit_url(url: str, etag: str = None):
    """Stealth checks a Reddit post/comment URL."""
    try:
        response, _ = do_fetch(url, etag)
        status_code = response.status_code
        
        if status_code == 304:
            return {"status": "unchanged", "code": 304, "message": "[SKIP] 304 Not Modified"}

        html_content = response.text.lower()
        is_deleted = "[deleted]" in html_content or "[removed]" in html_content or "sorry, this post was removed by reddit's spam filters" in html_content

        if status_code == 200 and not is_deleted:
            return {"status": "live", "code": 200, "message": "[!SUCCESS] Live", "etag": response.headers.get("etag"), "last_modified": response.headers.get("last-modified")}
        elif status_code == 404 or is_deleted:
            return {"status": "removed", "code": 404, "message": "WARNING: Removed / Deleted"}
        elif status_code == 403:
            return {"status": "blocked", "code": 403, "message": "CAUTION: Blocked (Proxy failed)"}
        else:
             return {"status": "unknown", "code": status_code, "message": f"Unknown Status: {status_code}"}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

def check_reddit_user(username: str, etag: str = None):
    """
    Fetches user details, posts, and comments from Reddit's JSON endpoints.
    """
    about_url = f"https://www.reddit.com/user/{username}/about.json"
    posts_url = f"https://www.reddit.com/user/{username}/submitted.json?limit=10"
    comments_url = f"https://www.reddit.com/user/{username}/comments.json?limit=10"

    try:
        # 1. Fetch About (Profile Data)
        response, _ = do_fetch(about_url, etag)
        status_code = response.status_code
        
        if status_code == 304:
            return {"status": "unchanged", "code": 304}
            
        if status_code == 200:
            try:
                data = response.json()
            except Exception:
                return {"status": "blocked", "is_live": False, "raw_data": None}

            if "error" in data:
                 return {"status": "banned", "is_live": False, "raw_data": data}
                 
            user_data = data.get("data", {})
            if user_data.get("is_suspended", False):
                 return {"status": "banned", "is_live": False, "raw_data": user_data}
            
            # 2. Fetch Recent Posts
            recent_posts = []
            try:
                posts_resp, _ = do_fetch(posts_url)
                if posts_resp.status_code == 200:
                    posts_data = posts_resp.json()
                    for child in posts_data.get("data", {}).get("children", []):
                        d = child.get("data", {})
                        recent_posts.append({
                            "id": d.get("id"),
                            "url": "https://www.reddit.com" + d.get("permalink", ""),
                            "title": d.get("title"),
                            "ups": d.get("ups")
                        })
            except Exception:
                pass

            # 3. Fetch Recent Comments
            recent_comments = []
            try:
                comments_resp, _ = do_fetch(comments_url)
                if comments_resp.status_code == 200:
                    comments_data = comments_resp.json()
                    for child in comments_data.get("data", {}).get("children", []):
                        d = child.get("data", {})
                        recent_comments.append({
                            "id": d.get("id"),
                            "url": "https://www.reddit.com" + d.get("permalink", ""),
                            "body": d.get("body", "")[:100] + "...",
                            "ups": d.get("ups")
                        })
            except Exception:
                pass

            user_data["recent_posts"] = recent_posts
            user_data["recent_comments"] = recent_comments

            return {
                "status": "live", 
                "is_live": True, 
                "raw_data": user_data,
                "etag": response.headers.get("etag"),
                "last_modified": response.headers.get("last-modified")
            }
            
        elif status_code == 404:
            return {"status": "banned", "is_live": False, "raw_data": None}
        elif status_code == 403:
             raise HTTPException(status_code=403, detail="CAUTION: Blocked by Reddit")
        else:
            return {"status": "unknown", "is_live": False, "raw_data": None}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

def get_post_details(url: str, etag: str = None):
    """
    Fetches the full JSON details of a Reddit post or comment.
    """
    base_url = url.split('?')[0].rstrip('/')
    json_url = f"{base_url}.json"
    
    try:
        response, _ = do_fetch(json_url, etag)
        
        if response.status_code == 304:
            return {"status": "unchanged", "code": 304}
            
        if response.status_code != 200:
            return {"status": "error", "code": response.status_code}
            
        data = response.json()
        if isinstance(data, list) and len(data) >= 2:
            post_data = data[0].get("data", {}).get("children", [{}])[0].get("data", {})
            comments_data = data[1].get("data", {}).get("children", [])
            
            is_comment = len(base_url.split('/')) >= 9
            
            result = {
                "status": "success",
                "code": 200,
                "etag": response.headers.get("etag"),
                "last_modified": response.headers.get("last-modified")
            }
            
            if is_comment and comments_data:
                target_data = comments_data[0].get("data", {})
                result.update({
                    "author": target_data.get("author"),
                    "title": "Comment on: " + post_data.get("title", ""),
                    "body": target_data.get("body"),
                    "subreddit": target_data.get("subreddit"),
                    "ups": target_data.get("ups"),
                    "num_comments": 0,
                    "comments": []
                })
            else:
                result.update({
                    "author": post_data.get("author"),
                    "title": post_data.get("title"),
                    "body": post_data.get("selftext"),
                    "subreddit": post_data.get("subreddit"),
                    "ups": post_data.get("ups"),
                    "num_comments": post_data.get("num_comments"),
                    "comments": comments_data
                })
            return result
        else:
            return {"status": "success", "code": 200, "data": data, "etag": response.headers.get("etag"), "last_modified": response.headers.get("last-modified")}
            
    except HTTPException as he:
        raise he
    except Exception as e:
        return {"status": "error", "message": str(e)}
