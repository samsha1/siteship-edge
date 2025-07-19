import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Octokit } from "https://esm.sh/octokit?dts";

const TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const OWNER = "your-github-username";
const REPO = "your-repo-name";

serve(async (req) => {
  const { username, files } = await req.json() as {
    username: string;
    files: Array<{ name: string; content: string }>;
  };

  const timestamp = Date.now();
  const branch = `generated/${username}-${timestamp}`;
  const octokit = new Octokit({ auth: TOKEN });

  // Get the base SHA
  const { data: refData } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/heads/{branch}",
    { owner: OWNER, repo: REPO, branch: "main" }
  );
  const baseSha = refData.object.sha;

  // Create new branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    owner: OWNER,
    repo: REPO,
    ref: `refs/heads/${branch}`,
    sha: baseSha,
  });

  // Push files
  for (const { name, content } of files) {
    const path = `generated/${username}/${name}`;
    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner: OWNER,
      repo: REPO,
      path,
      message: `Add ${name} for ${username}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch,
    });
  }

  return new Response(JSON.stringify({ branch }), {
    headers: { "Content-Type": "application/json" },
  });
});
