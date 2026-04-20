import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});

export const LIST_PAGE_REFETCH_INTERVAL_MS = 60_000;

export const DASHBOARD_QUERY_KEYS: readonly (readonly unknown[])[] = [
  ["/api/dashboard/stats"],
  ["/api/projects"],
  ["/api/clients"],
  ["/api/tasks"],
  ["/api/projects/by-status"],
  ["/api/tasks/overdue"],
  ["/api/invoices"],
  ["/api/invoices/stats"],
  ["/api/time-entries"],
];

export function invalidateDashboardQueries() {
  for (const queryKey of DASHBOARD_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: queryKey as unknown[] });
  }
}
