import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")
    JWT_SECRET = os.environ.get("JWT_SECRET", SECRET_KEY)
    JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.environ.get("JWT_ACCESS_TOKEN_HOURS", "1")))

    SQLALCHEMY_DATABASE_URI = os.environ.get("BP_POSTGRES_DATABASE_URI") or os.environ.get("BP_SQLALCHEMY_DATABASE_URI")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # MTN MoMo Collections API (Sandbox)
    MOMO_BASE_URL = os.environ.get("MOMO_BASE_URL", "https://sandbox.momodeveloper.mtn.com")
    MOMO_SUBSCRIPTION_KEY = os.environ.get("MOMO_SUBSCRIPTION_KEY", "")
    MOMO_API_USER = os.environ.get("MOMO_API_USER", "")
    MOMO_API_KEY = os.environ.get("MOMO_API_KEY", "")
    MOMO_ENVIRONMENT = os.environ.get("MOMO_ENVIRONMENT", "sandbox")
    MOMO_CURRENCY = os.environ.get("MOMO_CURRENCY", "EUR")  # sandbox only supports EUR
