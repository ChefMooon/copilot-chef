import { Link, isRouteErrorResponse, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}${error.data ? `: ${String(error.data)}` : ""}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while loading this screen.";
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = getErrorMessage(error);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at 20% 20%, rgba(59, 94, 69, 0.12), transparent 38%), radial-gradient(circle at 80% 10%, rgba(197, 98, 42, 0.14), transparent 45%), linear-gradient(180deg, #f8f4ec 0%, #f5f0e8 55%, #efe7d8 100%)",
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          borderRadius: "16px",
          border: "1px solid var(--cream-dark)",
          background: "var(--white)",
          boxShadow: "var(--shadow-lg)",
          padding: "24px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Copilot Chef
        </p>
        <h1
          style={{
            margin: "8px 0 10px",
            fontSize: "clamp(24px, 3vw, 32px)",
            lineHeight: 1.1,
            color: "var(--text)",
          }}
        >
          That page hit a snag
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--text-muted)",
          }}
        >
          We couldn&apos;t finish loading this view. You can return home or retry.
        </p>

        <pre
          style={{
            margin: "16px 0 0",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid var(--cream-dark)",
            background: "var(--cream)",
            color: "var(--text)",
            overflowX: "auto",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
            fontSize: "12px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message}
        </pre>

        <div
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "18px",
            flexWrap: "wrap",
          }}
        >
          <Button asChild variant="default">
            <Link to="/">Back to Home</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            type="button"
          >
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}