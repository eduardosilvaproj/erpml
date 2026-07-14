-- Function to notify when an error is assigned
CREATE OR REPLACE FUNCTION public.notify_on_error_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.assigned_to IS NOT NULL) AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO public.admin_internal_notifications (user_id, title, message, type, link_to)
        VALUES (
            NEW.assigned_to,
            'Novo erro atribuído',
            'Você foi designado como responsável pelo erro: ' || NEW.title,
            'info',
            '/admin-master-dev?report_id=' || NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_error_assigned
AFTER UPDATE ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_error_assignment();

-- Function to notify on new comments
CREATE OR REPLACE FUNCTION public.notify_on_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    report_record RECORD;
BEGIN
    SELECT * INTO report_record FROM public.test_error_reports WHERE id = NEW.report_id;
    
    -- Notify assigned user if comment is from someone else
    IF report_record.assigned_to IS NOT NULL AND NEW.user_id != report_record.assigned_to THEN
        INSERT INTO public.admin_internal_notifications (user_id, title, message, type, link_to)
        VALUES (
            report_record.assigned_to,
            'Novo comentário técnico',
            'Há um novo comentário no erro: ' || report_record.title,
            'info',
            '/admin-master-dev?report_id=' || NEW.report_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_created
AFTER INSERT ON public.test_error_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_comment();

-- Notify all admins on NEW critical errors
CREATE OR REPLACE FUNCTION public.notify_on_new_critical_error()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity = 'critical' THEN
        INSERT INTO public.admin_internal_notifications (user_id, title, message, type, link_to)
        SELECT 
            au.user_id,
            '⚠️ ERRO CRÍTICO REGISTRADO',
            'Um novo erro crítico foi reportado: ' || NEW.title,
            'critical',
            '/admin-master-dev?report_id=' || NEW.id
        FROM public.admin_users au
        WHERE au.role = 'admin_master_dev' AND au.is_active = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_critical_error_created
AFTER INSERT ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_critical_error();
