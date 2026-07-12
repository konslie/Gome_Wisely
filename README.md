# Gome Wisely

와이즐리 상품을 부부가 함께 기록하는 모바일 우선 공동 장바구니입니다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Supabase SQL Editor에서 `supabase/schema.sql`을 실행하고 파일 하단의 초기화 쿼리로 실제 숫자 4자리 PIN을 등록해야 합니다. 초기화 후 SQL Editor의 해당 쿼리 기록을 삭제하세요. PIN 원문과 service role key는 Git에 커밋하지 마세요.

## 명령어

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```
