import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv('DATABASE_URL', '')
    node_env: str = os.getenv('NODE_ENV', 'development')


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
