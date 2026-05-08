-- Fix 1: Remove public profiles SELECT policy
DROP POLICY IF EXISTS "profiles select referral lookup" ON public.profiles;

-- Fix 2: Add restrictive write policies on user_roles (admin-only)
CREATE POLICY "user_roles admin insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles admin update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles admin delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Revoke EXECUTE on handle_new_user trigger function from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;