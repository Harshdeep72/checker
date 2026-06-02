import os
import glob

files = glob.glob("/home/harshdeep/projects/redditchecker/frontend/src/**/*.jsx", recursive=True)
for file in files:
    with open(file, "r") as f:
        content = f.read()
    if "http://localhost:8000" in content:
        new_content = content.replace("\"http://localhost:8000", "(import.meta.env.VITE_API_URL || \"http://localhost:8000\") + \"")
        new_content = new_content.replace("`http://localhost:8000", "`${import.meta.env.VITE_API_URL || \"http://localhost:8000\"}")
        new_content = new_content.replace("'http://localhost:8000", "(import.meta.env.VITE_API_URL || \"http://localhost:8000\") + '")
        with open(file, "w") as f:
            f.write(new_content)
        print(f"Updated {file}")
