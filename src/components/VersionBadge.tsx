import { APP_VERSION } from "@/config/version";

export function VersionBadge() {
  return (
    <span className="text-[10px] text-muted-foreground/60 select-none">
      v{APP_VERSION}
    </span>
  );
}
