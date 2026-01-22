import { User } from './user.model';

export interface Site {
  id: string;
  path: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  auth_configs?: AuthConfig[];
  email_settings?: EmailSettings;
  admins?: User[];
}

export interface AuthConfig {
  id: string;
  site_id: string;
  auth_type: AuthType;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export type AuthType = 'anonymous' | 'google' | 'microsoft' | 'email';

export interface EmailSettings {
  site_id: string;
  flow_type: 'magic_link' | 'register';
  allowed_domains: string[] | null;
}

export interface CreateSiteRequest {
  path: string;
  name: string;
  auth_configs?: Partial<AuthConfig>[];
}

export interface UpdateSiteRequest {
  name?: string;
  path?: string;
}

export interface UpdateAuthConfigRequest {
  auth_configs: Partial<AuthConfig>[];
  email_settings?: Partial<EmailSettings>;
}

export interface ContentVersion {
  id: string;
  site_id: string;
  description: string | null;
  size_bytes: number;
  size_formatted: string;
  uploaded_at: string;
  uploaded_by: string | null;
  is_active: number;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  version: ContentVersion;
  had_active_content: boolean;
  previous_version_id: string | null;
}

export interface ActiveVersionResponse {
  has_active_content: boolean;
  version: ContentVersion | null;
}
