import { apiRequest } from "@/api/base.js";

export type Webhook = {
  id: string;
  name: string;
  webhookKey: string;
  enabled: boolean;
  llmPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  artifactCount?: number;
};

export type CreateWebhookRequest = {
  name: string;
};

export type UpdateWebhookRequest = {
  name?: string;
  enabled?: boolean;
  llmPrompt?: string;
};

export type ListWebhooksParams = {
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "name";
  order?: "ASC" | "DESC";
  getCount?: boolean;
};

export const webhooksApi = {
  create: async (args: CreateWebhookRequest): Promise<Webhook> => {
    return apiRequest<Webhook>({
      path: "/webhooks",
      method: "POST",
      body: args,
    });
  },

  list: async (args?: ListWebhooksParams): Promise<Array<Webhook>> => {
    const queryParams: Record<string, string> = {};

    if (args?.limit) queryParams.limit = args.limit.toString();
    if (args?.offset) queryParams.offset = args.offset.toString();
    if (args?.orderBy) queryParams.orderBy = args.orderBy;
    if (args?.order) queryParams.order = args.order;
    if (args?.getCount !== undefined)
      queryParams.getCount = args.getCount.toString();

    return apiRequest<Array<Webhook>>({
      path: "/webhooks",
      queryParams:
        Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  },

  get: async (args: { id: string }): Promise<Webhook> => {
    const { id } = args;

    return apiRequest<Webhook>({
      path: `/webhooks/${id}`,
    });
  },

  update: async (args: {
    id: string;
    data: UpdateWebhookRequest;
  }): Promise<Webhook> => {
    const { id, data } = args;

    return apiRequest<Webhook>({
      path: `/webhooks/${id}`,
      method: "PUT",
      body: data,
    });
  },

  delete: async (args: { id: string }): Promise<{ success: boolean }> => {
    const { id } = args;

    return apiRequest<{ success: boolean }>({
      path: `/webhooks/${id}`,
      method: "DELETE",
    });
  },
};
