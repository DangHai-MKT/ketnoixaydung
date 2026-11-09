-- Automatically assign the default buyer role to every newly created user.
-- Existing users are intentionally not modified.

CREATE OR REPLACE FUNCTION public.assign_default_buyer_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

--> statement-breakpoint

CREATE TRIGGER trg_users_default_buyer_role
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_buyer_role();
