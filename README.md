# OurTeam

응원 구단 경기 정보와 직관 승률을 확인 할 수 있는 웹 + 안드로이드 앱입니다.  

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

## GitHub Pages

주소: https://saintpark90.github.io/OurTeam/

`main`에 푸시하면 Actions가 빌드 후 Pages에 배포합니다.

Kakao 로그인을 쓰려면 Actions secrets에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣고, Supabase Redirect URL에 `https://saintpark90.github.io/OurTeam/**` 를 추가하세요. 키가 없어도 로컬 체험 모드로 확인할 수 있습니다.

## Supabase

1. 새 프로젝트 생성
2. [supabase/schema.sql](supabase/schema.sql) 실행
3. Authentication > Kakao 활성화
4. Redirect URLs:
   - `http://localhost:5173/**`
   - GitHub Pages `https://saintpark90.github.io/OurTeam/**`
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
