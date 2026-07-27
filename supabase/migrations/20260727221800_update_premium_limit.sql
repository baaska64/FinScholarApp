CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  profile_count int;
BEGIN
  -- Check how many profiles currently exist
  SELECT count(*) INTO profile_count FROM public.profiles;
  
  -- Insert the new profile, granting premium if we are under 50 users
  INSERT INTO public.profiles (id, is_premium)
  VALUES (new.id, profile_count < 50);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
