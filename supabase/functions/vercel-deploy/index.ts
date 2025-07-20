import { Octokit } from "https://esm.sh/@octokit/core@5.0.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.0?bundle";
import { VercelDeployRequest, GitCreateTreeParamsTree } from "./types.ts";
import {Vercel} from "npm:@vercel/sdk"

const GITHUB_REPO = "samsha1/siteshipai-codebox";
const GITHUB_TOKEN = Deno.env.get("GITHUB_ACCESS_TOKEN_FOR_AI_GENERATED_CODE")!;
const VERCEL_TOKEN = Deno.env.get("VERCEL_ACCESS_TOKEN")!;
const VERCEL_GITHUB_REPO = "siteshipai-codebox"; // The Vercel project name
const octokit = new Octokit({ auth: GITHUB_TOKEN });

const vercel = new Vercel({
  bearerToken: VERCEL_TOKEN,
});


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
      mode: "100644",
      type: "blob",
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
  try {
    // Create a new deployment
    const createResponse = await vercel.deployments.createDeployment({
      requestBody: {
        name: projectName, //The project name used in the deployment URL
        target: 'production',
        gitSource: {
          type: 'github',
          repo: VERCEL_GITHUB_REPO,
          ref: branch, 
          org: 'samsha1', //For a personal account, the org-name is your GH username
        },
      },
    });
    console.log(`Creating deployment for branch: ${branch}`);
    const deploymentId = createResponse.id;

    console.log(
      `Deployment created: ID ${deploymentId} and status ${createResponse.status}`,
    );

    // Check deployment status
    let deploymentStatus;
    let deploymentURL;
    do {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds between checks

      const statusResponse = await vercel.deployments.getDeployment({
        idOrUrl: deploymentId,
        withGitRepoInfo: 'true',
      });

      deploymentStatus = statusResponse.status;
      deploymentURL = statusResponse.url;
      console.log(`Deployment status: ${deploymentStatus}`);
    } while (
      deploymentStatus === 'BUILDING' ||
      deploymentStatus === 'INITIALIZING' || deploymentStatus === 'QUEUED'
    );

    if (deploymentStatus === 'READY') {
      console.log(`Deployment successful. URL: ${deploymentURL}`);

      const aliasResponse = await vercel.aliases.assignAlias({
        id: deploymentId,
        requestBody: {
          alias: `${branch}-${username}.vercel.app`,
          redirect: null,
        },
      });
      console.log(`Alias assigned: ${branch}-${username}.vercel.app`);
      console.log(`Alias created: ${aliasResponse}`);
      return `https://${aliasResponse.alias}`; // Return the alias URL
    } else {
      console.log(`Deployment failed or was canceled: ${deploymentStatus}`);
    }
  } catch (error) {
    console.error(
      error instanceof Error ? `Error: ${error.message}` : String(error),
    );
  }
}
