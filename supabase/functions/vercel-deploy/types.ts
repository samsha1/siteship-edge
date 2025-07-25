export interface VercelDeployRequest {
  username: string;        // Used for subdomain and branch
  publicUrl: string;       // Supabase public URL of .zip file
  projectName?: string;    // Optional Vercel project name
  action?: 'deploy' | 'list' | 'delete'; // Optional future use
}

export type GitCreateTreeParamsTree = {
  path: string;
  mode: string;
  type: string;
  sha: string;
};
