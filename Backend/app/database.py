import os
import urllib.parse

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_NAME = os.getenv("DB_NAME", "GatePassDB")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
# SQL login (e.g. a Docker SQL Server on macOS/Linux). Leave empty to use Windows auth.
DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

if DB_USER:
    _auth = f"UID={DB_USER};PWD={{{DB_PASSWORD.replace('}', '}}')}}};TrustServerCertificate=yes;"
else:
    _auth = "Trusted_Connection=yes;"

_odbc_params = urllib.parse.quote_plus(
    f"DRIVER={{{DB_DRIVER}}};"
    f"SERVER={DB_SERVER};"
    f"DATABASE={DB_NAME};"
    + _auth
)

DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={_odbc_params}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
