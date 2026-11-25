import { QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

const HTTP_UNAUTHORIZED = 401;
const MAX_QUERY_RETRIES = 2;

/**
 * A 401 means the session has already expired (apiClient's response interceptor has
 * already cleared the token and called the unauthorized handler to log the user out).
 * Retrying it would just repeat the same rejected request against a screen that's about
 * to unmount, so queries/mutations stop immediately on a 401 and retry a bounded number
 * of times for anything else.
 */
function isUnauthorized(error: unknown): boolean {
  return (error as AxiosError | undefined)?.response?.status === HTTP_UNAUTHORIZED;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isUnauthorized(error)) return false;
        return failureCount < MAX_QUERY_RETRIES;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
