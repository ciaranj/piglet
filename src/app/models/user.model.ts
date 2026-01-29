export interface User {
  id: string;
  email: string | null;
  email_verified: boolean;
  display_name: string | null;
  created_at?: string;
  added_at?: string;
  added_by?: string;
}

export interface Session {
  authenticated: boolean;
  user?: User;
  auth_type?: string;
  site_id?: string | null;
  is_admin?: boolean;
  is_global_admin?: boolean;
  is_site_admin_role?: boolean;
}

export interface AuthMethods {
  auth_methods: string[];
  site_path: string;
}
