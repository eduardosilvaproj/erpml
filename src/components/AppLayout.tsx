import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import SupportChat from "@/components/SupportChat";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border/50 bg-card/80 backdrop-blur-lg px-5 sticky top-0 z-30">
            <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground transition-colors" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">E</span>
              </div>
              <span className="text-sm font-semibold text-foreground tracking-tight">ERP System</span>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-5 md:p-8 overflow-auto animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      <SupportChat />
    </SidebarProvider>
  );
};

export default AppLayout;
