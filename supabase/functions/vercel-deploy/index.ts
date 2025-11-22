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
    const { username, project_name, prompt, metadata } = body;

    if (!username || project_name || prompt) {
      return new Response("Missing required fields", { status: 400 });
    }
    console.log("Received request:", body);

    // ----- fire‑and‑forget --------------------------------------------------
    (async () => {
      try {
        const triggerUrl = `${AIRFLOW_API_URL}/api/v2/dags/${AIRFLOW_DAG_ID}/dagRuns`;
        const now = new Date().toISOString(); // "2025-07-28T15:30:00.000Z"
        const dagPayload = {
          logical_date: now,
          conf: {
            username,
            project_name,
            prompt,
            metadata
          }
        };
        await fetch(triggerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${AIRFLOW_AUTH_TOKEN}`,
          },
          body: JSON.stringify(dagPayload),
        }).catch((err) => {
          console.error(`Fetch error: ${err.message}`);
          return new Response(
            JSON.stringify({
              status: "error",
              message: "Workflow Failed",
            }),
            { status: 501, headers: { "Content-Type": "application/json" } },
          );
        }).then(async (res) => {
          if (res && !res.ok) {
            console.error(`Airflow responded with status: ${res.status}  ${res.statusText}`);
            console.error(`Response body:, ${JSON.stringify(await res.text())}`);
          }
        });
        console.log("DAG triggered successfully");
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
