# MEMORY

## 현재 상태

- Next.js, Supabase PostgreSQL, Vercel 기반 P0 구현 시작
- 공용 숫자 4자리 PIN, 로그인 잠금, 서명 쿠키 세션 구현
- 장바구니 등록·조회·수량 변경·배송 이동·소프트 삭제 구현
- 단위 테스트 8개, ESLint, Next.js 프로덕션 빌드 통과
- 실제 Supabase 연결, 인증 설정 초기화, 빈 장바구니 테이블 접근 확인
- 로컬 화면 200, 세션 확인 200, 미인증 장바구니 API 401 확인
- Optimistic UI로 등록·수정·삭제 후 전체 목록 재조회 제거
- 세션 버전 30초 캐시와 URL 메타데이터 제한시간 900ms 적용
- 플랫 SaaS 스타일, 버튼 상태, 삭제 실행 취소 토스트 적용

## 결정

- Supabase Auth 대신 단일 가구용 자체 PIN 인증을 사용한다.
- PIN 원문은 저장하지 않고 bcrypt 해시만 DB에 저장한다.
- 브라우저는 Supabase에 직접 접근하지 않으며 서버 API만 service role을 사용한다.

## 다음 단계

- 실제 PIN으로 로그인·상품 CRUD 브라우저 검증
- Vercel 환경변수 설정 및 배포 검증
- URL 상품명 추출, 중복 감지, 삭제 실행 취소 추가
