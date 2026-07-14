import { useState } from "react";
import { 
  Bell, 
  Check, 
  Clock, 
  AlertCircle, 
  Info, 
  ChevronRight,
  Inbox
} from "lucide-react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAdminNotifications, useMarkNotificationRead } from "@/hooks/useTestErrorReports";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NotificationsInboxProps {
  onNavigateToError?: (id: string) => void;
}

export function NotificationsInbox({ onNavigateToError }: NotificationsInboxProps) {
  const [open, setOpen] = useState(false);
  const { data: notifications, isLoading } = useAdminNotifications();
  const markRead = useMarkNotificationRead();

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markRead.mutateAsync(notification.id);
    }
    
    if (notification.link_to && onNavigateToError) {
      // Extract ID from link like /master-admin?report_id=...
      const url = new URL(notification.link_to, window.location.origin);
      const reportId = url.searchParams.get("report_id");
      if (reportId) {
        onNavigateToError(reportId);
        setOpen(false);
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'success': return <Check className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative bg-card/50 border-border/50">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white ring-2 ring-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-4">
          <h4 className="text-sm font-semibold">Notificações</h4>
          <Badge variant="secondary" className="text-[10px] h-5">
            {unreadCount} não lidas
          </Badge>
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </div>
          ) : notifications?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação por aqui.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications?.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex flex-col gap-1 border-b p-4 text-left transition-colors hover:bg-muted/50",
                    !notification.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getIcon(notification.type)}
                      <span className="text-sm font-medium">{notification.title}</span>
                    </div>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    {notification.link_to && (
                      <div className="flex items-center text-[10px] text-primary font-medium">
                        Ver detalhes <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications && notifications.length > 0 && (
          <div className="border-top p-2 text-center">
            <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
