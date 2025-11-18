import { apiRequest } from "@/api/base.js";

export type WebhookRequest = {
  id: number;
  webhookId: string | null;
  sourceIp: string;
  status: "success" | "invalid_key" | "test" | "invalid_payload";
  requestBody: string;
  errorMessage: string | null;
  createdAt: string;
};

export type ListWebhookRequestsParams = {
  webhookId?: string;
  status?: Array<"success" | "invalid_key" | "test" | "invalid_payload">;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
};

export const webhookRequestsApi = {
  list: async (
    args?: ListWebhookRequestsParams,
  ): Promise<Array<WebhookRequest>> => {
    const queryParams: Record<string, string> = {};

    if (args?.webhookId) queryParams.webhookId = args.webhookId;
    if (args?.status) queryParams.status = JSON.stringify(args.status);
    if (args?.startDate) queryParams.startDate = args.startDate;
    if (args?.endDate) queryParams.endDate = args.endDate;
    if (args?.limit) queryParams.limit = args.limit.toString();
    if (args?.offset) queryParams.offset = args.offset.toString();

    return apiRequest<Array<WebhookRequest>>({
      path: "/webhook-requests",
      queryParams:
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  },

  get: async (args: { id: number }): Promise<WebhookRequest> => {
    const { id } = args;

    return apiRequest<WebhookRequest>({
      path: `/webhook-requests/${id}`,
    });
  },

  delete: async (args: { id: number }): Promise<{ success: boolean }> => {
    const { id } = args;

    return apiRequest<{ success: boolean }>({
      path: `/webhook-requests/${id}`,
      method: "DELETE",
    });
  },
};
