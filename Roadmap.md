### This file contains Steps and commands that I followed...

**Environment:** Ubuntu 26.04 (VMware Workstation Pro)
**Tools and Technologies:** Docker, Minikube, Kubernetes, Helm, Node.js/Express, PostgreSQL, Prometheus, Grafana, Alertmanager.


## Phase 1 — Setup Kubernetes Environment

- [x] Install Docker and configure user access.
- [x] Create a Minikube cluster and verify nodes and Pods.
- [x] Practice namespaces, Services, scaling, self-healing, and DNS.
- [x] Install Helm (used to install the observability release -> https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack).

```bash
# Existing Minikube cluster can be kept; create a separate larger profile
minikube stop -p minikube
minikube start -p sre-lab --driver=docker --cpus=4 --memory=8192
minikube profile sre-lab
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -A
kubectl get storageclass
helm version
```

## Phase 2 — Deploy Observability Stack

- [x] Install the `kube-prometheus-stack` Helm release (Grafana deployment subsequently reported available).
- [ ] Verify **all** Prometheus, Grafana, Alertmanager, node-exporter, and kube-state-metrics Pods/targets are healthy.

```bash
kubectl create namespace monitoring   # Only once; skip if it exists
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
# monitoring-values.yaml: retain Prometheus, Grafana, Alertmanager,
# node-exporter, kube-state-metrics, and persistent storage.
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --values monitoring-values.yaml --wait --timeout 15m
kubectl get pods -n monitoring
kubectl get pvc -n monitoring
helm status monitoring -n monitoring
```

**Note:** The initial Helm install reported `ProgressDeadlineExceeded` for Grafana. Later, `kubectl describe deployment monitoring-grafana -n monitoring` showed `Available=True` and `1/1` replicas. Verify the entire Helm release rather than assuming all components are healthy.

## Phase 3 — Deploy Sample Application and Database

- [x] Build an Express API with `/health/live`, `/health/ready`, `/api/info`, `/api/db-check`, and `/api/readings`.
- [x] Prepare an instrumented `server.js` exposing `/metrics` (deployment/collection should be verified).
- [x] Create PostgreSQL StatefulSet, a new database, and persistent storage (lab steps established).
- [ ] Confirm the latest `monitoring-api:v4` is running and returning metrics in `sre-lab`.

```bash
# API image
cd ~/kubernetes-project/backend
npm install express pg prom-client
docker build -t monitoring-api:v4 .
minikube -p sre-lab image load monitoring-api:v4

# From the new cluster manifest directory
cd ~/kubernetes-project/sre-lab
kubectl apply -f postgres.yaml
kubectl apply -f configmap.yaml
kubectl apply -f api.yaml  # image: monitoring-api:v4
kubectl rollout status statefulset/postgres
kubectl rollout status deployment/monitoring-api
kubectl get pods,pvc,svc

# Access API locally; run in its own terminal
kubectl port-forward svc/monitoring-api 8080:80
# In a second terminal
curl http://localhost:8080/health/ready
curl http://localhost:8080/api/readings
curl http://localhost:8080/metrics
```

**Port note:** If the Service uses `targetPort: http`, the Deployment container must declare `ports: [{name: http, containerPort: 3000}]`. Alternatively use `targetPort: 3000` in the Service.

## Phase 4 — Metrics Collection

- [ ] Create and verify a `ServiceMonitor` for the API's `/metrics` endpoint.
- [ ] Confirm its target is `UP` in Prometheus.
- [x] Learn Pod/Service DNS and basic monitoring components.
- [ ] Explore PromQL against live application and infrastructure data.

```bash
# Prometheus UI, in a separate terminal
kubectl port-forward -n monitoring \
  svc/monitoring-kube-prometheus-prometheus 9090:9090
# Visit http://localhost:9090/targets
```

PromQL practice:

```promql
up
sum by (phase) (kube_pod_status_phase)
sum(rate(http_requests_total[5m]))
sum by (namespace, pod) (rate(container_cpu_usage_seconds_total{container!="",pod!=""}[5m]))
```

## Phase 5 — Dashboards and Alerting

- [x] Open the Grafana dashboard library and examine available Kubernetes dashboards.
- [ ] Interpret Cluster, Namespace/Pod, CoreDNS, and Node dashboards using actual metrics.
- [ ] Build a custom API dashboard: request rate, 5xx error rate, p95 latency, memory.
- [ ] Configure CPU/memory and API error-rate alerts; test notifications through Alertmanager.

```bash
# Grafana UI
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80
# Visit http://localhost:3001

# Retrieve Grafana's admin password locally (do not commit or share)
kubectl get secret -n monitoring monitoring-grafana \
  -o jsonpath='{.data.admin-password}' | base64 -d; echo

# Alertmanager UI
kubectl port-forward -n monitoring \
  svc/monitoring-kube-prometheus-alertmanager 9093:9093
# Visit http://localhost:9093
```

## Phase 6 — SRE Practices

- [ ] Define SLIs and SLOs for API availability and latency.
- [ ] Calculate an error budget and define alert thresholds.
- [ ] Simulate API Pod and PostgreSQL failures; examine readiness, logs, metrics, and recovery.
- [ ] Record incidents and create a short troubleshooting runbook.

```bash
kubectl get pods -A
kubectl describe pod <pod-name>
kubectl logs deployment/monitoring-api
kubectl get endpointslices -l kubernetes.io/service-name=monitoring-api
kubectl rollout status deployment/monitoring-api
```

## Phase 7 — Production-Style Delivery

- [ ] Store application source, Dockerfile, Kubernetes manifests, and Helm values in Git.
- [ ] Add GitHub Actions to test/build images and deploy to the lab.
- [ ] Document architecture, operational checks, known issues, and incident lessons.

```text
kubernetes-project/
├── backend/                 # server.js, package.json, Dockerfile
├── sre-lab/                 # postgres.yaml, configmap.yaml, api.yaml,
│                           # monitoring-values.yaml
├── docs/                    # architecture.md, runbook.md, incidents.md
└── .github/workflows/       # CI/CD (planned)
```

## Quick daily checks

```bash
kubectl config current-context
minikube -p sre-lab status
kubectl get nodes
kubectl get pods -A
kubectl get pvc -A
helm status monitoring -n monitoring
kubectl get svc -n monitoring
```

**Next milestone:** Verify the entire monitoring stack, deploy or confirm `monitoring-api:v4`, create a `ServiceMonitor`, and confirm the API target is `UP` in Prometheus before designing custom dashboards.
