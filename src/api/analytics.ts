import { normalizeUrl } from "@/utils/url.js";

import { ConfigManager } from "./base.js";

const DEFAULT_ANALYTICS_URL = "https://demo.tilework.tech";
const DEFAULT_NORI_ANALYTICS_URL = "https://noriskillsets.dev";

export type GenerateDailyReportRequest = {
  date?: string | null;
};

export type GenerateDailyReportResponse = {
  reportId: string;
  content: string;
  artifactCount: number;
  tokensUsed?: number | null;
};

export type GenerateUserReportRequest = {
  userEmail: string;
};

export type GenerateUserReportResponse = {
  content: string;
  artifactCount: number;
  tokensUsed?: number | null;
  firstActivityDate?: string | null;
  lastActivityDate?: string | null;
};

export type TrackEventRequest = {
  clientId: string;
  userId?: string | null;
  eventName: string;
  eventParams?: Record<string, any> | null;
};

export type TrackEventResponse = {
  success: boolean;
};

export type TrackInstallEventRequest = {
  event: string;
  client_id: string;
  session_id: string;
  timestamp: string;
  properties: Record<string, any>;
};

export const analyticsApi = {
  trackEvent: async (args: TrackEventRequest): Promise<TrackEventResponse> => {
    const config = ConfigManager.loadConfig();
    const baseUrl = config?.organizationUrl ?? DEFAULT_ANALYTICS_URL;

    const url = normalizeUrl({ baseUrl, path: "/api/analytics/track" });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      return { success: false };
    }

    return (await response.json()) as TrackEventResponse;
  },

  /**
   * Track install/session lifecycle events
   * Fire-and-forget with hard 500ms timeout
   *
   * @param args - Event data
   *
   * @returns Promise that resolves when tracking completes or times out
   */
  trackInstallEvent: async (
    args: TrackInstallEventRequest,
  ): Promise<TrackEventResponse> => {
    try {
      const baseUrl =
        process.env.NORI_ANALYTICS_URL ?? DEFAULT_NORI_ANALYTICS_URL;
      const url = normalizeUrl({ baseUrl, path: "/api/analytics/track" });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 500);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false };
      }

      return { success: true };
    } catch {
      // Silent failure - timeout or network error
      return { success: false };
    }
  },
};
