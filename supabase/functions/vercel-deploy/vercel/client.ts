import { VercelConfig, VercelDomain } from "../types.ts";

export class VercelAPI {
  private token: string;
  private teamId?: string;
  private retries: number;
  private baseUrl: string;

  constructor(config: VercelConfig) {
    this.token = config.token;
    this.teamId = config.teamId;
    this.retries = config.retries ?? 3;
    this.baseUrl = config.baseUrl ?? "https://api.vercel.com";
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0,
  ): Promise<Response> {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok && retryCount < this.retries) {
      const delay = Math.pow(2, retryCount) * 100;
      console.warn(`Retrying in ${delay}ms due to status ${res.status}`);
      await new Promise((r) => setTimeout(r, delay));
      return this.fetchWithRetry(url, options, retryCount + 1);
    }

    return res;
  }

  private buildURL(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (this.teamId) url.searchParams.set("teamId", this.teamId);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  async listDomains(projectId: string): Promise<VercelDomain[]> {
    const url = this.buildURL(`/v9/projects/${projectId}/domains`);
    const res = await this.fetchWithRetry(url, { method: "GET" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to list domains");
    return data.domains;
  }

  async addDomain(projectId: string, domain: string): Promise<VercelDomain> {
    const url = this.buildURL(`/v9/projects/${projectId}/domains`);
    const res = await this.fetchWithRetry(
      url,
      {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Failed to add domain");
    return data;
  }

  async removeDomain(projectId: string, domain: string): Promise<boolean> {
    const url = this.buildURL(`/v9/projects/${projectId}/domains/${domain}`);
    const res = await this.fetchWithRetry(url, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message || "Failed to delete domain");
    }
    return true;
  }
}
