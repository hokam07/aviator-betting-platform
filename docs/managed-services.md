# Transitioning to AWS Managed Services

To simplify operations and improve durability, you should replace the infrastructure containers with AWS Managed Services.

## 1. Redis -> AWS ElastiCache
- **Why**: High availability, automatic backups, and no maintenance.
- **Change**: In `.env` or Kubernetes ConfigMaps, update `REDIS_URL` to point to the ElastiCache Primary Endpoint.
- **Security**: Ensure your EC2/EKS security group can access the ElastiCache port (6379).

## 2. Kafka -> AWS MSK (Managed Streaming for Kafka)
- **Why**: Managing Kafka is difficult; MSK handles the brokers and Zookeeper for you.
- **Change**: Update `KAFKA_BROKERS` to the MSK Bootstrap Brokers list.

## 3. Cassandra -> AWS Keyspaces
- **Why**: Cassandra is the heaviest part of our stack. AWS Keyspaces provides a serverless, CQL-compatible API.
- **Change**: Update `CASSANDRA_HOSTS` to the Keyspaces endpoint. Note: Keyspaces requires IAM-based authentication or service-specific credentials.

## 4. PostgreSQL (if used) -> AWS RDS
- Any relational data should move to RDS (Postgres/Aurora) for snapshots and vertical scaling.
