import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getApiBaseUrl } from '../config/env';
import { getToken, clearToken } from '../auth/tokenStorage';

const HTTP_UNAUTHORIZED = 401;

// A 401 from these endpoints is an expected answer (not logged in yet, wrong
// password), not a session that just expired mid-use. Mirrors Frontend/src/api/client.js.
const AUTH_ENDPOINTS_WITHOUT_EXPIRY = new Set(['/auth/login', '/auth/logout']);

const REQUEST_LOCATION_PREFIXES = new Set(['body', 'query', 'path', 'header', 'cookie']);
const PYDANTIC_VALUE_ERROR_PREFIX = 'Value error, ';

interface ValidationErrorItem {
  loc?: Array<string | number>;
  msg?: string;
}

function formatValidationError({ loc = [], msg = '' }: ValidationErrorItem): string {
  const field = loc
    .filter((part, index) => !(index === 0 && typeof part === 'string' && REQUEST_LOCATION_PREFIXES.has(part)))
    .join('.');
  const message = msg.startsWith(PYDANTIC_VALUE_ERROR_PREFIX)
    ? msg.slice(PYDANTIC_VALUE_ERROR_PREFIX.length)
    : msg;
  return field ? `${field}: ${message}` : message;
}

// FastAPI's 422 responses carry a list of per-field errors; screens expect one readable string.
function normalizeErrorDetail(error: AxiosError<{ detail?: unknown }>): void {
  const detail = error.response?.data?.detail;
  if (!Array.isArray(detail) || !error.response) return;
  error.response.data.detail = detail.map(formatValidationError).filter(Boolean).join('; ');
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Lets the auth context react to an expired/invalid session without this module importing React. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function isSessionExpiry(error: AxiosError): boolean {
  if (error.response?.status !== HTTP_UNAUTHORIZED) return false;
  const path = (error.config?.url ?? '').replace(/^https?:\/\/[^/]+\/api/, '');
  return !AUTH_ENDPOINTS_WITHOUT_EXPIRY.has(path);
}

const apiClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

// baseURL depends on Platform + a possible user override, both read asynchronously,
// so it is resolved per-request rather than once at module load.
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const baseUrl = await getApiBaseUrl();
  config.baseURL = `${baseUrl}/api`;

  const token = await getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError<{ detail?: unknown }>) => {
    normalizeErrorDetail(error);
    if (isSessionExpiry(error)) {
      await clearToken();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export default apiClient;
