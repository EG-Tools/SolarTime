# Cloudflare deployment through GitHub Actions

## One-time owner authorization

Do not send API tokens, Global API Keys or passwords in chat, commit them, or put them in plain repository variables.

Create a dedicated Cloudflare API token called `SolarTime GitHub Deploy`. For this Worker/R2 project, configure Account / Workers Scripts / Edit, Account / Workers R2 Storage / Edit, and Account / Account Settings / Read. Limit account resources to the SolarTime account `4640527a19614f7b65a034f422704b64`. No DNS, billing write, zone-route, KV or global administrator access is requested by this workflow. These are account-scoped product permissions; they are not a promise that Cloudflare limits the token to one Worker or bucket. Use a separate account when stricter isolation is necessary.

Add the token as a **repository secret** in `EG-Tools/SolarTime` under Settings -> Secrets and variables -> Actions -> Secrets -> New repository secret:

- Name: `CLOUDFLARE_API_TOKEN`
- Secret: the token value

The account ID is already fixed in the workflow. An R2 S3 access key is not a substitute for the Cloudflare REST/Workers token used by the existing Wrangler upload tool. Set an appropriate expiry, rotate the secret when needed, and revoke it in Cloudflare to stop further deployments.

Official references:
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/r2/api/tokens/
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## Execution and scope

`.github/workflows/deploy-cloudflare.yml` deploys the exact successful main-push revision after `Verify Solar Time` completes, or from a manual `Deploy Cloudflare` run on main. Superseded commits, failed tests and pull requests are not deployed. The old PR-specific Cloudflare deployment job was removed; PR validation receives no Cloudflare token. The token is exposed only to the authorization gate and guarded deployment step, not `npm ci`, and is never printed deliberately.

Adding the secret does not itself trigger deployment. After this PR has been merged, use Actions -> Deploy Cloudflare -> Run workflow -> main, or allow the next successful main-push validation to trigger it. Do not confuse a skipped no-token job with a successful deployment: the job summary explicitly says NOT deployed when authorization is missing.

The deployment command tests the source, builds the static assets, uploads the versioned Windows helper and source, checks remote hashes, publishes the `solar-time` Worker, verifies its receipt API and runtime files, then verifies Pages. It does not re-upload the planet texture/media archive or perform arbitrary account-wide administration. User-approved media changes can use the existing reviewed upload tools separately.

GitHub Pages and Worker assets are separate releases. Keep runtime versions aligned and verify both origins after deployment. Changes to a future native receipt protocol must be staged compatibly; this workflow does not make independent Pages/Worker deployment atomic. A token secret does not provide the chat session with direct dashboard access: changes flow through reviewed Git commits and Actions logs.
