import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import SupportChat from "@/components/SupportChat";
import MaxMentorChat from "@/components/MaxMentorChat";
import { useUnansweredMLQuestionsCount } from "@/hooks/useMLNotifications";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const unansweredCount = useUnansweredMLQuestionsCount();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border/50 bg-background/80 backdrop-blur-xl px-5 sticky top-0 z-30">
            <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground transition-colors" />
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">E</span>
              </div>
              <span className="text-sm font-semibold text-foreground tracking-tight">ERP System</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {unansweredCount > 0 && (
                <button
                  onClick={() => navigate("/crm")}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{unansweredCount} pergunta(s) ML</span>
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                </button>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-5 md:p-8 overflow-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      <SupportChat />
      <MaxMentorChat />
    </SidebarProvider>
  );
};

export default AppLayout;
