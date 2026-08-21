-- Bump the latest_version to 1.0.5 in the app_versions table

INSERT INTO public.app_versions (id, latest_version, update_message, store_url)
VALUES (1, '1.0.5', 'A new version of FinScholar is available! Update now for custom Pomodoro times and a better Tasks UI.', 'https://play.google.com/store/apps/details?id=com.lalex.finscholar')
ON CONFLICT (id) DO UPDATE SET 
    latest_version = EXCLUDED.latest_version,
    update_message = EXCLUDED.update_message,
    store_url = EXCLUDED.store_url;
