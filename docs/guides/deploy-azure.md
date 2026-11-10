# Deploying Tenantry to Azure

This puts the live demo on one Azure VM at `tenantry.pengopal.com` (ADR-0029). You do these steps once; after that, a version tag deploys by itself.

The guide uses `<VM_IP>` for the VM's public address. For a different domain, change it in steps 2 to 6.

## 1. Create the VM (Azure portal)

1. Activate [Azure for Students](https://azure.microsoft.com/en-us/free/students) with your school email.
2. **Create a resource → Virtual machine:**
   - Image: **Ubuntu Server 24.04 LTS, x64**
   - Size: **B2ats v2** (2 vCPU, 1 GB). Azure lists 750 hours a month of this size as free, enough for one VM all month; the review screen still shows its list price. If the site later feels slow, resize to **B1ms** (2 GB, paid).
   - Disks: **Premium SSD**, size **64 GiB** (P6), which Azure lists as free for 12 months.
   - Region: East US or Canada Central if allowed; otherwise the closest one that lets you create the VM. Azure for Students allows only some regions; if one is refused, try another.
   - Authentication: **SSH public key**, username `azureuser`. Download the key Azure generates, or paste your own.
   - Inbound ports: **SSH (22), HTTP (80), HTTPS (443)**
   - Public IP: make sure it is **Static**.
3. Note the VM's public IP address: this is `<VM_IP>`.
4. After a day, check **Cost Management → Cost analysis** (or the free services view) to confirm the VM hours are counted as free. Your credit still pays for the public IP.
5. Optional but sensible: **Cost Management → Budgets**, a budget of $20 a month with an email alert, so you can see the credit going.

Moving between sizes later is **Size → Resize** on the VM, and a reboot.

## 2. Point the domain at it (Cloudflare)

In **pengopal.com → DNS → Records**, add three **A** records, all with the proxy **off** (grey cloud, "DNS only"):

| Name                | Content   |
| ------------------- | --------- |
| `tenantry`          | `<VM_IP>` |
| `*.tenantry`        | `<VM_IP>` |
| `*.portal.tenantry` | `<VM_IP>` |

Then **My Profile → API Tokens → Create Token → Edit zone DNS**, with **Zone: pengopal.com**. Copy the token: this is `CLOUDFLARE_API_TOKEN` in step 5.

## 3. Set up email (Resend)

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add domain:** `tenantry.pengopal.com`. Add the records it lists to Cloudflare (proxy off for any that offer it), then press **Verify**.
3. **API Keys → Create**, with sending access. Copy it: this is `RESEND_API_KEY` in step 5.

## 4. Set up GitHub

On your own computer, make the key the deploy uses:

```bash
ssh-keygen -t ed25519 -f tenantry_deploy -N "" -C tenantry-deploy
```

```bash
ssh-keyscan -t ed25519 <VM_IP>
```

In the repository's **Settings**:

- **Environments → New environment → `production`.** Under **Deployment branches and tags**, choose **Selected branches and tags**, then **Add deployment branch or tag rule** with **Ref type: Tag** and pattern `v*`. A branch rule with the same pattern refuses the tag. Add these **environment secrets**:

  | Secret               | Value                                   |
  | -------------------- | --------------------------------------- |
  | `DEPLOY_SSH_KEY`     | the whole contents of `tenantry_deploy` |
  | `DEPLOY_HOST`        | `<VM_IP>`                               |
  | `DEPLOY_KNOWN_HOSTS` | the line `ssh-keyscan` printed          |

- **Secrets and variables → Actions → Variables → Repository variables.** Not environment variables: the image builds run outside the `production` environment and cannot see those.

  | Variable                 | Value                                                                                                             |
  | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
  | `TENANTRY_BASE_DOMAIN`   | `tenantry.pengopal.com`                                                                                           |
  | `TENANTRY_DEMO_PASSWORD` | a password for the demo accounts. **It is shown publicly** on the welcome page, so use nothing you use elsewhere. |

- **Issues → Labels → New label:** `skip-changelog`.

Then **your profile → Settings → Developer settings → Personal access tokens → Tokens (classic)**: a token with only `read:packages`. This is `GHCR_TOKEN` in step 5; it lets the VM pull the images.

## 5. Prepare the VM

Tenantry's Phase 6b must be merged to `main` first, because this script is read from there.

```bash
ssh -i <your-azure-key> azureuser@<VM_IP>
```

```bash
curl -fsSL https://raw.githubusercontent.com/mfurqanwork/tenantry-keycloak-multitenancy/main/infra/prod/bootstrap-vm.sh | sudo bash
```

This installs Docker, adds 2 GB of swap, creates the `tenantry` user and the nightly reset, and writes `/opt/tenantry/.env` with fresh random secrets. Fill in the blanks:

```bash
sudo nano /opt/tenantry/.env
```

| Setting                | Value                                |
| ---------------------- | ------------------------------------ |
| `ACME_EMAIL`           | your email, for certificate notices  |
| `CLOUDFLARE_API_TOKEN` | from step 2                          |
| `RESEND_API_KEY`       | from step 3                          |
| `SEED_PASSWORD`        | the same as `TENANTRY_DEMO_PASSWORD` |
| `GHCR_TOKEN`           | from step 4                          |

Allow the deploy key to run the deploy, and nothing else. Replace the end of this line with the contents of `tenantry_deploy.pub`:

```bash
echo 'command="/opt/tenantry/deploy-entry.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA... tenantry-deploy' | sudo -u tenantry tee /home/tenantry/.ssh/authorized_keys
```

## 6. Release

On `main`, with everything merged:

```bash
pnpm release 0.6.0
```

```bash
git push origin main v0.6.0
```

The **Release** workflow in GitHub Actions tests the tag, publishes the images and the GitHub Release, deploys, and checks the live site. The first deploy takes about ten minutes. Then open <https://tenantry.pengopal.com>.

## Day to day

- **A new release:** add lines under Unreleased as you go, then `pnpm release <version>` and push the commit and tag.
- **Roll back:** Actions → Release → Run workflow, with the earlier tag.
- **The demo resets** at 03:00 UTC, for about a minute. The log is `/opt/tenantry/reset.log`.
- **Look at the running stack:** on the VM, as `azureuser`:

```bash
sudo docker ps
```

```bash
sudo docker logs tenantry-keycloak-1 --tail 100
```

## If something goes wrong

| What you see                                           | Likely cause                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| The deploy stops at pulling images                     | `GHCR_TOKEN` is wrong or expired. The running site is untouched.                                                |
| The browser reports a certificate error                | `CLOUDFLARE_API_TOKEN` is wrong, or the DNS records are missing. See the logs of `tenantry-caddy-1`.            |
| Sign-up or invite emails do not arrive                 | The Resend domain is not verified, or the day's 100 emails are used up. See the Resend dashboard.               |
| A subdomain shows `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | The Cloudflare records are proxied (orange cloud). Set all three to **DNS only**.                               |
| The deploy stops with `api-1 is unhealthy`             | Keycloak is still waking from swap. Run the deploy again (Actions → Release → Run workflow), or resize to B1ms. |
| Keycloak restarts or the site is slow                  | The VM is short of memory. Resize it to B1ms (2 GB).                                                            |
| The demo sign-ins are refused                          | `SEED_PASSWORD` differs from `TENANTRY_DEMO_PASSWORD`, or a visitor changed it until the next reset.            |
