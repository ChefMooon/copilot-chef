import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";

import { ApiError } from "@/lib/api";
import { ConfigNotReadyError } from "@/lib/config";

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ConfigNotReadyError) {
    return false;
  }

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return false;
  }

  return failureCount < 2;
}

export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: shouldRetryQuery,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
