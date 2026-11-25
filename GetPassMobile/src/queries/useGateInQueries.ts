import { useQuery } from '@tanstack/react-query';
import { getGateInConfig } from '../api/gateIn';

// Matches Backend/app/site_settings.py's OCR_CONFIDENCE_THRESHOLD default, used
// only until /gate-in/config has loaded (or if it fails to load at all).
export const DEFAULT_OCR_CONFIDENCE_THRESHOLD = 85;

export function useGateInConfig() {
  return useQuery({
    queryKey: ['gateIn', 'config'],
    queryFn: getGateInConfig,
    staleTime: 5 * 60 * 1000,
  });
}
