import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { decompress } from "https://deno.land/x/zip@v1.2.3/decompress.ts";
import { Octokit } from "https://esm.sh/@octokit/core@5.0.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.0?bundle";

import { VercelDeployRequest, GitCreateTreeParamsTree } from "./types.ts";

const GITHUB_REPO = "samsha1/siteshipai-codebox";
const GITHUB_TOKEN = Deno.env.get("GITHUB_ACCESS_TOKEN_FOR_AI_GENERATED_CODE")!;
const VERCEL_TOKEN = Deno.env.get("VERCEL_TOKEN")!;
const octokit = new Octokit({ auth: GITHUB_TOKEN });

Deno.serve(async (req) => {
  try {
      // Check if the request method is POST
     if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const body: VercelDeployRequest = await req.json();
    const { username, publicUrl, projectName = "codebox", action = "deploy" } = body;

    if (!username || !publicUrl) {
      return new Response("Missing required fields", { status: 400 });
    }

    const branch = `${username}-${Date.now()}`;

    // Fetch ZIP file from the public URL
    const res = await fetch(publicUrl);
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch ZIP file" }),
        { status: 400 }
      );
    }
    const zipData = new Uint8Array(await res.arrayBuffer());
    const unzippedFiles = unzipSync(zipData); // Object: { [filename]: Uint8Array }
    const files: { path: string; content: string }[] = [];
    for (const [filename, content] of Object.entries(unzippedFiles)) {
      const text = new TextDecoder().decode(content as Uint8Array);
      files.push({ path: filename, content: text });
      // Log for demo purposes (you can push this to GitHub instead)
      console.log(`Unzipped: ${filename}`);
      console.log(text);
    }

    // 4. Push files to GitHub branch
    await pushToGitHub(branch, files);

    // 5. Trigger Vercel deployment
    const deployedUrl = await deployToVercel(branch, projectName, username);

    return Response.json({ branch, deployedUrl });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal Error: " + err.message, { status: 500 });
  }
});

// Helpers

async function collectFiles(dir: string): Promise<{ path: string, content: string }[]> {
  const result: { path: string, content: string }[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isFile) {
      const content = await Deno.readTextFile(fullPath);
      result.push({ path: entry.name, content });
    } else if (entry.isDirectory) {
      const nested = await collectFiles(fullPath);
      result.push(...nested.map(f => ({ path: `${entry.name}/${f.path}`, content: f.content })));
    }
  }
  return result;
}

async function pushToGitHub(branch: string, files: { path: string, content: string }[]) {
  // Get latest commit SHA from default branch
  const { data: refData } = await octokit.request(`GET /repos/${GITHUB_REPO}/git/ref/heads/main`);
  const latestCommitSha = refData.object.sha;

  // Get tree SHA
  const { data: commitData } = await octokit.request(`GET /repos/${GITHUB_REPO}/git/commits/${latestCommitSha}`);
  const baseTree = commitData.tree.sha;

  // Create blobs for each file
  const blobs: GitCreateTreeParamsTree[] = await Promise.all(files.map(async file => {
    const { data: blob } = await octokit.request("POST /repos/{owner}/{repo}/git/blobs", {
      owner: GITHUB_REPO.split("/")[0],
      repo: GITHUB_REPO.split("/")[1],
      content: file.content,
      encoding: "utf-8",
    });
    return { path: file.path, sha: blob.sha, mode: `100644`, type: `blob` }; // file mode
  }));

  // Create tree
  const { data: tree } = await octokit.request("POST /repos/{owner}/{repo}/git/trees", {
    owner: GITHUB_REPO.split("/")[0],
    repo: GITHUB_REPO.split("/")[1],
    base_tree: baseTree,
    tree: blobs.map(f => ({
      path: f.path,
      sha: f.sha,
    })),
  });

  // Create commit
  const { data: commit } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
    owner: GITHUB_REPO.split("/")[0],
    repo: GITHUB_REPO.split("/")[1],
    message: `Deploy ${branch}`,
    tree: tree.sha,
    parents: [latestCommitSha],
  });

  // Create new branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    owner: GITHUB_REPO.split("/")[0],
    repo: GITHUB_REPO.split("/")[1],
    ref: `refs/heads/${branch}`,
    sha: commit.sha,
  });
}

async function deployToVercel(branch: string, projectName: string, username: string) {
  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectName,
      gitSource: {
        type: "github",
        repoId: GITHUB_REPO,
        ref: branch,
      },
      projectSettings: {
        framework: "vite",
      },
      target: "production",
    }),
  });

  const data = await response.json();
  return `https://${username}.vercel.app`;
}
