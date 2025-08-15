# tyler 프로젝트 Dockerfile (Node.js WAS)
# 최종 업데이트: $(date)

FROM node:22-alpine

WORKDIR /apps/web

# 의존성 설치
COPY apps/web/package*.json ./
RUN npm ci

# 소스 코드 복사 및 빌드
COPY apps/web/ ./
RUN npm run build

# 포트 80 노출
EXPOSE 80

# 서버 시작
CMD ["npm", "start"] 