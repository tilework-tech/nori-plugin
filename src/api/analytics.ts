import { apiRequest } from "./base.js";

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

export const analyticsApi = {
  generateDailyReport: async (
    args?: GenerateDailyReportRequest | null,
  ): Promise<GenerateDailyReportResponse> => {
    return apiRequest<GenerateDailyReportResponse>({
      path: "/analytics/daily-report",
      method: "POST",
      body: args || {},
    });
  },

  generateUserReport: async (
    args: GenerateUserReportRequest,
  ): Promise<GenerateUserReportResponse> => {
    return apiRequest<GenerateUserReportResponse>({
      path: "/analytics/user-report",
      method: "POST",
      body: args,
    });
  },

  trackEvent: async (args: TrackEventRequest): Promise<TrackEventResponse> => {
    return apiRequest<TrackEventResponse>({
      path: "/analytics/track",
      method: "POST",
      body: args,
    });
  },
};
