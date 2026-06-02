import random

# List of 8 modern Chrome UA strings paired with Accept-Language headers
UA_POOL = [
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "lang": "en-US,en;q=0.9"
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "lang": "en-GB,en;q=0.8"
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "lang": "en-CA,en;q=0.7"
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "lang": "en-US,en;q=0.9,es;q=0.8"
    },
    {
        "ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "lang": "en-US,en;q=0.9"
    },
    {
        "ua": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "lang": "en-GB,en-US;q=0.9,en;q=0.8"
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "lang": "en-AU,en;q=0.9"
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "lang": "en-US,en;q=0.8"
    }
]

class UAPool:
    def __init__(self):
        self._pool = []
        self._reshuffle()

    def _reshuffle(self):
        self._pool = list(UA_POOL)
        random.shuffle(self._pool)

    def get_random(self):
        if not self._pool:
            self._reshuffle()
        return self._pool.pop()
