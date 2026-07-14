import { useSidebarCategory } from "@/contexts/SidebarCategoryContext";
import { menuGroups, type MenuGroup } from "@/components/AppSidebar";
import { usePlanFeatures, getRequiredPlan } from "@/hooks/usePlanFeatures";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function SubcategoryPanel() {
  const { activeCategory, setActiveCategory } = useSidebarCategory();
  const { isRouteAllowed } = usePlanFeatures();
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();

  if (!activeCategory) return null;

  const group = menuGroups.find((g) => g.label === activeCategory);
  if (!group) return null;

  const isPathActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const handleItemClick = (url: string) => {
    navigate(url);
    setActiveCategory(null);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <div className="animate-fade-in border-b border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10`}>
              <group.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{group.label}</h2>
              <p className="text-xs text-muted-foreground">{group.items.length} módulos disponíveis</p>
            </div>
          </div>
          <button
            onClick={() => setActiveCategory(null)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {group.items.map((item, i) => {
            const allowed = isRouteAllowed(item.url);
            const active = isPathActive(item.url);

            if (!allowed) {
              const requiredPlan = getRequiredPlan(item.url) || "Superior";
              return (
                <Card
                  key={item.title}
                  className="border-border/40 bg-muted/20 opacity-50 cursor-not-allowed animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                >
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
                        <item.icon className="h-4.5 w-4.5 text-muted-foreground/40" strokeWidth={1.75} />
                      </div>
                      <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground/50">{item.title}</p>
                      {item.desc && <p className="text-[11px] text-muted-foreground/30 mt-0.5 line-clamp-1">{item.desc}</p>}
                    </div>
                    <Badge variant="outline" className="w-fit text-[9px] border-muted-foreground/20 text-muted-foreground/40 mt-1">
                      Plano {requiredPlan}
                    </Badge>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card
                key={item.title}
                onClick={() => handleItemClick(item.url)}
                className={`cursor-pointer transition-all duration-200 hover-lift group animate-fade-in ${
                  active
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "hover:border-primary/30 hover:bg-accent/30"
                }`}
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
              >
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                      active ? "bg-primary/15" : "bg-accent/60 group-hover:bg-primary/10"
                    }`}>
                      <item.icon className={`h-4.5 w-4.5 ${active ? "text-primary" : "text-foreground/70 group-hover:text-primary"}`} strokeWidth={1.75} />
                    </div>
                    {item.premium && (
                      <Badge variant="outline" className="text-[9px] border-primary/30 text-primary/70 bg-primary/5">
                        Pro
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>{item.title}</p>
                    {item.desc && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.desc}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
