CREATE TABLE IF NOT EXISTS public.app_versions (
    id bigint PRIMARY KEY,
    latest_version text NOT NULL,
    update_message text,
    store_url text
);

INSERT INTO public.app_versions (id, latest_version, update_message, store_url)
VALUES (1, '1.0.1', 'A new version of FinScholar is available! Update now to get the latest features and bug fixes.', 'https://play.google.com/store/apps/details?id=com.lalex.finscholar')
ON CONFLICT (id) DO UPDATE SET 
    latest_version = EXCLUDED.latest_version,
    update_message = EXCLUDED.update_message,
    store_url = EXCLUDED.store_url;

-- Enable RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read versions
DROP POLICY IF EXISTS "Allow public read on app_versions" ON public.app_versions;
CREATE POLICY "Allow public read on app_versions" ON public.app_versions FOR SELECT USING (true);
