# Deploying on AWS EKS (Kubernetes)

For massive scale (100k+ concurrent users), AWS EKS is the recommended platform. This guide explains how to deploy our refined Kubernetes manifests.

## 1. Prerequisites
- `aws-cli` configured
- `eksctl` installed
- `kubectl` installed

## 2. Create Cluster
```bash
eksctl create cluster \
  --name aviator-prod \
  --region us-east-1 \
  --nodegroup-name standard-nodes \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed
```

## 3. Deployment
```bash
# Apply the manifests
kubectl apply -f k8s/

# Verify the HPAs are registered
kubectl get hpa
```

## 4. Auto-Scaling In Action
The system will now scale automatically based on the configurations in `k8s/`:
- **Gateway**: Scales between 5 and 50 pods based on 60% CPU.
- **Ledger Worker**: Scales between 6 and 40 pods based on 70% CPU.

## 5. Load Balancing
AWS will automatically create an ELB (Elastic Load Balancer) when the `gateway` Service (type: LoadBalancer) is applied. Look for the external IP:
```bash
kubectl get svc gateway
```
