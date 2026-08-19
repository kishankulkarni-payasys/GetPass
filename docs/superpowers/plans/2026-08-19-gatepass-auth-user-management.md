# GatePass Authentication & User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login (JWT in an HTTP-only cookie), Admin/Security Guard roles, and full user CRUD on top of the existing GatePass vehicle-entry API and UI, per `docs/superpowers/specs/2026-08-19-gatepass-auth-user-management-design.md`.

**Architecture:** Extends the existing FastAPI backend with `app/auth.py` (hashing + JWT + dependencies), a `users` table, and two new routers (`auth`, `users`); the existing `entries` router gets a router-level auth dependency. The frontend gains `react-router-dom`, an `AuthContext`, a login page, and an Admin-only user management page.

**Tech Stack:** `bcrypt` (password hashing), `pyjwt` (tokens) added to the backend; `react-router-dom` added to the frontend. No other new technology.

## Global Constraints

- Roles are exactly two string values used verbatim everywhere: `"admin"` and `"security_guard"`.
- JWT cookie name is `access_token`, `httponly=True`, `samesite="lax"`, `secure=False` (local HTTP dev), 8-hour expiry (`ACCESS_TOKEN_EXPIRE_HOURS = 8`).
- All `/api/entries/*` endpoints require a logged-in user of either role (enforced via a router-level dependency, not per-endpoint).
- All `/api/users/*` endpoints require the `admin` role (enforced via a router-level dependency).
- An admin can never deactivate (`is_active=false`) or delete their own account — both return `400`.
- Login failure returns a generic `401` message ("Invalid username or password") — never reveal whether the username or the password was wrong.
- Startup bootstrap creates exactly one Admin user, and only when the `users` table is completely empty; it is a no-op on every subsequent startup.
- No automated test suite — verification is manual/curl-based, matching the existing project convention.
- Frontend is plain JavaScript (not TypeScript), Tailwind CSS, fully responsive — matching the existing codebase.

---

### Task 1: Backend Auth Dependencies + Environment Variables

**Files:**
- Modify: `Backend/requirements.txt`
- Modify: `Backend/.env.example`
- Modify: `Backend/.env` (not committed — gitignored)

