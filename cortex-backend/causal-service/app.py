import os
from pathlib import Path

import uvicorn


def _load_env_file(path: Path) -> None:
    if not path.exists() or not path.is_file():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file(Path(__file__).resolve().parent / '.env')

from app.main import app


if __name__ == '__main__':
    enable_https = os.getenv('ENABLE_HTTPS', 'false').lower() == 'true'
    uvicorn_config = {
        'app': 'app.main:app',
        'host': os.getenv('HOST', '0.0.0.0'),
        'port': int(os.getenv('PORT', '3010')),
    }

    if enable_https:
        base_dir = Path(__file__).resolve().parent
        ssl_dir = os.getenv('SSL_FILE_PATH', '../')
        key_path = (base_dir / ssl_dir / 'key.pem').resolve()
        cert_path = (base_dir / ssl_dir / 'cert.pem').resolve()
        uvicorn_config.update({
            'ssl_keyfile': str(key_path),
            'ssl_certfile': str(cert_path),
        })

    uvicorn.run(**uvicorn_config)
