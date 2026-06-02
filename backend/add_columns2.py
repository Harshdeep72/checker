from database.database import engine
from sqlalchemy import text

def add_columns():
    with engine.begin() as con:
        try:
            con.execute(text("ALTER TABLE posts ADD COLUMN subreddit VARCHAR(255)"))
            print("Added subreddit to posts")
        except Exception as e:
            print("Error adding to posts:", e)
            
        try:
            con.execute(text("ALTER TABLE comments ADD COLUMN subreddit VARCHAR(255)"))
            print("Added subreddit to comments")
        except Exception as e:
            print("Error adding to comments:", e)

if __name__ == "__main__":
    add_columns()
