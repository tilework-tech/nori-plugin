import { apiRequest } from "@/api/base.js";

export type Heartbeat = {
  id: string;
  processName: string;
  timestamp: string;
  uptime: number;
  createdAt: string;
};

export type ListHeartbeatsParams = {
  limit?: number;
  offset?: number;
  startDate?: string | null;
  endDate?: string | null;
  processName?: string | null;
  processNames?: Array<string> | null;
};

export const heartbeatsApi = {
  list: async (args?: ListHeartbeatsParams): Promise<Array<Heartbeat>> => {
    const queryParams: Record<string, string> = {};

    if (args?.limit) queryParams.limit = args.limit.toString();
    if (args?.offset) queryParams.offset = args.offset.toString();
    if (args?.startDate) queryParams.startDate = args.startDate;
    if (args?.endDate) queryParams.endDate = args.endDate;
    if (args?.processName) queryParams.processName = args.processName;

    let path = "/heartbeats";

    // Handle multiple processNames as repeated query params
    if (args?.processNames && args.processNames.length > 0) {
      const processNamesQuery = args.processNames
        .map((name) => `processName=${encodeURIComponent(name)}`)
        .join("&");

      const otherParams = Object.keys(queryParams)
        .map((key) => `${key}=${encodeURIComponent(queryParams[key])}`)
        .join("&");

      const allParams = [processNamesQuery, otherParams]
        .filter(Boolean)
        .join("&");

      if (allParams) {
        path = `/heartbeats?${allParams}`;
      }

      return apiRequest<Array<Heartbeat>>({ path });
    }

    return apiRequest<Array<Heartbeat>>({
      path,
      queryParams:
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  },

  getProcessNames: async (): Promise<Array<string>> => {
    return apiRequest<Array<string>>({
      path: "/heartbeats/processes",
    });
  },
};
