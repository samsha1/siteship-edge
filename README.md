# Supabase Edge Function: Trigger Airflow DAG

This Supabase Edge Function triggers an Apache Airflow DAG deployed on Astronomer using a fire-and-forget approach. It accepts a JSON payload with deployment details and initiates a DAG run without waiting for the Airflow response.

## Features
- Triggers an Airflow DAG via the Astronomer Airflow REST API.
- Fire-and-forget operation for low-latency responses.
- Handles User profile, project and activity throughout the chat.

## Prerequisites
- A Supabase project with the CLI installed.
- An Astronomer Airflow deployment with API access.
- Deno runtime (handled by Supabase Edge Functions).

## Installation
1. **Create the Function File**:
   - Save the `trigger_dag.ts` file in your Supabase project's `supabase/functions` directory.

2. **Set Environment Variables**:
   - Configure the following environment variables in your Supabase project settings (via the Supabase Dashboard or CLI):
     ```
     AIRFLOW_API_URL: Your Astronomer Airflow API endpoint (e.g., https://your-astronomer-deployment/api/v1/dags)
     AIRFLOW_DAG_ID: The ID of the Airflow DAG to trigger (e.g., your_dag_id)
     AIRFLOW_API_TOKEN: Your Astronomer Airflow API token
     ```
   - Use the Supabase CLI to set variables:
     ```bash
     supabase secrets set AIRFLOW_API_URL=<your-airflow-api-url>
     supabase secrets set AIRFLOW_DAG_ID=<your-dag-id>
     supabase secrets set AIRFLOW_API_TOKEN=<your-api-token>
     ```

3. **Deploy the Function**:
   - Deploy the function to Supabase using the CLI:
     ```bash
     supabase functions deploy trigger_dag
     ```

## Usage
Send a `POST` request to the deployed function endpoint with a JSON payload containing the following fields:
```json
{
  "username": "string",        // Required: Username initiating the deployment
  "publicUrl": "string",       // Required: Public URL of the deployed project
  "projectName": "string",     // Required: Name of the project
  "action": "string"           // Optional: Action to perform (defaults to "deploy")
}
```

### Example Request
Using `curl`:
```bash
curl -X POST https://<your-supabase-project>.supabase.co/functions/v1/trigger_dag \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-supabase-anon-key>" \
  -d '{
    "username": "user123",
    "publicUrl": "https://example.com",
    "projectName": "my-project",
    "action": "deploy"
  }'
```

### Response
- **Success** (HTTP 200):
  ```json
  {
    "message": "DAG trigger initiated successfully",
    "dagRunId": "deploy_my-project_1625091234567"
  }
  ```
- **Error** (HTTP 400 or 500):
  ```json
  {
    "error": "Missing required fields: username, publicUrl, projectName"
  }
  ```

## Function Details
- **File**: `trigger_dag.ts`
- **Runtime**: Deno
- **API Call**: Uses `fetch` to make a POST request to the Airflow REST API (`/api/v1/dags/{dag_id}/dagRuns`).
- **Fire-and-Forget**: The function triggers the DAG without awaiting the Airflow response, ensuring quick client responses.
- **Timeout**: Includes a 5-second timeout to prevent hanging requests.
- **Error Handling**: Logs errors with context (DAG run ID and project name) for debugging without affecting the client response.

## Configuration
- **Environment Variables**:
  - `AIRFLOW_API_URL`: Ensure this points to your Astronomer deployment’s API endpoint.
  - `AIRFLOW_DAG_ID`: Set to the specific DAG you want to trigger.
  - `AIRFLOW_API_TOKEN`: Obtain from your Astronomer Airflow instance (must have permissions to trigger DAGs).
- **Payload Validation**: The function checks for required fields (`username`, `publicUrl`, `projectName`) and returns a 400 error if any are missing.
- **DAG Run ID**: Generated dynamically as `deploy_{projectName}_{timestamp}` for uniqueness.

## Troubleshooting
- **Function Not Deploying**: Ensure the Supabase CLI is authenticated and the `trigger_dag.ts` file is in the correct directory (`supabase/functions`).
- **Missing Environment Variables**: Verify that all required environment variables are set in the Supabase Dashboard or via the CLI.
- **API Errors**: Check Supabase logs for detailed error messages. Ensure the `AIRFLOW_API_TOKEN` has the correct permissions and the `AIRFLOW_API_URL` is accessible.
- **DAG Not Triggering**: Verify the `AIRFLOW_DAG_ID` exists in your Airflow instance and that the API token has DAG run permissions.

## Notes
- The function assumes the Airflow REST API is version `v2`. Adjust the `AIRFLOW_API_URL` if your Astronomer deployment uses a different API version.
- No Astronomer Deno SDK is available; the function uses standard HTTP requests via `fetch`.
- For enhanced reliability, consider adding retry logic for transient network failures (not included to maintain fire-and-forget simplicity).