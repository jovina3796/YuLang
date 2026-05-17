-- Custom roles: admin can create/rename/delete custom roles in addition to
-- the built-in admin/driver. user_profiles.role and role_permissions.role
-- both become FK references to public.roles(key).
CREATE TABLE IF NOT EXISTS public.roles (
  key         text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label       text NOT NULL,
  badge_class text NOT NULL DEFAULT 'badge-blue',
  is_builtin  boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.roles (key, label, badge_class, is_builtin, sort_order) VALUES
  ('admin',  '管理員', 'badge-blue',  true, 0),
  ('driver', '司機',   'badge-green', true, 1)
ON CONFLICT (key) DO NOTHING;

-- Drop the old CHECK constraint on user_profiles.role (named by 018_user_profiles.sql).
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- FK on user_profiles.role → roles(key). RESTRICT so deleteRole MUST first
-- migrate users off the role (handled by delete_role RPC below).
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(key)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK on role_permissions.role → roles(key). CASCADE so deleting a role
-- automatically tidies its permission row.
ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_role_fkey;
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(key)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- Atomic role deletion: reassigns dependents to 'driver' then deletes the role.
-- Refuses to touch built-ins. Returns the number of user_profiles migrated.
CREATE OR REPLACE FUNCTION public.delete_role(p_key text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_builtin boolean;
  v_moved   int;
BEGIN
  SELECT is_builtin INTO v_builtin FROM public.roles WHERE key = p_key;
  IF v_builtin IS NULL THEN
    RAISE EXCEPTION 'role % not found', p_key;
  END IF;
  IF v_builtin THEN
    RAISE EXCEPTION 'cannot delete built-in role %', p_key;
  END IF;

  UPDATE public.user_profiles SET role = 'driver' WHERE role = p_key;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  DELETE FROM public.roles WHERE key = p_key;
  RETURN v_moved;
END;
$$;
