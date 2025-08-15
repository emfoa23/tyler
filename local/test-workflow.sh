#!/bin/bash

# GitHub Actions Workflow 로컬 테스트 스크립트
# Colima + act를 사용하여 로컬에서 workflow 실행

set -e

echo "🚀 GitHub Actions Workflow 로컬 테스트 시작"
echo "=========================================="

# 1. Colima 상태 확인
echo ""
echo "📋 1. Colima 상태 확인 중..."
if ! colima status > /dev/null 2>&1; then
    echo "❌ Colima가 실행되지 않았습니다. 시작 중..."
    colima start
else
    echo "✅ Colima가 실행 중입니다."
fi

# 2. Docker 소켓 경로 설정
echo ""
echo "📋 2. Docker 소켓 경로 설정 중..."
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
echo "✅ DOCKER_HOST 설정 완료: $DOCKER_HOST"

# 3. act 설치 확인
echo ""
echo "📋 3. act 도구 확인 중..."
if ! command -v act &> /dev/null; then
    echo "❌ act가 설치되지 않았습니다."
    echo "설치 명령어: brew install act"
    exit 1
else
    echo "✅ act가 설치되어 있습니다: $(which act)"
fi

# 4. 사용 가능한 workflow 확인 및 선택
echo ""
echo "📋 4. 사용 가능한 workflow 확인 중..."

# act --list 출력을 파싱하여 워크플로우 파일 목록 생성
workflow_files=()

# 워크플로우 파일명 추출
while IFS= read -r workflow_file; do
    if [[ -n "$workflow_file" ]]; then
        workflow_files+=("$workflow_file")
    fi
done < <(act --list --container-architecture linux/amd64 | tail -n +2 | grep -o '[a-zA-Z0-9._-]*\.yml')

# 워크플로우 목록 표시
echo ""
echo "📋 5. 실행할 workflow를 선택하세요:"
for i in "${!workflow_files[@]}"; do
    echo "$((i+1)). ${workflow_files[$i]}"
done

echo ""
read -p "선택하세요 (1-${#workflow_files[@]}): " workflow_choice

# 선택 유효성 검사
echo ""
if ! [[ "$workflow_choice" =~ ^[0-9]+$ ]] || [ "$workflow_choice" -lt 1 ] || [ "$workflow_choice" -gt "${#workflow_files[@]}" ]; then
    echo "❌ 잘못된 선택입니다. 1-${#workflow_files[@]} 사이의 숫자를 입력하세요."
    exit 1
fi

# 선택된 워크플로우 인덱스 (0-based)
selected_index=$((workflow_choice - 1))
selected_file="${workflow_files[$selected_index]}"

echo "✅ 선택된 워크플로우: $selected_file"

# 워크플로우 실행
echo ""
echo "🚀 워크플로우 실행 중..."

# act 실행
act workflow_dispatch -W ".github/workflows/$selected_file" \
    --container-architecture linux/amd64 \
    --secret-file "local/.secrets" \
    --secret AWS_SSH_KEY="$(cat ~/.ssh/brian_aws.pem)"

echo ""
echo "=========================================="
echo "✅ Workflow 테스트 완료!"