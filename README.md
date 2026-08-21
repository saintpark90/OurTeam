# OurTeam

응원 구단 경기 정보와 직관 모임(그룹)을 한 서비스로 묶은 웹 + 안드로이드 앱입니다.  
구단 공식 엠블럼·선수 사진·실시간 타사 중계 크롤링은 사용하지 않습니다.

## 스택

- React (Vite) + Capacitor Android
- Supabase (Auth: Kakao, Postgres)
- Python 배치: KST 04:00 (`cron: 0 19 * * *` UTC) 하루 1회

## 로컬 웹

```bash
npm install
cp .env.example .env.local
npm run dev
```

Supabase 키가 없어도 **로컬 체험 모드**로 UI를 확인할 수 있습니다.

## Supabase

1. 새 프로젝트 생성
2. [supabase/schema.sql](supabase/schema.sql) 실행
3. Authentication > Kakao 활성화
4. Redirect URLs:
   - `http://localhost:5173/**`
   - 배포 도메인 `https://<your-domain>/**`
   - 앱: `app.ourteam.mobile://auth/callback`

## 배치 적재

```bash
cd scripts
pip install -r requirements.txt
set SUPABASE_URL=...
set SUPABASE_SERVICE_ROLE_KEY=...
set TARGET_SEASON=2026
python ingest_kbo.py
```

GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 안드로이드

```bash
npm run build
npx cap sync android
npx cap open android
```

Kakao Developers에 앱 키와 `app.ourteam.mobile://auth/callback` 를 등록하세요.

## 저작권 원칙

- 구단: 컬러 + 약칭 뱃지만 사용
- 선수: 이름·등번호·포지션·성적 텍스트만
- 데이터: 자체 DB 2차 지표(직관 승률, 내가 본 경기 타율 등)
- 명칭: KBO 공식 서비스가 아님
