# AWS Cost Optimization Guide

**Goal**: Deploy a 100k user betting platform for **$800-$1,000/month** (70% cost savings)

---

## 💰 Cost Comparison

| Setup | Monthly Cost | Users Supported | Savings |
|-------|--------------|-----------------|---------|
| Full AWS (Premium) | $3,000-$4,000 | 100k+ | Baseline |
| **Optimized (Recommended)** | **$800-$1,000** | **100k** | **70%** |
| Hybrid | $800 | 80k | 73% |
| Single Instance | $500 | 50k | 85% |

---

## 🎯 Recommended Setup: $800-$1,000/month

### Architecture Overview

```
Application Layer (Spot Instances):
├─ Gateway: 3x t4g.large (Spot) = $36/month
├─ Ledger Worker: 5x t4g.medium (Spot) = $45/month
└─ Callback: 1x t4g.small (Spot) = $3/month

Database Layer (Managed Services):
├─ Redis: ElastiCache r6g.large x3 (cluster) = $300/month
├─ Cassandra: AWS Keyspaces (serverless) = $400/month
└─ Kafka: MSK Provisioned (t3.small x3) = $150/month

Load Balancer:
└─ Application Load Balancer = $25/month

Total: ~$959/month
```

---

## 📋 Detailed Breakdown

### 1. Gateway (WebSocket Handling)

**Instance**: `t4g.large` (ARM Graviton, 2 vCPU, 8GB RAM)  
**Count**: 3 instances  
**Pricing Strategy**: **Spot Instances**

```
On-Demand: 3 × $60 = $180/month
Spot (90% off): 3 × $6 = $18/month ✅
ARM Discount (20%): 3 × $12 = $36/month ✅
```

**Why Spot**: Gateway is stateless, can handle interruptions

**Setup**:
```bash
# Auto Scaling Group with Spot Fleet
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name gateway-spot \
  --mixed-instances-policy '{
    "InstancesDistribution": {
      "OnDemandPercentageAboveBaseCapacity": 0,
      "SpotAllocationStrategy": "capacity-optimized"
    },
    "LaunchTemplate": {
      "LaunchTemplateSpecification": {
        "LaunchTemplateName": "gateway-t4g-large"
      },
      "Overrides": [
        {"InstanceType": "t4g.large"},
        {"InstanceType": "t4g.xlarge"}
      ]
    }
  }' \
  --min-size 3 --max-size 10
```

---

### 2. Ledger Worker (Bet Processing)

**Instance**: `t4g.medium` (ARM Graviton, 2 vCPU, 4GB RAM)  
**Count**: 5 instances  
**Pricing Strategy**: **Spot Instances**

```
On-Demand: 5 × $30 = $150/month
Spot (90% off): 5 × $3 = $15/month ✅
ARM Discount (20%): 5 × $9 = $45/month ✅
```

**Why Spot**: Kafka replay handles interruptions gracefully

---

### 3. Redis (Session & Cache)

**Service**: **AWS ElastiCache for Redis (Cluster Mode)**  
**Instance**: `cache.r6g.large` (ARM, 2 vCPU, 13.07GB RAM)  
**Count**: 3 nodes (1 primary + 2 replicas)

```
Pricing: 3 × $100 = $300/month
```

**Why Managed**:
- Automatic failover
- Automated backups
- Patch management
- Multi-AZ deployment

**Setup**:
```bash
aws elasticache create-replication-group \
  --replication-group-id betting-redis \
  --replication-group-description "Redis cluster for betting platform" \
  --engine redis \
  --cache-node-type cache.r6g.large \
  --num-cache-clusters 3 \
  --automatic-failover-enabled \
  --multi-az-enabled
```

**Environment Variables**:
```bash
REDIS_MODE=cluster
REDIS_CLUSTER_NODES=betting-redis.xxxxx.ng.0001.use1.cache.amazonaws.com:6379
```

---

### 4. Cassandra (Ledger Database)

**Service**: **AWS Keyspaces (Serverless Cassandra)**  
**Pricing**: Pay-per-request

