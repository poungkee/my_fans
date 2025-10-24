# eksctl 아카이브

이 디렉토리는 이전에 사용했던 eksctl 설정 파일들을 보관합니다.

## 파일 설명

- `eks-cluster.yaml` - EKS 클러스터 기본 구성
- `eks-cluster-secure.yaml` - 보안 강화 클러스터 구성
- `nodegroup-large.yaml` - Large 노드 그룹 구성
- `nodegroup-medium-private.yaml` - Medium Private 노드 그룹 구성
- `create-private-nodes.sh` - Private 노드 생성 스크립트

## 현재 상태

이 파일들은 **참고용**으로만 보관됩니다.

현재 프로덕션 클러스터는:
- ✅ 이미 eksctl로 생성되어 운영 중
- ✅ CloudFormation 스택으로 관리됨
- ❌ Terraform은 아직 적용되지 않음

## 향후 계획

Terraform으로 전환이 필요할 때:
1. 기존 클러스터 완전 삭제
2. `/infra/terraform-eks/`의 구성으로 새로 생성
3. 이 파일들은 참고자료로 활용