**Interfaces:**
- Produces: `bcrypt` and `pyjwt` installed in the venv; `SECRET_KEY`, `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_PASSWORD` available as env vars for later tasks (`app/auth.py` reads `SECRET_KEY`; `app/main.py`'s bootstrap reads the admin username/password).

- [ ] **Step 1: Update `Backend/requirements.txt`**

Change from:
```
fastapi>=0.115
uvicorn[standard]>=0.32
sqlalchemy>=2.0
pyodbc>=5.1
python-dotenv>=1.0
```
to:
```
fastapi>=0.115
uvicorn[standard]>=0.32
sqlalchemy>=2.0
pyodbc>=5.1
python-dotenv>=1.0
bcrypt>=4.2
pyjwt>=2.9
```

- [ ] **Step 2: Update `Backend/.env.example`**

Change from:
```
DB_SERVER=(localdb)\MSSQLLocalDB
DB_NAME=GatePassDB
DB_DRIVER=ODBC Driver 17 for SQL Server
```
to:
```
DB_SERVER=(localdb)\MSSQLLocalDB
DB_NAME=GatePassDB
DB_DRIVER=ODBC Driver 17 for SQL Server
SECRET_KEY=change-this-to-a-random-secret-in-your-local-env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=ChangeMe123!
```

- [ ] **Step 3: Add the same three new lines to `Backend/.env`**

Append to the existing `Backend/.env` (do not remove the existing `DB_SERVER`/`DB_NAME`/`DB_DRIVER` lines):
```
SECRET_KEY=change-this-to-a-random-secret-in-your-local-env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=ChangeMe123!
```

- [ ] **Step 4: Install the new dependencies**

Run (from `Backend/`, venv activated):
```powershell
.\venv\Scripts\pip.exe install -r requirements.txt
.\venv\Scripts\python.exe -c "import bcrypt, jwt; print('auth deps ok')"
```
Expected output: `auth deps ok`

- [ ] **Step 5: Commit**

```bash
git add Backend/requirements.txt Backend/.env.example
git commit -m "chore(backend): add bcrypt/pyjwt dependencies and auth env vars"
```
(`Backend/.env` is gitignored and intentionally not committed.)

---

### Task 2: User Model + Schemas

**Files:**
- Modify: `Backend/app/models.py`
- Modify: `Backend/app/schemas.py`

**Interfaces:**
- Produces: `User` ORM class (table `users`); `LoginRequest`, `UserCreate`, `UserUpdate`, `UserOut` Pydantic schemas — consumed by `app/auth.py` (Task 3), `app/routers/auth.py` (Task 4), `app/routers/users.py` (Task 5), and `app/main.py`'s bootstrap (Task 4).

- [ ] **Step 1: Update the import line and append `User` in `Backend/app/models.py`**

Change the import line from:
```python
from sqlalchemy import Column, DateTime, Integer, Numeric, String
```
to:
```python
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String
```

Append this class at the end of the file:
```python
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(60), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
```

- [ ] **Step 2: Update the import line and append schemas in `Backend/app/schemas.py`**

Change the import line from:
```python
from typing import Optional
```
to:
```python
from typing import Literal, Optional
```

Append at the end of the file:
```python
Role = Literal["admin", "security_guard"]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: Role


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime
```

- [ ] **Step 3: Verify imports**

Run (from `Backend/`, venv activated):
```powershell
.\venv\Scripts\python.exe -c "from app.models import User; from app.schemas import LoginRequest, UserCreate, UserUpdate, UserOut; print('user model+schemas ok')"
```
Expected output: `user model+schemas ok`

- [ ] **Step 4: Commit**

```bash
git add Backend/app/models.py Backend/app/schemas.py
git commit -m "feat(backend): add User model and auth-related schemas"
```

---

### Task 3: Auth Utilities Module

**Files:**
- Create: `Backend/app/auth.py`

**Interfaces:**
- Consumes: `User` (Task 2), `get_db` (existing, from `app/database.py`), `SECRET_KEY` env var (Task 1).
- Produces: `hash_password(password: str) -> str`, `verify_password(password: str, password_hash: str) -> bool`, `create_access_token(user_id: int, role: str) -> str`, `get_current_user(...) -> User` (FastAPI dependency), `require_admin(...) -> User` (FastAPI dependency), and constants `COOKIE_NAME = "access_token"`, `ACCESS_TOKEN_EXPIRE_HOURS = 8` — consumed by `app/routers/auth.py` (Task 4), `app/routers/users.py` (Task 5), `app/routers/entries.py` (Task 4), and `app/main.py`'s bootstrap (Task 4).

- [ ] **Step 1: Create `Backend/app/auth.py`**

```python
import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8
COOKIE_NAME = "access_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

- [ ] **Step 2: Verify the hashing and token round-trip**

Run (from `Backend/`, venv activated):
```bash
./venv/Scripts/python.exe -c "
from app.auth import hash_password, verify_password, create_access_token
import jwt, os
h = hash_password('secret123')
assert verify_password('secret123', h)
assert not verify_password('wrong', h)
token = create_access_token(1, 'admin')
payload = jwt.decode(token, os.getenv('SECRET_KEY', 'dev-only-insecure-secret-change-me'), algorithms=['HS256'])
assert payload['sub'] == '1' and payload['role'] == 'admin'
print('auth utils ok')
"
```
Expected output: `auth utils ok`

- [ ] **Step 3: Commit**

```bash
git add Backend/app/auth.py
git commit -m "feat(backend): add password hashing, JWT, and auth dependencies"
```

---

### Task 4: Auth Router, Protected Entries, Startup Bootstrap

**Files:**
- Create: `Backend/app/routers/auth.py`
- Modify: `Backend/app/routers/entries.py`
- Modify: `Backend/app/main.py`

**Interfaces:**
- Consumes: `COOKIE_NAME`, `ACCESS_TOKEN_EXPIRE_HOURS`, `create_access_token`, `get_current_user`, `verify_password`, `hash_password` (Task 3); `User` (Task 2); `LoginRequest`, `UserOut` (Task 2).
- Produces: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; `/api/entries/*` now requires authentication; a bootstrap Admin user created on first startup.

- [ ] **Step 1: Create `Backend/app/routers/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    COOKIE_NAME,
    create_access_token,
    get_current_user,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(credentials: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not user.is_active or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user.id, user.role)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 2: Protect the entries router in `Backend/app/routers/entries.py`**

Change the import block from:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import VehicleEntry
from app.schemas import VehicleEntryCreate, VehicleEntryOut

router = APIRouter(prefix="/api/entries", tags=["entries"])
```
to:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import VehicleEntry
from app.schemas import VehicleEntryCreate, VehicleEntryOut

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(get_current_user)])
```

Leave every endpoint function in this file exactly as-is — the router-level `dependencies=` applies to all of them without touching each function signature.

- [ ] **Step 3: Add the startup bootstrap and wire the auth router in `Backend/app/main.py`**

Replace the full file with:
```python
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import auth, entries

app = FastAPI(title="GatePass API")

Base.metadata.create_all(bind=engine)


def _bootstrap_admin():
    db = SessionLocal()
    try:
        if db.query(User).first() is None:
            admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
            admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "ChangeMe123!")
            admin = User(
                username=admin_username,
                password_hash=hash_password(admin_password),
                full_name="Default Admin",
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"Created default admin user '{admin_username}' - change this password immediately.")
    finally:
        db.close()


_bootstrap_admin()

app.include_router(auth.router)
app.include_router(entries.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 4: Start the server and verify login + protected entries**

Run (from `Backend/`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8000
```
Expected startup log includes: `Created default admin user 'admin' - change this password immediately.`

In a separate terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/entries
```
Expected output: `401` (no cookie yet)

```bash
curl -s -c /tmp/gatepass_cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}'
```
Expected output: a JSON user object with `"username":"admin"`, `"role":"admin"`, `"is_active":true`, and no password field.

```bash
curl -s -b /tmp/gatepass_cookies.txt http://localhost:8000/api/auth/me
```
Expected output: the same admin user JSON.

```bash
curl -s -b /tmp/gatepass_cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/entries
```
Expected output: `200`

```bash
curl -s -X POST http://localhost:8000/api/auth/logout -b /tmp/gatepass_cookies.txt -c /tmp/gatepass_cookies.txt
curl -s -b /tmp/gatepass_cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/entries
```
Expected output: `{"detail":"Logged out"}` followed by `401`

Stop the server (Ctrl+C) once verified.

- [ ] **Step 5: Commit**

```bash
git add Backend/app/routers/auth.py Backend/app/routers/entries.py Backend/app/main.py
git commit -m "feat(backend): add login/logout/me endpoints, protect entries, bootstrap admin"
```

---

### Task 5: Users Router (Admin-Only CRUD)

**Files:**
- Create: `Backend/app/routers/users.py`
- Modify: `Backend/app/main.py`

**Interfaces:**
- Consumes: `hash_password`, `require_admin` (Task 3); `User` (Task 2); `UserCreate`, `UserOut`, `UserUpdate` (Task 2).
- Produces: `POST/GET /api/users`, `GET/PATCH/DELETE /api/users/{id}`, all admin-only.

- [ ] **Step 1: Create `Backend/app/routers/users.py`**

```python
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.database import get_db
from app.models import User
from app.schemas import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.username).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None
```

- [ ] **Step 2: Wire the users router into `Backend/app/main.py`**

Change:
```python
from app.routers import auth, entries
```
to:
```python
from app.routers import auth, entries, users
```

Change:
```python
app.include_router(auth.router)
app.include_router(entries.router)
```
to:
```python
app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(users.router)
```

- [ ] **Step 3: Verify user CRUD, role enforcement, and self-protection**

Run (from `Backend/`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8000
```

In a separate terminal, log in as admin and capture the cookie:
```bash
curl -s -c /tmp/gatepass_cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' > /dev/null
```

Create a guard user:
```bash
curl -s -b /tmp/gatepass_cookies.txt -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"guard1","password":"GuardPass123!","full_name":"Suresh Patil","role":"security_guard"}'
```
Expected output: a JSON user with `"username":"guard1"`, `"role":"security_guard"`, `"is_active":true`. Note the returned `"id"` (call it `GUARD_ID`).

List users:
```bash
curl -s -b /tmp/gatepass_cookies.txt http://localhost:8000/api/users
```
Expected output: a JSON array containing both `admin` and `guard1`.

Attempt to create a duplicate username:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/gatepass_cookies.txt -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"guard1","password":"Whatever123!","full_name":"Duplicate","role":"security_guard"}'
```
Expected output: `409`

Attempt to deactivate your own (admin) account — replace `1` with the admin's actual id if different:
```bash
curl -s -b /tmp/gatepass_cookies.txt -X PATCH http://localhost:8000/api/users/1 \
  -H "Content-Type: application/json" -d '{"is_active": false}'
```
Expected output: `{"detail":"You cannot deactivate your own account"}`

Attempt to delete your own account:
```bash
curl -s -b /tmp/gatepass_cookies.txt -X DELETE http://localhost:8000/api/users/1
```
Expected output: `{"detail":"You cannot delete your own account"}`

Log in as the guard and confirm `/api/users` is forbidden:
```bash
curl -s -c /tmp/gatepass_guard_cookies.txt -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"guard1","password":"GuardPass123!"}' > /dev/null
curl -s -b /tmp/gatepass_guard_cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/users
```
Expected output: `403`

Confirm the guard can still use entries:
```bash
curl -s -b /tmp/gatepass_guard_cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/entries
```
Expected output: `200`

Clean up the test guard account (replace `GUARD_ID` with the id noted above):
```bash
curl -s -b /tmp/gatepass_cookies.txt -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8000/api/users/GUARD_ID
```
Expected output: `204`

Stop the server (Ctrl+C) once verified.

- [ ] **Step 4: Commit**

```bash
git add Backend/app/routers/users.py Backend/app/main.py
git commit -m "feat(backend): add admin-only user CRUD with self-protection"
```

---

### Task 6: `react-router-dom` + AuthContext

**Files:**
- Modify: `Frontend/package.json`
- Create: `Frontend/src/context/AuthContext.jsx`

**Interfaces:**
- Consumes: `apiClient` (existing, from `src/api/client.js`).
- Produces: `AuthProvider` component; `useAuth()` hook returning `{ user, loading, login(username, password), logout() }` — consumed by `App.jsx`, `ProtectedRoute`, `NavBar`, `LoginPage`, `UsersPage` (Tasks 7, 8, 10, 11).

- [ ] **Step 1: Add `react-router-dom` to `Frontend/package.json`**

Change the `dependencies` block from:
```json
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.7"
  },
```
to:
```json
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.7",
    "react-router-dom": "^6.27.0"
  },
```

- [ ] **Step 2: Install it**

Run (from `Frontend/`):
```powershell
npm install
```
Expected: installs `react-router-dom` and its dependencies with no errors.

- [ ] **Step 3: Create `Frontend/src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import apiClient from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password })
    setUser(response.data)
    return response.data
  }

  const logout = async () => {
    await apiClient.post('/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: Syntax-check the new file**

This file isn't imported anywhere yet, so `npm run build` won't parse it. Run (from `Frontend/`):
```bash
npx esbuild src/context/AuthContext.jsx > /dev/null && echo "syntax ok"
```
Expected output: `syntax ok`

- [ ] **Step 5: Commit**

```bash
git add Frontend/package.json Frontend/package-lock.json Frontend/src/context/AuthContext.jsx
git commit -m "feat(frontend): add react-router-dom and AuthContext"
```

---

### Task 7: ProtectedRoute + NavBar

**Files:**
- Create: `Frontend/src/components/ProtectedRoute.jsx`
- Create: `Frontend/src/components/NavBar.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 6); `Navigate`, `Link` (from `react-router-dom`, Task 6).
- Produces: `<ProtectedRoute adminOnly?>{children}</ProtectedRoute>`, `<NavBar />` — consumed by `App.jsx` (Task 11).

- [ ] **Step 1: Create `Frontend/src/components/ProtectedRoute.jsx`**

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-6 text-gray-500">Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/entries" replace />

  return children
}
```

- [ ] **Step 2: Create `Frontend/src/components/NavBar.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
      <div className="flex flex-wrap gap-4">
        <Link to="/entries" className="font-medium text-gray-700 hover:text-blue-600">
          Entries
        </Link>
        {user.role === 'admin' && (
          <Link to="/users" className="font-medium text-gray-700 hover:text-blue-600">
            Users
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>{user.full_name} ({user.role})</span>
        <button onClick={logout} className="rounded bg-gray-200 px-3 py-1 font-medium text-gray-800">
          Logout
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Syntax-check both files**

Run (from `Frontend/`):
```bash
npx esbuild src/components/ProtectedRoute.jsx > /dev/null && npx esbuild src/components/NavBar.jsx > /dev/null && echo "syntax ok"
```
Expected output: `syntax ok`

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/ProtectedRoute.jsx Frontend/src/components/NavBar.jsx
git commit -m "feat(frontend): add ProtectedRoute and NavBar components"
```

---

### Task 8: LoginPage

**Files:**
- Create: `Frontend/src/pages/LoginPage.jsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 6); `Navigate`, `useNavigate` (`react-router-dom`).
- Produces: `<LoginPage />` — consumed by `App.jsx` (Task 11).

- [ ] **Step 1: Create `Frontend/src/pages/LoginPage.jsx`**

```jsx
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/entries" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/entries')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">GatePass Login</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-gray-200 p-6">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Syntax-check the file**

Run (from `Frontend/`):
```bash
npx esbuild src/pages/LoginPage.jsx > /dev/null && echo "syntax ok"
```
Expected output: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/LoginPage.jsx
git commit -m "feat(frontend): add LoginPage"
```

---

### Task 9: EntriesPage

**Files:**
- Create: `Frontend/src/pages/EntriesPage.jsx`

**Interfaces:**
- Consumes: `EntryForm`, `EntryTable` (existing), `useEntries` (existing).
- Produces: `<EntriesPage />` — consumed by `App.jsx` (Task 11).

- [ ] **Step 1: Create `Frontend/src/pages/EntriesPage.jsx`**

```jsx
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import { useEntries } from '../hooks/useEntries'

export default function EntriesPage() {
  const { entries, loading, error, addEntry, markExit } = useEntries()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Vehicle Entry Log</h1>
      <div className="mb-8">
        <EntryForm onSubmit={addEntry} />
      </div>
      <EntryTable entries={entries} loading={loading} error={error} onMarkExit={markExit} />
    </div>
  )
}
```

- [ ] **Step 2: Syntax-check the file**

Run (from `Frontend/`):
```bash
npx esbuild src/pages/EntriesPage.jsx > /dev/null && echo "syntax ok"
```
Expected output: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/EntriesPage.jsx
git commit -m "feat(frontend): add EntriesPage wrapping the existing entry form and table"
```

---

### Task 10: UsersPage (Admin CRUD UI)

**Files:**
- Create: `Frontend/src/api/users.js`
- Create: `Frontend/src/pages/UsersPage.jsx`

**Interfaces:**
- Consumes: `apiClient` (existing); `useAuth()` (Task 6).
- Produces: `getUsers()`, `createUser(user)`, `updateUser(id, updates)`, `deleteUser(id)`; `<UsersPage />` — consumed by `App.jsx` (Task 11).

- [ ] **Step 1: Create `Frontend/src/api/users.js`**

```js
import apiClient from './client'

export async function getUsers() {
  const response = await apiClient.get('/users')
  return response.data
}

export async function createUser(user) {
  const response = await apiClient.post('/users', user)
  return response.data
}

export async function updateUser(id, updates) {
  const response = await apiClient.patch(`/users/${id}`, updates)
  return response.data
}

export async function deleteUser(id) {
  await apiClient.delete(`/users/${id}`)
}
```

- [ ] **Step 2: Create `Frontend/src/pages/UsersPage.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createUser, deleteUser, getUsers, updateUser } from '../api/users'

const initialForm = { username: '', password: '', full_name: '', role: 'security_guard' }

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      await createUser(form)
      setForm(initialForm)
      await refresh()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (targetUser) => {
    await updateUser(targetUser.id, { is_active: !targetUser.is_active })
    await refresh()
  }

  const handleRoleChange = async (targetUser, role) => {
    await updateUser(targetUser.id, { role })
    await refresh()
  }

  const handleDelete = async (targetUser) => {
    await deleteUser(targetUser.id)
    await refresh()
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">User Management</h1>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input name="username" value={form.username} onChange={handleChange} placeholder="Username" required className="rounded border border-gray-300 px-3 py-2" />
        <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" required className="rounded border border-gray-300 px-3 py-2" />
        <input name="full_name" value={form.full_name} onChange={handleChange} placeholder="Full Name" required className="rounded border border-gray-300 px-3 py-2" />
        <select name="role" value={form.role} onChange={handleChange} className="rounded border border-gray-300 px-3 py-2">
          <option value="security_guard">Security Guard</option>
          <option value="admin">Admin</option>
        </select>
        {formError && <p className="col-span-full text-sm text-red-600">{formError}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="col-span-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50 sm:col-span-1"
        >
          {submitting ? 'Saving...' : 'Create User'}
        </button>
      </form>

      {loading && <p className="text-gray-500">Loading users...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Username</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Full Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Role</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">{u.username}</td>
                  <td className="px-3 py-2">{u.full_name}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="security_guard">Security Guard</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">{u.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={u.id === currentUser.id}
                      className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={u.id === currentUser.id}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Syntax-check both files**

Run (from `Frontend/`):
```bash
node --check src/api/users.js
npx esbuild src/pages/UsersPage.jsx > /dev/null && echo "syntax ok"
```
Expected output: `syntax ok` (and no output/error from the `node --check` line)

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/api/users.js Frontend/src/pages/UsersPage.jsx
git commit -m "feat(frontend): add UsersPage with create/edit/delete for Admins"
```

---

### Task 11: App.jsx Wiring + End-to-End Verification

**Files:**
- Modify: `Frontend/src/App.jsx`

**Interfaces:**
- Consumes: `AuthProvider` (Task 6), `ProtectedRoute`, `NavBar` (Task 7), `LoginPage` (Task 8), `EntriesPage` (Task 9), `UsersPage` (Task 10), `BrowserRouter`/`Routes`/`Route`/`Navigate` (`react-router-dom`).
- Produces: the complete routed, authenticated GatePass app.

- [ ] **Step 1: Replace `Frontend/src/App.jsx`**

```jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import EntriesPage from './pages/EntriesPage'
import UsersPage from './pages/UsersPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <NavBar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/entries"
              element={
                <ProtectedRoute>
                  <EntriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute adminOnly>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/entries" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 2: Verify the full build**

Run (from `Frontend/`):
```powershell
npm run build
```
Expected output ends with `✓ built in ...`, no errors.

- [ ] **Step 3: Start both servers and smoke-test**

Start the backend (from `Backend/`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8000
```

Start the frontend (from `Frontend/`), in the background:
```powershell
npm run dev
```

Verify basic connectivity:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173
```
Expected output: `200`

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/auth/me
```
Expected output: `401` (not logged in yet, proves the proxy still reaches the live backend)

- [ ] **Step 4: Manual browser verification (for you to do — not automatable)**

With both servers running, open `http://localhost:5173` and:
1. Confirm you're redirected to `/login`.
2. Log in as `admin` / `ChangeMe123!` (or whatever you set in `.env`) — confirm redirect to `/entries`, and the NavBar shows both "Entries" and "Users" links plus "Default Admin (admin)".
3. Go to "Users", create a `security_guard` account (e.g. username `guard1`).
4. Click "Logout" — confirm redirect back to `/login`.
5. Log in as the new guard account — confirm the NavBar shows only "Entries" (no "Users" link), and that manually navigating the browser to `http://localhost:5173/users` redirects back to `/entries`.
6. Confirm entries still work normally for the guard (register a vehicle, mark exit).
7. Resize to a narrow (mobile) width and confirm the login form, nav bar, and users table all remain usable.

Stop both servers (Ctrl+C in each) once verified.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/App.jsx
git commit -m "feat(frontend): wire up routing, auth, and the Users page in App.jsx"
```
