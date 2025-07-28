import { VercelDeployRequest } from "./types.ts";

const AIRFLOW_API_URL = Deno.env.get("AIRFLOW_API_URL");
const AIRFLOW_AUTH_TOKEN = Deno.env.get("AIRFLOW_AUTH_TOKEN");
const AIRFLOW_DAG_ID = Deno.env.get("AIRFLOW_DAG_ID");

Deno.serve(async (req) => {
  try {
    // Check if the request method is POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    }

    const body: VercelDeployRequest = await req.json();
    const { url, username, project_name, action = "deploy" } = body;

    if (!username || !url) {
      return new Response("Missing required fields", { status: 400 });
    }

    // ----- fire‑and‑forget --------------------------------------------------
    (async () => {
      try {
        const triggerUrl = `${AIRFLOW_API_URL}/${AIRFLOW_DAG_ID}/dagRuns`;

        await fetch(triggerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AIRFLOW_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            conf: { username, url, project_name },
          }),
        });
        // Any errors are logged but never surface to the client
      } catch (err) {
        console.error("Unable to trigger DAG:", err);
      }
    })();
    // -----------------------------------------------------------------------

    // Instant reply – we’re not waiting for Airflow or the fetch above
    return new Response(
      JSON.stringify({
        status: "queued",
        message: "DAG trigger request accepted",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response("Internal Error: " + err.message, { status: 500 });
  }
});
