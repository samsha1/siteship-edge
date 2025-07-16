import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// import { VercelDeployRequest } from "./types.ts"; // optional helper types

serve(async (req) => {
  const { username, zip_url } = await req.json();

  // Init Supabase client with env vars
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Download the ZIP file
  const zipRes = await fetch(zip_url);
  if (!zipRes.ok) {
    return new Response("Failed to download ZIP", { status: 500 });
  }
  const zipArrayBuffer = await zipRes.arrayBuffer();

  // Unzip in Deno: use `zip` module
  const unzip = await import("https://deno.land/x/zip@v1.2.3/mod.ts");
  const files = unzip.decompress(zipArrayBuffer);

  // Build Vercel files payload
  const vercelFiles = [];
  for (const [fileName, fileData] of Object.entries(files)) {
    vercelFiles.push({
      file: fileName,
      data: new TextDecoder().decode(fileData),
    });
  }

  // Create project name
  const projectName = `${username}-site`;

  // Call Vercel Deploy REST API
  const vercelRes = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("VERCEL_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectName,
      files: vercelFiles,
      projectSettings: {
        framework: null,
      },
    }),
  });

  if (!vercelRes.ok) {
    const error = await vercelRes.text();
    return new Response(`Vercel deploy failed: ${error}`, { status: 500 });
  }

  const vercelData = await vercelRes.json();
  const url = vercelData.url;

  return new Response(
    JSON.stringify({
      deploy_url: `https://${url}`,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
});
