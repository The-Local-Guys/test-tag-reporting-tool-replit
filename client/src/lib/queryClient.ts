import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Makes authenticated API requests to the backend server
 * Automatically includes credentials and handles JSON serialization
 * @param method - HTTP method (GET, POST, PATCH, DELETE)
 * @param url - API endpoint URL
 * @param data - Optional request body data (will be JSON stringified)
 * @returns Promise resolving to the Response object
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Reusable delete function for API resources
 * Can be used throughout the application for consistent deletion behavior
 * @param url - The API endpoint URL to delete from
 * @param resourceName - Human-readable name for error messages (e.g., "report", "user", "item")
 * @returns Promise resolving to the delete response
 */
export async function deleteResource(url: string, resourceName: string = "resource"): Promise<Response> {
  try {
    const response = await apiRequest("DELETE", url);
    return response;
  } catch (error) {
    console.error(`Failed to delete ${resourceName}:`, error);
    throw new Error(`Failed to delete ${resourceName}. Please try again.`);
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