```
Write Requests: 10,000/sec × 2.6M sec/month = 26B writes
Cost: 26B × $0.00065 = $169/month

Read Requests: 5,000/sec × 2.6M sec/month = 13B reads
Cost: 13B × $0.00013 = $169/month

Storage: 1TB × $0.25 = $250/month

Total: ~$400/month
```

**Why Keyspaces**:
- No server management
- Auto-scaling
- 50% cheaper than self-hosted
- Built-in backups

**Setup**:
```bash
# Create keyspace
aws keyspaces create-keyspace --keyspace-name aviator

# Create table (use existing schema.cql)
aws keyspaces create-table \
  --keyspace-name aviator \
  --table-name ledger_transactions \
  --schema-definition file://schema.json
```

**Migration from Self-Hosted**:
```javascript
// Update Cassandra client
const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
  contactPoints: ['cassandra.us-east-1.amazonaws.com'],
  localDataCenter: 'us-east-1',
  keyspace: 'aviator',
  authProvider: new cassandra.auth.PlainTextAuthProvider(
    process.env.KEYSPACES_USERNAME,
    process.env.KEYSPACES_PASSWORD
  ),
  sslOptions: {
    rejectUnauthorized: true,
    cert: fs.readFileSync('./AmazonRootCA1.pem')
  }
});
```

---

### 5. Kafka (Message Queue)

**Service**: **AWS MSK Provisioned**  
**Instance**: `kafka.t3.small` (2 vCPU, 2GB RAM)  
**Count**: 3 brokers

```
Pricing: 3 × $50 = $150/month
Storage: 3 × 100GB × $0.10 = $30/month
Total: $180/month
```

**Why MSK Provisioned** (not Serverless):
- Serverless is expensive ($1,800/month for 50 partitions)
- Provisioned t3.small is sufficient for 10k msg/sec

**Setup**:
```bash
aws kafka create-cluster \
  --cluster-name betting-kafka \
  --broker-node-group-info '{
    "InstanceType": "kafka.t3.small",
    "ClientSubnets": ["subnet-xxx", "subnet-yyy", "subnet-zzz"],
    "StorageInfo": {"EbsStorageInfo": {"VolumeSize": 100}}
  }' \
  --kafka-version "3.5.1" \
  --number-of-broker-nodes 3
```

---

## 🚀 Alternative Setups

### Budget Option: $500/month (50k users)

**Single Large Instance**: `c6i.4xlarge` (16 vCPU, 32GB RAM)

```
Instance: $500/month
All services via Docker Compose
```

**Pros**:
- Simplest setup
- No network latency
- Good for 20k-50k users

**Cons**:
- Single point of failure
- Limited scaling

**Setup**:
```bash
# Launch c6i.4xlarge
# Install Docker
# Clone repo
cd infra && docker-compose up -d

# Scale services
docker-compose up -d --scale gateway=3 --scale ledger-worker=5
```

---

### Hybrid Option: $810/month (80k users)

Mix managed and self-hosted:

```
Gateway + Workers: 5x t4g.medium (Spot) = $90/month
Redis: ElastiCache (t4g.medium x3) = $120/month
Cassandra: Self-hosted r6i.large x3 = $450/month
Kafka: MSK Serverless = $150/month

Total: $810/month
```

---

## 💡 Cost-Saving Strategies

### 1. Spot Instances (90% savings)

**Use for**:
- Gateway (stateless)
- Ledger Workers (Kafka replay)
- Callback service

**Don't use for**:
- Databases (Cassandra, Redis, Kafka)

**Implementation**:
```bash
# Launch Template
aws ec2 create-launch-template \
  --launch-template-name gateway-spot \
  --launch-template-data '{
    "InstanceType": "t4g.large",
    "ImageId": "ami-xxxxx",
    "InstanceMarketOptions": {
      "MarketType": "spot",
      "SpotOptions": {
        "MaxPrice": "0.05",
        "SpotInstanceType": "one-time"
      }
    }
  }'
```

