// functions/manage-vercel.ts
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { VercelAPI } from "./vercel/client.ts";
import { VercelDeployRequest } from "./vercel/types.ts";

serve(async (req) => {
  const { action, username, zip_url, projectName }: VercelDeployRequest = await req.json();

  const vercel = new VercelAPI({
    token: Deno.env.get("VERCEL_API_TOKEN")!,
    teamId: Deno.env.get("VERCEL_TEAM_ID") ?? undefined,
  });

  const projectId = "your_project_id";

  try {
    if (action === "list") {
      const domains = await vercel.listDomains(projectId);
      return new Response(JSON.stringify(domains), { status: 200 });
    }

    if (action === "add" && zip_url) {
      const added = await vercel.addDomain(projectId, zip_url);
      return new Response(JSON.stringify(added), { status: 201 });
    }

    if (action === "delete" && domain) {
      await vercel.removeDomain(projectId, domain);
      return new Response("Deleted", { status: 204 });
    }

    return new Response("Invalid action or missing domain", { status: 400 });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
});
