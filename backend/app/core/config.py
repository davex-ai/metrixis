from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://metrixis:metrixis@localhost:5432/metrixis"

    # Must match JWT_SECRET in auth-service/.env exactly — tokens are
    # issued there and verified here, no network call between the two.
    jwt_secret: str = "change-me-to-a-long-random-string"
    jwt_algorithm: str = "HS256"

    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
