# Kết Nối Xây Dựng — ERD and Drizzle migration package v1.1

## Tên miền vận hành

Tên miền chính thức là `https://ketnoixaydung.vn`. Sau khi trỏ DNS và kích hoạt HTTPS, dùng [cấu hình mẫu](config/production.env.example) để đặt `SITE_URL` cho canonical, sitemap và robots, cùng `BETTER_AUTH_URL` cho đăng nhập và liên kết xác minh. Nếu dùng `www`, chuyển hướng về tên miền chính tại máy chủ.

Giữ URL localhost ở môi trường phát triển và kiểm thử. Nếu đổi địa chỉ gửi email sang tên miền mới, xác minh tên miền trong Resend trước khi cập nhật người gửi trong quản trị.

## Contents
- `docs/ERD.md`: ERD, relationships and integrity rules.
- `docs/MIGRATION-REVIEW.md`: change log and validation status.
- `db/schema/index.ts`: Drizzle schema including payout accounts and idempotency fields.
- `db/migrations/0000_initial.sql`: initial PostgreSQL schema.
- `db/migrations/0001_hardening.sql`: additive hardening migration.
- `db/migrations/meta/_journal.json`: migration journal.
- `tests/smoke.sql`: PostgreSQL smoke test for ledger balancing and immutability.
- `scripts/verify-migration.sh`: applies migrations and smoke test on a disposable DB.

## Important
1. Use a new, separate database. Do not apply to Chợ Miền Quê production.
2. `0000_initial.sql` is retained as baseline; `0001_hardening.sql` adds changes.
3. SQL execution has **not** been run in this environment because PostgreSQL is unavailable. Run the smoke test before acceptance. Schema parity was reviewed statically; a full Drizzle Kit check/generate run remains required. TypeScript checking also requires installing the project's pinned `drizzle-orm` dependencies.
4. Keep custom triggers in reviewed SQL migrations. Inspect generated SQL before applying future migrations.
5. Encrypt payout account numbers at application level; keep encryption keys outside source control.
6. Top-up rate, fee, hold period and seller withdrawal conversion require approved legal/commercial policy before live payments.
7. Do not use `drizzle-kit push` as a production migration strategy.

## Suggested commands
```bash
export DATABASE_URL_TEST='postgresql://...'
./scripts/verify-migration.sh
npx drizzle-kit check
npx drizzle-kit generate
```
The Drizzle Kit commands depend on pinned package versions and a complete migration snapshot. Review generated SQL; do not blindly apply to production.
