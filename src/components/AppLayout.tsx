import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import SupportChat from "@/components/SupportChat";
import MaxMentorChat from "@/components/MaxMentorChat";
import { useUnansweredMLQuestionsCount } from "@/hooks/useMLNotifications";
import { MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const unansweredCount = useUnansweredMLQuestionsCount();
  const navigate = useNavigate();
  const { setOpenMobile, openMobile } = useSidebar();

  useSwipeGesture({
    onSwipeRight: () => {
      if (!openMobile) setOpenMobile(true);
    },
    onSwipeLeft: () => {
      if (openMobile) setOpenMobile(false);
    },
  });

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center border-b border-border/50 bg-background/80 backdrop-blur-xl px-3 sm:px-5 sticky top-0 z-30 gap-2">
          <SidebarTrigger className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors active:scale-95" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">E</span>
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight hidden sm:inline">ERP System</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {unansweredCount > 0 && (
              <button
                onClick={() => navigate("/crm")}
                className="relative flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors active:scale-95"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">{unansweredCount} pergunta(s) ML</span>
                <span className="sm:hidden">{unansweredCount}</span>
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-5 md:p-8 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
      <SupportChat />
      <MaxMentorChat />
    </SidebarProvider>
  );
};

export default AppLayout;
