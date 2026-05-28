import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RouteErrorStateProps = {
  title: string;
  description?: string;
  onRetry: () => void;
  className?: string;
  retryLabel?: string;
};

export function RouteErrorState({
  title,
  description,
  onRetry,
  className,
  retryLabel = "Retry now",
}: RouteErrorStateProps) {
  return (
    <div className={cn("rounded-card border border-orange/30 bg-white p-3", className)}>
      <p className="text-sm text-orange">{title}</p>
      {description ? (
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      ) : null}
      <div className={description ? "mt-3" : "mt-2"}>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}