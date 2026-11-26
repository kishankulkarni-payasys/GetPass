"""Email adapter for sending password-reset links (none = log only, mock = print, http = live)."""

from functools import lru_cache

import httpx

from app.integrations import (
    PROVIDER_HTTP,
    PROVIDER_MOCK,
    PROVIDER_NONE,
    AdapterError,
    log_adapter_failure,
    read_float,
    read_provider,
    require_env,
)

PROVIDER_ENV = "EMAIL_PROVIDER"
DEFAULT_TIMEOUT_SECONDS = 10.0


class NoEmailSender:
    def send(self, to: str, subject: str, body: str) -> None:
        raise AdapterError("Email sending is not configured")


class MockEmailSender:
    def send(self, to: str, subject: str, body: str) -> None:
        # Dev convenience only: never used when EMAIL_PROVIDER=http.
        print(f"[mock email] to={to} subject={subject!r} body={body!r}")


class HttpEmailSender:
    def __init__(self, url: str, api_key: str, timeout: float):
        self._url = url
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._timeout = timeout

    def send(self, to: str, subject: str, body: str) -> None:
        try:
            response = httpx.post(
                self._url,
                headers=self._headers,
                json={"to": to, "subject": subject, "body": body},
                timeout=self._timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            log_adapter_failure("email", exc)
            raise AdapterError("Email provider request failed") from exc


@lru_cache(maxsize=1)
def get_email_sender():
    provider = read_provider(PROVIDER_ENV, PROVIDER_NONE, (PROVIDER_NONE, PROVIDER_MOCK, PROVIDER_HTTP))
    if provider == PROVIDER_NONE:
        return NoEmailSender()
    if provider == PROVIDER_MOCK:
        return MockEmailSender()
    url = require_env("EMAIL_WEBHOOK_URL", PROVIDER_ENV)
    api_key = require_env("EMAIL_WEBHOOK_KEY", PROVIDER_ENV)
    timeout = read_float("EMAIL_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)
    return HttpEmailSender(url, api_key, timeout)
