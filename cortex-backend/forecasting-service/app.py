import os, uvicorn

if __name__ == "__main__":
    if os.path.exists(".env"):
        for line in open(".env"):
            if not line.strip() or line.strip().startswith("#") or "=" not in line: continue
            k, v = line.strip().split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))
            
    from app.main import app
    kwargs = {"host": os.getenv("HOST", "0.0.0.0"), "port": int(os.getenv("PORT", 3005))}
 
    if os.getenv("ENABLE_HTTPS", "false").lower() == "true":
        ssl_dir = os.path.join(os.path.dirname(__file__), os.getenv("SSL_FILE_PATH", "cert/"))
        kwargs.update(ssl_keyfile=os.path.join(ssl_dir, "key.pem"), ssl_certfile=os.path.join(ssl_dir, "cert.pem"))
        
    uvicorn.run(app, **kwargs)