#!/bin/bash
echo "=== BullMQ 큐 상태 ==="
kubectl exec -n fans deployment/scheduler -- node -e "
const Redis = require('ioredis');
const redis = new Redis({host: process.env.REDIS_HOST, port: 6379});
Promise.all([
  redis.llen('bull:ai-summary:wait'),
  redis.llen('bull:ai-summary:active'),
  redis.llen('bull:ai-summary:completed')
]).then(([wait, active, completed]) => {
  console.log('대기:', wait, '처리중:', active, '완료:', completed);
  redis.quit();
});"

echo -e "\n=== 노드 현황 ==="
kubectl get nodes | grep -E "NAME|worker"

echo -e "\n=== Pod 상태 ==="
kubectl get pods -n fans | grep ai-worker
