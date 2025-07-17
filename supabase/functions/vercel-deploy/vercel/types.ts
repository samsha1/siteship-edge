export interface VercelDeployRequest {
  username: string;        // subdomain part for deployment (e.g., samrat.vercel.app)
  publicUrl: string;       // Supabase public URL to the .zip file
  projectName?: string; 
  action: 'list' | 'add' | 'delete';
}

// vercel/types.ts

export interface VercelConfig {
  token: string;
  teamId?: string;
  projectId?: string;
  retries?: number;
  baseUrl?: string; // optional override
}

export interface VercelDomain {
  name: string;
  apexName: string;
  verified: boolean;
  createdAt: number;
  updatedAt: number;
  [key: string]: any;
}
