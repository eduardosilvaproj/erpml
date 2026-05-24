import { APP_VERSION, BUILD_DATE } from "@/config/version";

export function VersionBadge() {
  return (
    <span className="text-[10px] text-muted-foreground/60 select-none" title={`Build: ${BUILD_DATE}`}>
      v{APP_VERSION}
    </span>
  );
}
