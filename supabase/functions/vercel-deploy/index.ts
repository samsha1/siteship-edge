// index.ts
import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { VercelDeployRequest } from "./vercel/types.ts";
// import { Vercel } from '@vercel/sdk';

serve(async (req) => {
  const { username, publicUrl, projectName }: VercelDeployRequest = await req.json();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  
  // Download & unzip using OS command
  const zipRes = await fetch(publicUrl);
  if (!zipRes.ok) return new Response("Download failed", { status: 500 });
  const data = new Uint8Array(await zipRes.arrayBuffer());
  const tmpZip = await Deno.makeTempFile({ suffix: ".zip" });
  await Deno.writeFile(tmpZip, data);
  const outDir = await Deno.makeTempDir();

  const proc = Deno.run({ cmd: ["unzip", "-o", tmpZip, "-d", outDir], stdout: "piped", stderr: "piped" });
  const { success } = await proc.status();
  if (!success) {
    const err = new TextDecoder().decode(await proc.stderrOutput());
    return new Response(`Unzip failed: ${err}`, { status: 500 });
  }

  // Read files
  const files: Array<{ file: string; data: string }> = [];
  for await (const entry of Deno.readDir(outDir)) {
    const path = `${outDir}/${entry.name}`;
    const content = await Deno.readTextFile(path);
    files.push({ file: entry.name, data: content });
  }

  // Deploy to Vercel
  const project = projectName || `${username}-site`;
  const resp = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("VERCEL_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: project, files, projectSettings: { framework: null } }),
  });

  if (!resp.ok) return new Response(await resp.text(), { status: 500 });
  const { url } = await resp.json();
  return new Response(JSON.stringify({ deploy_url: `https://${url}` }), { headers: { "Content-Type": "application/json" } });
});
