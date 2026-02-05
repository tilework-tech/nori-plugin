/**
 * Prompts auth wrapper
 *
 * Provides a wrapper around @clack/prompts group function
 * to bundle email, password, and organization ID prompts.
 */

import { group, text, password, isCancel } from "@clack/prompts";

import { buildWatchtowerUrl, isValidUrl, normalizeUrl } from "@/utils/url.js";

import { handleCancel } from "./utils.js";
import { validateOrgId } from "./validators.js";

/**
 * Auth credentials returned from the auth prompt flow
 */
export type AuthCredentials = {
  username: string;
  password: string;
  organizationUrl: string;
};

/**
 * Prompt for authentication credentials
 *
 * Uses @clack/prompts group() to bundle email, password, and organization ID
 * prompts together. If the user enters an empty email, they can skip auth
 * and the function returns null.
 *
 * @returns Auth credentials or null if user skips by entering empty email
 */
export const promptForAuth = async (): Promise<AuthCredentials | null> => {
  const result = await group(
    {
      email: () =>
        text({
          message: "Email address (or press Enter to skip)",
          placeholder: "user@example.com",
        }),
      password: ({ results }) => {
        const email = results.email as string | undefined;
        if (!email || email.trim() === "") {
          return Promise.resolve(null);
        }
        return password({
          message: "Password",
        });
      },
      orgId: ({ results }) => {
        const email = results.email as string | undefined;
        if (!email || email.trim() === "") {
          return Promise.resolve(null);
        }
        return text({
          message: "Organization ID (or full URL)",
          placeholder: "mycompany",
          validate: (value) => {
            if (!value || value.trim() === "") {
              return "Organization ID is required";
            }
            // Allow full URLs
            if (isValidUrl({ input: value })) {
              return undefined;
            }
            // Validate as org ID
            return validateOrgId({ value });
          },
        });
      },
    },
    {
      onCancel: () => {
        handleCancel();
      },
    },
  );

  if (isCancel(result)) {
    handleCancel();
  }

  const email = (result.email as string | undefined)?.trim() ?? "";
  if (!email) {
    return null;
  }

  const orgInput = result.orgId as string;
  let organizationUrl: string;

  if (isValidUrl({ input: orgInput })) {
    organizationUrl = normalizeUrl({ baseUrl: orgInput });
  } else {
    organizationUrl = buildWatchtowerUrl({ orgId: orgInput });
  }

  return {
    username: email,
    password: result.password as string,
    organizationUrl,
  };
};
