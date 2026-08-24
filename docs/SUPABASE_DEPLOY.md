# Supabase 프로덕션 DB 배포 (GitHub Actions)

회사 PC에서는 더 이상 `npx supabase db push`를 직접 실행하지 않아도 됩니다.
Supabase production migration 배포는 GitHub Actions가 대신 실행합니다.

## 사용 순서

1. GitHub 접속
2. 이 저장소(repository) 열기
3. 상단 탭에서 **Actions** 클릭
4. 왼쪽 목록에서 **Deploy Supabase Database Migrations** 클릭
5. 오른쪽의 **Run workflow** 버튼 클릭
6. `confirm` 입력칸에 정확히 **PRODUCTION** 입력 (대문자, 앞뒤 공백 없이)
7. **Run workflow** 클릭

이게 전부입니다. 자동으로 실행되는 경우는 없습니다 — 누군가 위 순서대로
직접 버튼을 눌러야만 배포가 시작됩니다.

## 성공하면

`supabase/migrations/`에 있는 파일 중 아직 프로덕션 DB에 적용되지 않은
migration만 적용됩니다. 워크플로 실행 화면의 **Summary**에 프로젝트 ref,
커밋 SHA, dry-run/배포 성공 여부가 표시됩니다.

## 실패하면

워크플로 실행 로그를 열어 어느 단계에서 실패했는지 확인하세요. 흔한 원인:

- **secret 누락**: `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` /
  `SUPABASE_PROJECT_ID` 중 하나가 비어 있음 — 저장소 Settings → Secrets
  and variables → Actions에서 확인
- **confirm 오타**: `PRODUCTION`이 아닌 다른 값을 입력함
- **dry-run 실패**: migration SQL 자체에 문제가 있음 — 실제 DB에는
  아무것도 적용되지 않은 상태이므로, migration 파일을 수정한 뒤 커밋하고
  다시 실행하면 됩니다

**절대 하지 마세요**: 실패했다고 해서 `supabase migration repair`,
`supabase db reset`, `supabase db pull` 같은 명령을 로컬이나 다른 곳에서
임의로 실행하지 마세요. 이 명령들은 프로덕션 migration 이력이나 데이터를
되돌릴 수 없게 바꿀 수 있습니다. 원인을 알 수 없으면 로그를 그대로 들고
문의하세요.

## 참고

- 이 워크플로는 **수동 실행만** 가능합니다(`workflow_dispatch`) — push나
  PR을 올린다고 자동으로 실행되지 않습니다.
- 동시에 두 배포가 겹쳐 실행되지 않도록 막혀 있습니다(하나가 끝나야 다음
  실행이 시작됩니다).
- 이 워크플로는 기존에 커밋된 `supabase/migrations/` 파일만 그대로
  적용합니다 — 워크플로 자체가 마이그레이션 내용을 만들거나 바꾸지
  않습니다.
