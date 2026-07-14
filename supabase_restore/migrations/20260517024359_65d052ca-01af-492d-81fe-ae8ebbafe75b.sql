-- Create import_jobs table
CREATE TABLE public.import_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    type TEXT NOT NULL CHECK (type IN ('products', 'stock', 'products_and_stock')),
    source_format TEXT NOT NULL CHECK (source_format IN ('csv', 'xlsx', 'pdf')),
    source_name TEXT,
    source_system TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'processing', 'completed', 'completed_with_errors', 'failed')),
    total_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    ignored_rows INTEGER DEFAULT 0,
    created_products INTEGER DEFAULT 0,
    updated_products INTEGER DEFAULT 0,
    updated_stock_rows INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create import_job_rows table
CREATE TABLE public.import_job_rows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    raw_data JSONB,
    normalized_data JSONB,
    mapped_data JSONB,
    validation_errors JSONB DEFAULT '[]'::JSONB,
    warnings JSONB DEFAULT '[]'::JSONB,
    action TEXT,
    match_strategy TEXT,
    matched_product_id UUID,
    ignored BOOLEAN DEFAULT FALSE,
    confidence NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create import_job_events table
CREATE TABLE public.import_job_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    import_job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
    event_type TEXT,
    message TEXT,
    payload JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_job_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_jobs
CREATE POLICY "Users can view their own company import jobs"
ON public.import_jobs FOR SELECT
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own company import jobs"
ON public.import_jobs FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their own company import jobs"
ON public.import_jobs FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- RLS Policies for import_job_rows (linked via job company_id)
CREATE POLICY "Users can view their own company import job rows"
ON public.import_job_rows FOR SELECT
USING (import_job_id IN (SELECT id FROM public.import_jobs WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert their own company import job rows"
ON public.import_job_rows FOR INSERT
WITH CHECK (import_job_id IN (SELECT id FROM public.import_jobs WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update their own company import job rows"
ON public.import_job_rows FOR UPDATE
USING (import_job_id IN (SELECT id FROM public.import_jobs WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())));

-- RLS Policies for import_job_events
CREATE POLICY "Users can view their own company import job events"
ON public.import_job_events FOR SELECT
USING (import_job_id IN (SELECT id FROM public.import_jobs WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert their own company import job events"
ON public.import_job_events FOR INSERT
WITH CHECK (import_job_id IN (SELECT id FROM public.import_jobs WHERE company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())));

-- Trigger for updated_at on import_jobs
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_jobs_updated_at
    BEFORE UPDATE ON public.import_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
