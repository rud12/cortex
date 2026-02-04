import os
from pathlib import Path
import uvicorn
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from app.main import app

if __name__ == "__main__":
    opts = {
        "app": "app.main:app",
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": int(os.getenv("PORT", "3004")),
    }
    if os.getenv("ENABLE_HTTPS", "false").lower() == "true":
        base_dir = Path(__file__).resolve().parent
        ssl_dir = os.getenv("SSL_FILE_PATH", "cert/")
        opts.update({"ssl_keyfile": str(base_dir / ssl_dir / "key.pem"), "ssl_certfile": str(base_dir / ssl_dir / "cert.pem")})
    uvicorn.run(**opts)
