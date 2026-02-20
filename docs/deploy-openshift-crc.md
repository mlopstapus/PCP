# Deploying PCP to OpenShift CRC

Step-by-step guide to deploy the Prompt Control Plane on a local OpenShift cluster using [CRC (CodeReady Containers)](https://developers.redhat.com/products/openshift-local/overview).

## Prerequisites

- **CRC installed and running** — verify with `crc status`
- **CRC memory: 14GB+** — CRC defaults to ~11GB which is not enough for OpenShift + PostgreSQL + PCP. Increase before starting:
  ```bash
  crc config set memory 14336   # 14GB
  crc start
  ```
- **`oc` CLI** — comes with CRC (`eval $(crc oc-env)`)
- **`helm` v3+**
- **Docker Desktop** — with CRC's registry added as an insecure registry (see Step 2)

## Step 1: Log In and Create a Project

```bash
# Log in as kubeadmin (get password from CRC)
oc login -u kubeadmin https://api.crc.testing:6443
# When prompted, enter the password from: crc console --credentials

# Verify
oc whoami

# Create a project for PCP
oc new-project pcp
```

## Step 2: Build and Push the PCP Image

CRC has an internal image registry. You need to push the PCP image there.

### Configure Docker Desktop for CRC's Registry

CRC uses a self-signed CA. Docker Desktop will refuse to push unless you add the
registry as insecure. **This does not require sudo.**

1. Open **Docker Desktop → Settings → Docker Engine**
2. Add to the JSON config:
   ```json
   {
     "insecure-registries": [
       "default-route-openshift-image-registry.apps-crc.testing"
     ]
   }
   ```
3. Click **Apply & Restart**

> **Alternative (requires admin/sudo):** Trust the CRC CA system-wide instead:
> ```bash
> oc extract secret/router-ca --keys=tls.crt -n openshift-ingress-operator --confirm
> sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain tls.crt
> ```

### Build and Push

```bash
# Get the external registry hostname
REGISTRY=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}')

# Log Docker into the registry
docker login $REGISTRY -u kubeadmin -p $(oc whoami -t)

# Build the image
# --provenance=false and --sbom=false are required — without them, Docker BuildKit
# produces a manifest list with attestations that the OpenShift registry rejects (500 error)
docker build --provenance=false --sbom=false -t $REGISTRY/pcp/pcp:0.1.0 .

# Push
docker push $REGISTRY/pcp/pcp:0.1.0
```

Verify the image landed in the registry:
```bash
oc get imagestream -n pcp
```

## Step 3: Deploy PostgreSQL

CRC's VM cannot pull external images (Docker Hub, Quay, etc.) due to TLS/proxy
issues. Use the **OpenShift built-in PostgreSQL template** instead of Bitnami — the
image is already cached in CRC.

```bash
oc new-app postgresql-persistent \
  --param POSTGRESQL_USER=pcp \
  --param POSTGRESQL_PASSWORD=pcp \
  --param POSTGRESQL_DATABASE=pcp \
  --param VOLUME_CAPACITY=1Gi
```

Wait for it to be ready:
```bash
oc get pods -w
# Wait until the postgresql pod shows 1/1 Running
```

> **Note:** The OpenShift template creates a service named `postgresql` (not
> `sh-postgresql` like the Bitnami chart). This affects the Helm install in the
> next step.

## Step 4: Install the PCP Helm Chart

The PCP image is referenced differently inside vs outside the cluster:

| Context | Registry URL |
|---------|-------------|
| `docker push` (external) | `default-route-openshift-image-registry.apps-crc.testing` |
| Pod image pull (internal) | `image-registry.openshift-image-registry.svc:5000` |

Install the chart using the **internal** registry path, and override the PostgreSQL
host to match the OpenShift template service name:

```bash
helm install pcp ./charts/pcp \
  --set image.repository=image-registry.openshift-image-registry.svc:5000/pcp/pcp \
  --set image.tag=0.1.0 \
  --set postgresql.host=postgresql
```

## Step 5: Verify the Deployment

```bash
# Check pods — you should see pcp and postgresql running
oc get pods

# Check the migration job (runs automatically via Helm post-install hook)
oc get jobs

# Check PCP logs
oc logs deploy/pcp
```

## Step 6: Expose PCP via an OpenShift Route

```bash
oc expose svc/pcp
oc get route pcp
```

This creates a route like `http://sh-pcp.apps-crc.testing`.

Test it:
```bash
ROUTE=$(oc get route pcp -o jsonpath='{.spec.host}')
curl http://$ROUTE/health
# Expected: {"status":"ok"}
```

## Step 7: Create Prompts

Create prompts via the admin dashboard or REST API:

```bash
curl http://$ROUTE/api/v1/prompts | python3 -m json.tool
```

## Step 8: Configure Your MCP Client

Get the route URL:

```bash
oc get route pcp -o jsonpath='{.spec.host}'
```

Update your IDE's MCP config (e.g. `~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "pcp": {
      "serverUrl": "http://sh-pcp.apps-crc.testing/mcp"
    }
  }
}
```

Restart your IDE to pick up the new MCP config.

## Cleanup

```bash
# Remove PCP
helm uninstall pcp

# Remove PostgreSQL (deployed via OpenShift template)
oc delete all -l app=postgresql
oc delete pvc postgresql
oc delete secret postgresql

# Delete the project
oc delete project pcp
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Insufficient memory / pods stuck in Pending** | CRC needs at least 14GB RAM. Run `crc stop`, `crc config set memory 14336`, `crc start`. |
| **Multus CNI "Unauthorized" errors** | CRC networking glitch. Restart CRC: `crc stop && crc start`. |
| **`x509: certificate signed by unknown authority` on `docker push`** | Add the registry to Docker Desktop's insecure registries (see Step 2). |
| **500 error on `docker push` (layers push but manifest fails)** | Rebuild with `--provenance=false --sbom=false` to produce a simple manifest instead of a manifest list. |
| **ImagePullBackOff for external images (Docker Hub)** | CRC's VM can't reach external registries due to TLS issues. Use OpenShift built-in templates or push images to the internal registry manually. |
| **ImagePullBackOff for PCP image** | Verify image was pushed: `oc get imagestream -n pcp`. Ensure the Helm install uses the **internal** registry URL (`image-registry.openshift-image-registry.svc:5000`). |
| **CrashLoopBackOff on PCP pod** | Check logs: `oc logs deploy/pcp`. Usually a DB connection issue — verify PostgreSQL is running and `postgresql.host` matches the service name. |
| **Migration job stuck** | Check: `oc logs job/sh-migrate`. DB might not be ready yet. Delete the job and re-run: `oc delete job sh-migrate && helm upgrade pcp ./charts/pcp ...` |
| **Route not resolving** | CRC routes use `*.apps-crc.testing`. Verify DNS: `ping apps-crc.testing`. |
