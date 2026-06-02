from curl_cffi import requests
from fastapi import HTTPException
import os
import random
from dotenv import load_dotenv

load_dotenv()

# Mock proxy list for development.
PROXY_LIST = []

# Support both REDDIT_SESSION_COOKIE and REDDIT_COOKIE env var names
REDDIT_SESSION_COOKIE = os.getenv("REDDIT_SESSION_COOKIE") or os.getenv("REDDIT_COOKIE", "")

def get_random_proxy():
    if not PROXY_LIST:
        return None
    return random.choice(PROXY_LIST)

def get_stealth_headers(include_cookie=False):
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
    }
    if include_cookie and REDDIT_SESSION_COOKIE:
        headers["Cookie"] = f"reddit_session={REDDIT_SESSION_COOKIE}"
    return headers

def check_reddit_url(url: str):
    """Stealth checks a Reddit post/comment URL."""
    proxy = get_random_proxy()
    proxies = {"http": proxy, "https": proxy} if proxy else None

    try:
        response = requests.get(
            url,
            impersonate="chrome110",
            proxies=proxies,
            timeout=10,
            headers=get_stealth_headers(include_cookie=False)
        )
        status_code = response.status_code
        html_content = response.text.lower()
        is_deleted = "[deleted]" in html_content or "[removed]" in html_content or "sorry, this post was removed by reddit's spam filters" in html_content

        if status_code == 200 and not is_deleted:
            return {"status": "live", "code": 200, "message": "[!SUCCESS] Live"}
        elif status_code == 404 or is_deleted:
            return {"status": "removed", "code": 404, "message": "WARNING: Removed / Deleted"}
        elif status_code == 403:
            return {"status": "blocked", "code": 403, "message": "CAUTION: Blocked (Proxy failed)"}
        else:
             return {"status": "unknown", "code": status_code, "message": f"Unknown Status: {status_code}"}

    except requests.errors.RequestsError as e:
        print("Proxy Connection Error:", str(e))
        raise HTTPException(status_code=503, detail=f"Proxy Connection Error: {str(e)}")
    except Exception as e:
        print("Internal Error in check_reddit_url:", str(e))
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

def check_reddit_user(username: str):
    """
    Fetches user details, posts, and comments from Reddit's JSON endpoints using curl_cffi and a session cookie.
    """
    proxy = get_random_proxy()
    proxies = {"http": proxy, "https": proxy} if proxy else None
    
    about_url = f"https://www.reddit.com/user/{username}/about.json"
    posts_url = f"https://www.reddit.com/user/{username}/submitted.json?limit=10"
    comments_url = f"https://www.reddit.com/user/{username}/comments.json?limit=10"

    try:
        headers = get_stealth_headers(include_cookie=True)
        
        # 1. Fetch About (Profile Data)
        response = requests.get(about_url, impersonate="chrome110", proxies=proxies, timeout=10, headers=headers)
        status_code = response.status_code
        
        if status_code == 200:
            try:
                data = response.json()
            except Exception:
                # If Reddit returned HTML instead of JSON on a 200 OK (e.g., cloudflare block)
                return {"status": "blocked", "is_live": False, "raw_data": None}

            if "error" in data:
                 return {"status": "banned", "is_live": False, "raw_data": data}
                 
            user_data = data.get("data", {})
            if user_data.get("is_suspended", False):
                 return {"status": "banned", "is_live": False, "raw_data": user_data}
            
            # 2. Fetch Recent Posts
            recent_posts = []
            try:
                posts_resp = requests.get(posts_url, impersonate="chrome110", proxies=proxies, timeout=10, headers=headers)
                if posts_resp.status_code == 200:
                    try:
                        posts_data = posts_resp.json()
                    except Exception:
                        posts_data = {}
                    for child in posts_data.get("data", {}).get("children", []):
                        d = child.get("data", {})
                        recent_posts.append({
                            "id": d.get("id"),
                            "url": "https://www.reddit.com" + d.get("permalink", ""),
                            "title": d.get("title"),
                            "ups": d.get("ups")
                        })
            except Exception:
                pass # Ignore errors on fetching posts

            # 3. Fetch Recent Comments
            recent_comments = []
            try:
                comments_resp = requests.get(comments_url, impersonate="chrome110", proxies=proxies, timeout=10, headers=headers)
                if comments_resp.status_code == 200:
                    try:
                        comments_data = comments_resp.json()
                    except Exception:
                        comments_data = {}
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

            return {"status": "live", "is_live": True, "raw_data": user_data}
            
        elif status_code == 404:
            return {"status": "banned", "is_live": False, "raw_data": None}
        elif status_code == 403:
             raise HTTPException(status_code=403, detail="CAUTION: Blocked by Reddit (Cookie might be invalid or proxy blocked)")
        else:
            return {"status": "unknown", "is_live": False, "raw_data": None}

    except requests.errors.RequestsError as e:
        print("Proxy Connection Error:", str(e))
        raise HTTPException(status_code=503, detail=f"Proxy Connection Error: {str(e)}")
    except Exception as e:
        print("Internal Error in check_reddit_user:", str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

def get_post_details(url: str):
    """
    Fetches the full JSON details of a Reddit post or comment, including the comment tree.
    """
    proxy = get_random_proxy()
    proxies = {"http": proxy, "https": proxy} if proxy else None
    
    # Ensure url ends with .json
    base_url = url.split('?')[0].rstrip('/')
    json_url = f"{base_url}.json"
    
    try:
        headers = get_stealth_headers(include_cookie=True)
        response = requests.get(json_url, impersonate="chrome110", proxies=proxies, timeout=10, headers=headers)
        if response.status_code != 200:
            return {"status": "error", "code": response.status_code}
            
        data = response.json()
        if isinstance(data, list) and len(data) >= 2:
            post_data = data[0].get("data", {}).get("children", [{}])[0].get("data", {})
            comments_data = data[1].get("data", {}).get("children", [])
            
            is_comment = len(base_url.split('/')) >= 9
            
            if is_comment and comments_data:
                target_data = comments_data[0].get("data", {})
                return {
                    "status": "success",
                    "code": 200,
                    "author": target_data.get("author"),
                    "title": "Comment on: " + post_data.get("title", ""),
                    "body": target_data.get("body"),
                    "subreddit": target_data.get("subreddit"),
                    "ups": target_data.get("ups"),
                    "num_comments": 0,
                    "comments": []
                }
            else:
                return {
                    "status": "success",
                    "code": 200,
                    "author": post_data.get("author"),
                    "title": post_data.get("title"),
                    "body": post_data.get("selftext"),
                    "subreddit": post_data.get("subreddit"),
                    "ups": post_data.get("ups"),
                    "num_comments": post_data.get("num_comments"),
                    "comments": comments_data
                }
        else:
            # Maybe it's a single item
            return {"status": "success", "code": 200, "data": data}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
