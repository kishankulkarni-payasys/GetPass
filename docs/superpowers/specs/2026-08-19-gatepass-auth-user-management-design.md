# GatePass — Authentication & User Management Design

## Purpose

The basic setup shipped GatePass with an open vehicle-entry API and no login,
by explicit design (see the original basic-setup spec's "Out of scope"
section). This spec adds that authentication layer back in: a login page,
role-based access (Admin vs Security Guard), and full user CRUD so an Admin
can manage who has access.

## Architecture

Extends the existing FastAPI backend and Vite/React frontend — no new
services. Login issues a JWT stored in an **HTTP-only cookie**, set by the
backend on `POST /api/auth/login`. Because the frontend continues to only
call relative `/api/...` paths through the existing Vite dev proxy, the
cookie round-trips automatically (browser treats it as first-party for
`localhost:5173`) with no CORS configuration or manual token-attaching
needed on the frontend.

## Backend

```
Backend/app/
  auth.py              # password hashing (bcrypt), JWT encode/decode, get_current_user & require_admin dependencies
  models.py            # + User model
  schemas.py           # + UserCreate, UserUpdate, UserOut, LoginRequest
  routers/
    auth.py            # POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
    users.py            # /api/users CRUD (Admin only)
  main.py               # + startup bootstrap: create default Admin if no users exist
```

### Data model — `User`

| Field | Type | Notes |
|---|---|---|
| id | int, PK | auto-increment |
| username | string, unique | required |
| password_hash | string | bcrypt hash, never exposed via API |
| full_name | string | required |
| role | string | `admin` or `security_guard` |
| is_active | bool | default `true`; Admin can disable a user without deleting them |
| created_at | datetime | set server-side on creation |

### Roles and access

- `security_guard`: full access to all `/api/entries` endpoints once
  logged in (register, list, view, mark exit).
- `admin`: everything `security_guard` can do, plus full CRUD on
  `/api/users`.
- All `/api/entries` endpoints now require a logged-in user of either role
  (previously open with no auth — this is the change from the basic setup).
- All `/api/users` endpoints require the `admin` role; a `security_guard`
  hitting them gets `403`.

### Endpoints

- `POST /api/auth/login` — body `{username, password}`; on success, sets an
  HTTP-only JWT cookie and returns the current user (no password field).
  On failure, `401` with a generic "invalid username or password" (no
  user-enumeration hints about which field was wrong).
- `POST /api/auth/logout` — clears the auth cookie.
- `GET /api/auth/me` — returns the current logged-in user (or `401` if not
  logged in); used by the frontend on load to restore session state.
- `POST /api/users` (admin) — create a user. `409` on duplicate username.
- `GET /api/users` (admin) — list all users.
- `GET /api/users/{id}` (admin) — fetch one user.
- `PATCH /api/users/{id}` (admin) — update `full_name`, `role`, `is_active`,
  and optionally reset the password.
- `DELETE /api/users/{id}` (admin) — permanently remove a user.

An admin cannot delete or deactivate (`is_active=false`) their own account
via `PATCH`/`DELETE` on their own id — both return `400`. This prevents an
admin from ever locking everyone out, since the startup bootstrap only
creates a new Admin when the `users` table is completely empty.

### Auth mechanism details

- Passwords hashed with `bcrypt` (new dependency) — never stored or
  returned in plaintext.
- JWTs signed with `pyjwt` (new dependency) using a `SECRET_KEY` from
  `.env` (not committed), `HS256`, containing the user's id and role, with
  an 8-hour expiry (`ACCESS_TOKEN_EXPIRE_HOURS = 8`, matching a typical
  shift length).
- The cookie is `httponly=True`, `samesite="lax"`, `secure=False` (local
  HTTP dev only — would need `secure=True` behind HTTPS in any real
  deployment, out of scope here).
- `get_current_user` (FastAPI dependency in `app/auth.py`) reads the
  cookie, decodes and validates the JWT, loads the `User` row, and raises
  `401` if the cookie is missing, invalid, expired, or the user no longer
  exists / is inactive.
- `require_admin` builds on `get_current_user`, additionally raising `403`
  if `role != "admin"`.

### Startup bootstrap

On FastAPI startup, after `Base.metadata.create_all()`, check if the
`users` table is empty. If so, create one Admin user from
`DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in `.env` (new entries
added to `.env.example` as placeholders to change), and print a console
warning reminding the operator to change the password. This only ever runs
once — once any user exists, it's a no-op.

## Frontend

```
Frontend/src/
  context/AuthContext.jsx    # current user, login()/logout(), loading state — checks GET /api/auth/me on load
  components/ProtectedRoute.jsx
  components/NavBar.jsx        # links by role + logout button
  pages/LoginPage.jsx
  pages/EntriesPage.jsx         # today's EntryForm + EntryTable, moved under a route
  pages/UsersPage.jsx            # Admin-only: user list + create/edit/delete
  App.jsx                        # react-router: /login, /entries, /users
```

- New dependency: `react-router-dom`.
- **Routes:** `/login` (public), `/entries` (any logged-in user),
  `/users` (Admin only). Visiting `/entries` or `/users` while logged out
  redirects to `/login`. A `security_guard` visiting `/users` redirects to
  `/entries`.
- `AuthContext` calls `GET /api/auth/me` once on app load to restore
  session state (e.g. after a page refresh), exposing `{user, loading,
  login(username, password), logout()}` to the rest of the app.
- `NavBar` shows "Entries" always (once logged in) and "Users" only for
  Admins, plus the current user's full name and a Logout button.
- `UsersPage` follows the same form + table pattern as the existing
  entries screen: a create-user form and a table listing users with
  edit (role / active toggle / password reset) and delete actions per row.
- All existing entry-related components (`EntryForm`, `EntryTable`,
  `useEntries`) are unchanged — `EntriesPage` just wraps them under a route.

## Error handling

- Login failure → `401`, generic message, surfaced inline on the login
  form.
- Expired/missing/tampered cookie on a protected page → `401` from
  `get_current_user`; `AuthContext` treats this as logged-out and the
  `ProtectedRoute` redirects to `/login`.
- Non-admin hitting `/api/users/*` → `403`; the frontend never links there
  for a Guard, but the backend enforces it regardless of what the UI shows.
- Duplicate username on user creation → `409`, surfaced inline on the
  create-user form.

## Testing / verification

Same approach as the original basic setup — manual verification, no
automated test suite:
1. Start the backend fresh (empty `users` table) and confirm the bootstrap
   Admin is created and logged to the console.
2. Log in as that Admin via the frontend, confirm `/users` is visible and
   works (create a `security_guard` account).
3. Log out, log in as the new Guard account, confirm `/users` is not
   reachable (redirects to `/entries`) and entries still work normally.
4. Confirm an expired/cleared cookie redirects to `/login` instead of
   showing a broken page.

## Out of scope (for this pass)

- Password reset via email / "forgot password" flow
- Multi-factor authentication
- Refresh tokens / silent re-login (session simply expires after 8 hours,
  requiring a fresh login)
- Audit log of who created/modified which vehicle entry
- HTTPS / `secure` cookies (local HTTP dev only, as noted above)
