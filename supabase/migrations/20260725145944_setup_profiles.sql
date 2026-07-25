-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Function to handle new user signups and enforce the first 80 users premium logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  profile_count int;
BEGIN
  -- Check how many profiles currently exist
  SELECT count(*) INTO profile_count FROM public.profiles;
  
  -- Insert the new profile, granting premium if we are under 80 users
  INSERT INTO public.profiles (id, is_premium)
  VALUES (new.id, profile_count < 80);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill existing users (if any)
DO $$
BEGIN
  -- Insert up to the first 80 existing users as premium
  INSERT INTO public.profiles (id, is_premium)
  SELECT id, true 
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ORDER BY created_at ASC
  LIMIT 80;

  -- Insert any remaining existing users as non-premium
  INSERT INTO public.profiles (id, is_premium)
  SELECT id, false
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles);
END $$;
