# GitHub Actions Workflows

## Docker Build and Push Workflow

### 개요
`docker-push.yml` 워크플로우는 main 브랜치에 푸시가 발생할 때마다 자동으로 Docker 이미지를 빌드하고 GitHub Container Registry (ghcr.io)에 푸시합니다.

### 트리거 조건
- **main 브랜치 푸시**: 이미지 빌드 및 푸시
- **main 브랜치 PR**: 이미지 빌드만 (푸시 안함)

### 이미지 태그 규칙
- `latest`: main 브랜치에서만 생성
- `main`: main 브랜치 태그
- `main-{sha}`: 커밋 SHA 기반 태그
- `pr-{number}`: PR 번호 기반 태그

### 사용법

#### 1. 로컬에서 이미지 사용
```bash
# GitHub Container Registry에서 이미지 가져오기
docker pull ghcr.io/emfoa23/tyler:latest

# 컨테이너 실행
docker run -d --name tyler-app -p 3000:80 ghcr.io/emfoa23/tyler:latest
```

#### 2. 다른 환경에서 사용
```bash
# Docker Compose에서 사용
version: '3.8'
services:
  tyler-app:
    image: ghcr.io/emfoa23/tyler:latest
    ports:
      - "3000:80"
    restart: unless-stopped
```

#### 3. Kubernetes에서 사용
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tyler-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tyler-app
  template:
    metadata:
      labels:
        app: tyler-app
    spec:
      containers:
      - name: tyler-app
        image: ghcr.io/emfoa23/tyler:latest
        ports:
        - containerPort: 80
```

### 권한 설정
워크플로우가 정상 작동하려면 다음 권한이 필요합니다:

1. **Repository Settings** → **Actions** → **General**
   - "Allow GitHub Actions to create and approve pull requests" 활성화

2. **Repository Settings** → **Packages**
   - "Inherit access from source repository" 활성화

### 문제 해결

#### 이미지 푸시 실패
```bash
# 로그 확인
docker logs tyler-app

# 이미지 상태 확인
docker images | grep tyler
```

#### 권한 오류
- Repository Settings에서 Packages 권한 확인
- GitHub Token이 올바르게 설정되었는지 확인

#### 빌드 실패
- Dockerfile 문법 오류 확인
- package.json 의존성 문제 확인
- GitHub Actions 로그에서 상세 오류 확인

### 참고 사항
- 이미지는 `ghcr.io/emfoa23/tyler` 저장소에 푸시됩니다
- PR에서는 빌드만 수행하고 푸시는 하지 않습니다
- 캐시를 활용하여 빌드 속도를 최적화합니다
- 자동으로 메타데이터와 라벨이 추가됩니다 