---

### 2. ARM Instances (20% savings)

**Switch to Graviton**:
- `t3.large` → `t4g.large` (20% cheaper)
- `r6i.large` → `r6g.large` (20% cheaper)
- `m6i.large` → `m6g.large` (20% cheaper)

**Node.js Compatibility**: ✅ Works perfectly

---

### 3. Reserved Instances (40% savings)

**Commit to 1-year** for stable workloads:

```
r6i.large:
- On-Demand: $150/month
- 1-Year Reserved: $90/month (40% off)

Savings: $720/year per instance
```

**Recommended for**:
- Cassandra (if self-hosted)
- Redis (if self-hosted)
- Kafka (if self-hosted)

---

### 4. Auto-Scaling

**Scale down during off-peak**:

```
Peak (8am-12am): 10 gateway instances
Off-Peak (12am-8am): 3 gateway instances

Savings: 7 instances × 8 hours × $0.08 = $17/day = $510/month
```

**Setup**:
```bash
# Target Tracking Scaling Policy
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name gateway-asg \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 70.0
  }'
```

---

## 📊 Cost Breakdown by User Count

| Users | Setup | Monthly Cost |
|-------|-------|--------------|
| 10k | Single t3.xlarge | $120 |
| 20k | Single c6i.2xlarge | $250 |
| 50k | Single c6i.4xlarge | $500 |
| 80k | Hybrid (Spot + Managed) | $810 |
| 100k | **Optimized (Spot + Managed)** | **$959** |
| 150k | Scale up instances | $1,500 |

---

## 🛠️ Implementation Steps

### Step 1: Set Up VPC

```bash
aws ec2 create-vpc --cidr-block 10.0.0.0/16
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.3.0/24 --availability-zone us-east-1c
```

### Step 2: Launch ElastiCache (Redis)

```bash
aws elasticache create-replication-group \
  --replication-group-id betting-redis \
  --cache-node-type cache.r6g.large \
  --num-cache-clusters 3 \
  --automatic-failover-enabled
```

### Step 3: Create Keyspaces (Cassandra)

```bash
aws keyspaces create-keyspace --keyspace-name aviator
# Import schema from ledger-worker/db/schema.cql
```

### Step 4: Launch MSK (Kafka)

```bash
aws kafka create-cluster \
  --cluster-name betting-kafka \
  --broker-node-group-info InstanceType=kafka.t3.small \
  --number-of-broker-nodes 3
```

### Step 5: Launch EC2 Spot Fleet (Gateway + Workers)

```bash
# Use Auto Scaling Groups with Spot Fleet
# See detailed setup in sections above
```

### Step 6: Configure Environment Variables

```bash
# Gateway
REDIS_MODE=cluster
REDIS_CLUSTER_NODES=betting-redis.xxxxx.amazonaws.com:6379
KAFKA_BROKERS=b-1.betting-kafka.xxxxx.kafka.us-east-1.amazonaws.com:9092
CASSANDRA_HOSTS=cassandra.us-east-1.amazonaws.com

# Ledger Worker
(same as above)
```

---

## 📈 Monitoring & Alerts

**CloudWatch Alarms**:
- Spot instance interruption warnings
- ElastiCache CPU > 70%
- MSK consumer lag > 1000
- Keyspaces throttling events

**Cost Alerts**:
```bash
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "Monthly-Betting-Platform",
    "BudgetLimit": {"Amount": "1000", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }'
```

---

## 🎯 Summary

**Recommended for 100k users**: **$959/month**

- **Application**: Spot instances (t4g.large/medium) = $84/month
- **Redis**: ElastiCache (r6g.large x3) = $300/month
- **Cassandra**: Keyspaces (serverless) = $400/month
- **Kafka**: MSK Provisioned (t3.small x3) = $150/month
- **Load Balancer**: ALB = $25/month

**Savings**: 70% compared to full AWS setup

**Next Steps**: See [aws-eks-guide.md](./aws-eks-guide.md) for Kubernetes deployment
