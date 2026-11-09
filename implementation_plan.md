# Implementation plan — Đóng Phase 8 và chuẩn bị Phase 9

**Ngày:** 12/10/2026. **Trạng thái:** người dùng đã yêu cầu triển khai Phase 9 theo kế hoạch này và chọn backup “local trước”. Phát triển local được phép trong khi production gates Phase 8 còn mở. OAuth step-up chưa nghiệm thu nên không mở hành động nguy hiểm cho tài khoản OAuth-only. Contract triển khai: docs/33-PHASE-9-CONTRACT.md.

**Bổ sung local backup trước khi sửa source:** triển khai archive stream AES-256-GCM, key/config files riêng ngoài repo/archive, giới hạn thời gian/dung lượng, durable job queue + audit transaction + lease/heartbeat, UI trạng thái/lịch sử/enqueue; thử dump và restore thật vào DB test riêng. Không thêm package, đọc secrets thật, dump database thật, restore API, download API, tự xóa retention hoặc khóa toàn Mongo. Backup database riêng là logical_non_snapshot; không tự full-replica dump vì mở rộng dữ liệu ngoài phạm vi, không giả point-in-time consistency. Native Mongo tools/Windows ACL/RPO-RTO/storage ngoài máy/snapshot vẫn cần cấu hình và nghiệm thu thực tế. Chi tiết contract docs/33.

**Bổ sung13/10 — người dùng chọn toàn bộ backend+Mongo+Redis Docker local:** thêm Compose riêng, image backend multi-stage có Mongo tools, Mongo8 replica set có authentication/app account riêng, Redis7 authentication, volume dữ liệu/archive/secrets tách biệt. Init tạo khóa/password local ngẫu nhiên một lần, không overwrite key/đọc .env thật; backend chạy non-root, secret subgroup read-only và filesystem hạn chế. API chỉ publish loopback; DB/cache không publish host ports. Kiểm thử HTTP/login, worker backup và restore stream thật trên stack mới, ownership/persistence/secret modes và timeout; cập nhật runbook. Không cấp Docker daemon/socket cho app, không docker exec runner trong HTTP worker, không dùng volume/container đang có, không seed/promote admin trên database thật, không mở snapshot/retention/deploy production. Chi tiết trước khi code tại docs/36-DOCKER-LOCAL.md.

Kết quả sau triển khai 8R: 453 backend + 167 frontend + 21 integration = 641 tests PASS, build hai phía PASS, lint 0 errors/77 warnings; Chrome tái hiện kết quả đúng sau sửa. Chi tiết docs/31-PHASE-8-FIX-VERIFICATION-2026-10-11.md và giải thích từng file docs/32-PHASE-8-FIX-WALKTHROUGH-2026-10-11.md. Các mục audit baseline bên dưới là bằng chứng trước bản sửa, không phải số liệu nghiệm thu mới.

## 1. Quyết định sau audit

Audit đầu lượt phát hiện hai bug trên build production; hai bug đã sửa và kiểm chứng cục bộ sau khi người dùng duyệt 8R. Phase 8 vẫn chưa đạt DoD production vì còn các gate hạ tầng/SEO. Ngày12/10 người dùng yêu cầu làm Phase9, cho phép triển khai local theo kế hoạch; các phần backup/runtime và Google step-up chưa đủ thông tin vẫn giữ gate riêng.

Báo cáo audit trước sửa: [docs/30-PHASE-8-REVIEW-2026-10-11.md](docs/30-PHASE-8-REVIEW-2026-10-11.md). Baseline: 453 backend + 143 frontend = 596 unit/regression PASS; build hai phía PASS; lint 0 errors/79 warnings; 21 integration tests skipped. Browser đã tái hiện F8-01/F8-02 dù baseline tests PASS. Bằng chứng sau sửa ở docs/31.

Giữ phạm vi đọc miễn phí theo docs/17,18,28; Phase 11–12 đã hủy. Quảng cáo hiện chỉ có khung UI theo docs/29. Không đưa thanh toán/Xu/VIP/nhuận bút, tracking hoặc ad provider vào Phase 9.

## 2. Nguyên tắc triển khai và phê duyệt

- 8R đã xong; Phase9 được người dùng yêu cầu triển khai12/10. Tiếp tục scope đã duyệt, tách nghiệm thu source local khỏi nghiệm thu hạ tầng thật.
- Tái sử dụng React/Express/React Query/Zustand/Zod/Mongo/Redis hiện hữu; Route → Controller → Service → Repository → Model. Không thêm package mặc định.
- Endpoint/schema/index phía dưới là bản kế hoạch trước triển khai. Contract thực tế tại docs/33, được cập nhật trước source và các tối ưu phát sinh có ghi bằng chứng đo tải. Không thêm biến môi trường backup khi runtime chưa được chốt.
- Source hoàn tất cục bộ và release production có trạng thái riêng. Chưa có staging; các gate cần HTTPS thật sẽ ghi NOT_RUN cho đến khi có bằng chứng.
- Không sửa `.env` thật, secrets, database/index production hoặc deploy trong phạm vi coding. Migration/deployment có runbook, backup, rollback và duyệt thao tác thực tế riêng.

## 3. Phần 8R — những việc sẽ làm

### 8R.1 Sửa metadata chỉ theo tài nguyên hiện tại

**Vấn đề:** PublicRoute quét toàn QueryCache cùng story slug; error của chương cũ làm trang truyện hợp lệ mất title/canonical và bị noindex.

**Cách làm:**

1. Xác định query của story đang mở; với reader thêm chapterSlug và scope user hiện tại sau auth hydration. Không lấy error của chương khác hoặc phiên đã rời.
2. Kết hợp visibility parent/story/chapter tương ứng; status pending/hidden hoặc mature hiện tại vẫn chuyển metadata sang policy an toàn.
3. Giữ snapshot SSR ổn định và subscription React có snapshot nhất quán. Subscribe event liên quan thay vì quét mọi query trên mọi event; không tạo side effect trong render/getSnapshot.
4. Khôi phục metadata từ loader hiện tại khi query active phục hồi; xóa metadata private khi logout/đổi tài nguyên theo policy hiện có.

**File dự kiến:** `client/src/lib/seo/PublicRoute.tsx`, helper/test trong `client/src/lib/seo/`; nếu cần đồng bộ query key thì sửa giới hạn `useChapterDetail` và tests liên quan. Không đổi API hay schema cho lỗi này.

**Tiêu chí:** chương A lỗi → story hợp lệ/B hợp lệ vẫn đúng title/canonical/robots; phiên cũ không ảnh hưởng phiên mới. Tài nguyên đang lỗi/hidden/mature vẫn noindex và UI theo quyền. SSR/hydration không sai khác, không tăng số request đọc.

### 8R.2 Xác nhận 18+ hoạt động khi storage bị chặn

**Vấn đề:** route boundary bắt lỗi storage nhưng reader/story detail chưa bắt; xác nhận tuổi xong vẫn crash hoặc có thể yêu cầu xác nhận lặp.

**Cách làm:**

1. Dùng trạng thái xác nhận theo story ID trong bộ nhớ phiên ứng dụng; không persist dữ liệu server vào Zustand.
2. Đọc/ghi sessionStorage best-effort thông qua helper chung; bắt cả lỗi lấy object storage, getItem và setItem. Chỉ ghi trạng thái sau thao tác xác nhận rõ ràng.
3. Đồng bộ PublicRoute, StoryDetailPage và ChapterReaderPage; reload khi storage không khả dụng yêu cầu xác nhận lại, điều hướng cùng story trong phiên không crash/lặp dialog vô lý.
4. Tài nguyên đổi sang story khác phải xác nhận riêng. SSR không biết trạng thái browser và không đưa body mature vào raw HTML/state. Không cho error storage tự trở thành consent.

**File dự kiến:** helper/store UI xác nhận mới trong `client/src/lib/` hoặc feature stories; `PublicRoute.tsx`, `StoryDetailPage.tsx`, `ChapterReaderPage.tsx`; tests helper/component và browser harness.

**Tiêu chí:** storage bị chặn hoặc chỉ write bị chặn vẫn đọc được sau xác nhận; chưa xác nhận giữ gate; story ID khác không kế thừa; không hydration/pageerror, không quảng cáo trên mature, không thêm request reader trùng.

### 8R.3 Kiểm thử và nghiệm thu lại

- Unit tests bổ sung cho các hành vi trên: seed lỗi chapter khác/phiên khác, active lỗi → phục hồi, parent hidden/mature, snapshot SSR; storage getters/get/set ném lỗi, story-ID isolation, consent chỉ đến từ thao tác người dùng.
- Browser production bundle: normal/mature, guest/persisted user, navigation/reload/back, storage denied/read-only; kiểm tra metadata, dialog/body, số request đọc và quảng cáo đủ điều kiện.
- Rerun unit toàn server/client, TypeScript/build, frontend lint. Không lấy số lượng tests làm mục tiêu; assertion phải kiểm tra lỗi người dùng thực gặp.
- Integration biệt lập: Mongo replica set + Redis, suite opt-in; visibility/sitemap generation cũ/mới, Redis outage, budget/lease/fence; giữ guard DB test và dọn chỉ container/DB của lượt kiểm thử.
- Đo quota/memory/freshness trên tải đại diện có limiter thật; p50/p95/p99/error rate tách 200/429/503, cold/warm riêng. Không tăng budget/quota hoặc bỏ limiter chỉ để phép đo PASS.
- Gate HTTPS/SSR/OAuth/cookie/proxy/realtime/Lighthouse/social theo docs/22,24,26,30. Viết hướng dẫn chạy khi có staging; chưa có môi trường thì giữ gate mở.

**DoD source 8R:** hai lỗi đã sửa, regression PASS và smoke không mất visibility/consent/SSR. **DoD Phase 8:** thêm đủ gate SEO trong docs/07 và gate release áp dụng; không tuyên bố đạt khi còn NOT_RUN.

## 4. Điều kiện đầu vào Phase 9

1. 8R source PASS; Phase 8 DoD/gates áp dụng đã đóng, hoặc người dùng duyệt rõ phát triển local Phase 9 trong lúc gate hạ tầng còn mở.
2. Chốt DTO/schema/API/metric/backup/step-up đề xuất dưới đây. Không biến toàn bộ mockup docs/16 thành chức năng có dữ liệu giả.
3. Có Mongo replica set cho transaction, Redis thật biệt lập cho session/quota/step-up; tài khoản admin test và fixtures nhiều vai trò.
4. Chốt môi trường backup, retention và RPO/RTO trước triển khai worker backup. Chưa chốt thì phần backup chưa đạt DoD, không hiển thị “backup thành công” mẫu.

## 5. Phase 9 — thứ tự và contract đề xuất

| Chặng | Công việc | Đầu ra/điều kiện hoàn thành |
|---|---|---|
| 9.0 | Đồng bộ docs, metric definitions, DTO, trạng thái tài khoản, quyền, schema/index và threat cases | Contract được duyệt; những tính năng UI chưa đủ dữ liệu được ghi rõ |
| 9.1 | Nền `/admin`, layout/guard/noindex, users/authors/moderators read-only, dashboard overview/charts | API admin-only; bảng cursor và số liệu đối chiếu DB thật |
| 9.2 | Duyệt/thu hồi author, ban/unban/suspend, role changes, append-only audit + step-up | State transition/transaction/concurrency/revocation PASS |
| 9.3 | Danh sách truyện quản trị, config có version, Dangerous Action dialogs | Dùng lại moderation, không tạo visibility policy thứ hai |
| 9.4 | Backup status/history, worker theo môi trường đã chốt, runbook restore cô lập | Có backup thật được bảo vệ và thử restore; chưa thao tác production |
| 9.5 | Hardening, integration/browser, load/index explain, accessibility và runbook | DoD source + hồ sơ release tách rõ; chưa release nếu gates còn mở |

### 5.1 API đang có trong tài liệu và phần cần bổ sung

Base `/api/v1`; mọi `/admin/*` dùng authenticate → requireRole(admin) → quota phù hợp → validate → controller. No-store/noindex; không dùng role từ request body để xác định actor.

| API | Tình trạng | Contract dự kiến khi được duyệt |
|---|---|---|
| `GET /admin/dashboard/overview` | docs/04 đã mô tả, chưa source | KPI định nghĩa bên dưới; `asOf`, độ tươi và trạng thái dependency đã đo |
| `GET /admin/dashboard/charts` | docs/04 đã mô tả, chưa source | Allowlist metric, `from/to`, timezone cố định, max 90 ngày; series thiếu dữ liệu trả null/gap |
| `GET /admin/users` | docs/04 đã mô tả, chưa source | `role,status,q,cursor,limit`; default20/max100; DTO allowlist, cursor ổn định theo createdAt + _id |
| `PATCH /admin/users/:id/suspend`, `/ban`, `/unban` | docs/04 đã mô tả, thiếu body/state details | strict reason 10–500 ký tự; suspend thời hạn 1–30 ngày; `expectedVersion`, action receipt; không mass assign |
| `PATCH /admin/users/:id/role` | docs/04 đã mô tả `{role}` | Đề xuất thêm reason/version/step-up; chống tự hạ/khóa và mất admin cuối |
| `GET /admin/config`, `PUT /admin/config` | docs/04 đã mô tả, chưa schema | Allowlist + optimistic version; không nhận secret, HTML/script tùy ý hoặc origin/proxy/JWT settings |
| `GET /admin/audit-logs` | docs/04 đã mô tả, chưa model tương ứng | Cursor có filters actor/action/target/date; projection redacted, không có update/delete API |
| `GET /admin/users/:id` | **Bổ sung đề xuất** | Profile quản trị giới hạn, trạng thái/quyền/version; không hash/token/session payload |
| `PATCH /admin/users/:id/author-status` | **Bổ sung đề xuất** | `{status:approved|revoked,reason,expectedVersion,actionReceipt}`; dùng pending hiện có, không đổi role ngoài quy tắc đã chốt |
| `GET /admin/stories` | **Bổ sung đề xuất** | Bảng private admin gồm moderation/status; bộ lọc cursor bounded; actions gọi moderation hiện hữu |
| `POST /admin/action-confirmations` | **Bổ sung đề xuất** | Step-up/action receipt theo mục 6; không coi typed text là authentication |
| `GET /admin/backups`, `POST /admin/backups` | **Bổ sung đề xuất, cần chốt storage/runtime** | List metadata và enqueue job; trả 202 cho accepted, không báo success trước khi backup hoàn tất |

Tác giả/moderator lists dùng `GET /admin/users?role=...` và authorStatus filter được bổ sung vào contract, không tạo nhiều API liệt kê trùng nhau. Top truyện chỉ dùng bộ đếm có thật; contract overview có bounded top5 projection, không có revenue.

Không có API restore/reset/hard delete trong mặc định Phase 9. Mục backup/restore của roadmap được đáp ứng bằng sao lưu thật và runbook phục hồi có kiểm chứng; nếu yêu cầu restore qua UI phải duyệt contract/runtime riêng trước khi code chức năng phá hủy dữ liệu.

### 5.2 Dashboard: số liệu thật, giới hạn truy vấn rõ ràng

Đề xuất 7 KPI: tổng user; author approved không bị khóa/đình chỉ; story approved; chapter published+approved thuộc story approved; story pending; chapter pending; report pending/in_progress. Mỗi KPI có tên/filter rõ ràng, không gọi tài khoản đã đăng ký là người online. Cảnh báo 18+ không làm nội dung biến thành private; số liệu “public” phải nói rõ có bao gồm mature.

- Growth user dùng createdAt; content growth dùng ngày tạo và filter được đặt tên rõ. Không dùng updatedAt thay ngày xuất bản hoặc gán ngày tạo thành ngày duyệt.
- Views hiện là counter best-effort từ reader, không phải unique readers và không có lịch sử views/ngày. Không cộng cả story.viewCount và chapter.viewCount vì một lượt đọc tăng cả hai.
- Đề xuất **AdminMetricSnapshot** ghi mẫu theo giờ UTC: tổng chapter.viewCount của phạm vi đã định nghĩa, `sampledAt`, `scopeVersion`. Chart ghi rõ “bộ đếm ghi nhận tại thời điểm lấy mẫu”; số này có thể giảm khi dữ liệu bị gỡ/xóa. Không diễn giải hiệu số thành số lượt đọc chính xác/ngày. Chỉ có series kể từ khi sampling bắt đầu; không backfill dữ liệu giả.
- Nếu người dùng cần đồ thị **số lượt đọc thực từng ngày** như yêu cầu rộng trong mockup, cần thiết kế thu thập sự kiện/rollup và policy đếm riêng. Đây là quyết định bổ sung, không giả vờ đã có dữ liệu hoặc thêm write nóng âm thầm.
- Bounded aggregate/select/maxTimeMS; index đề xuất dựa trên explain với fixtures đủ lớn. Không truy vấn N+1 user/story mỗi dòng. Một endpoint dashboard có số query cố định theo nhóm, tránh gọi count riêng từ mỗi card frontend.
- Cache overview private tối đa 15s nếu cần và có `asOf`; UI sau mutation invalidate đúng keys. Những quyết định khóa/quyền/admin cuối luôn đọc DB hiện tại, không dùng dashboard/cache.
- Health chỉ hiển thị dependency thực đã kiểm tra và timestamp; không lộ connection string, key, host nội bộ hay stack. Không bịa CPU/RAM/uptime nếu môi trường chưa hỗ trợ telemetry.

### 5.3 Schema/index đề xuất cần duyệt

| Thay đổi | Lý do/phạm vi |
|---|---|
| `User`: `suspendedUntil?`, `lockKind?:ban|suspend`, version quản trị | isLocked hiện tại không mô tả khóa có hạn. Không overwrite `authorStatus` hoặc dựa vào cron để quyết định tài khoản hết hạn |
| `AuditLog` collection riêng | Model hiện có là ModerationLog, target enum không có config/backup. Audit admin cần actor role tại thời điểm hành động, action/target, before/after allowlist, reason, requestId, timestamp |
| `SiteConfig` singleton + version | Cấu hình cho phép phải typed/validated, cập nhật có conflict detection; không cất secrets vào config UI |
| `AdminControl` singleton revision | Các transaction thay đổi quyền/khóa admin cùng ghi guard document để serialize invariant admin cuối; count-before-write đơn thuần chưa chống write skew |
| `AdminMetricSnapshot` | Lưu sample thật từ thời điểm triển khai; unique `(scopeVersion,sampledAtBucket)` để worker idempotent; retention đề xuất 180 ngày |
| `BackupJob` metadata, khi môi trường backup được chốt | Trạng thái queued/running/succeeded/failed, actor/requestId, storage key riêng, checksum/size/time; không lưu file backup trong Mongo |

AuditLog ghi append-only theo API/repository; không tuyên bố bất biến với DB superuser. Khi cần chống sửa từ ngoài ứng dụng phải có storage/DB role/WORM policy vận hành riêng. Không sửa/xóa logs cũ để đồng nhất tên actor sau khi đổi role.

Index khởi điểm cần đo: user `(role,createdAt,_id)`, trạng thái truy vấn phổ biến sau khi chốt semantics; audit `(createdAt,_id)` và tối đa các composite theo filter có số đo; config/control singleton unique key; metrics unique time bucket; backup `(createdAt,_id)` và guard job active. Không thêm index cho mọi combination, không gọi syncIndexes production tự động. Audit retention chưa chốt với người dùng nên không đặt TTL tự xóa lịch sử mặc định.

`q` giới hạn 100 ký tự, escape regex; chỉ tìm trường allowlist. Nếu contains scan quá lớn, đề xuất prefix/search index sau đo và duyệt contract; không tải toàn users rồi filter trong Node/browser.

## 6. Phase 9 — mutation an toàn và UI

### 6.1 Quyền, trạng thái, transaction

- Tái dùng JWT purpose access và Passport đọc user từ DB hiện tại; token có role cũ không giữ quyền admin sau khi bị hạ. Refresh không tự mở tài khoản bị khóa.
- Suspend dùng thời gian server; đăng nhập/refresh/authenticated API và Socket kiểm tra trạng thái hiệu lực. Cron có thể dọn field nhưng không là điều kiện mở khóa đúng giờ. Kiểm tra tương thích dữ liệu isLocked cũ, không tự unban record thiếu thời hạn.
- Không cho tự ban/suspend/hạ quyền; mọi giảm quyền/khóa admin phải cùng serialize qua AdminControl trong transaction, đảm bảo luôn còn admin hoạt động đủ quyền. Hai admin đồng thời hạ nhau phải có ít nhất một thao tác bị từ chối/conflict.
- Auth check trong middleware chưa đủ nếu actor bị hạ giữa request; service kiểm tra actor hiện tại và guard transaction trước commit mutation đặc quyền. Không tin actorRole gửi từ client.
- Mutation + audit cùng Mongo session; audit fail → rollback mutation. Side effect Socket/notification diễn ra sau commit, có retry/ghi nhận lỗi theo capability hiện có.
- Ban/hạ quyền thu hồi hoặc chặn refresh thích hợp, đóng/kiểm tra Socket private rooms. Mongo và Redis không có transaction chung: DB permission state là authority, receipt/revocation cleanup retry được ghi nhận; lỗi Redis không cho bypass quota/step-up. Không hứa truy hồi dữ liệu đã tới browser.
- `expectedVersion` stale trả 409; duplicate action có receipt/idempotency semantics rõ. Không blind retry mutation gây nhiều log hoặc khóa lại sau khi đã unban.

### 6.2 Dangerous Action System

Info cho xem trạng thái; Caution cho thay đổi cấu hình hiển thị/mở khóa; Warning cho suspend/thu hồi author; Danger cho ban/thay đổi role; Critical dành cho restore/reset/hard delete nếu sau này được duyệt. Severity do server/action policy quyết định, không nhận từ client.

- Dialog nêu target, tác động và reason; form disable lúc pending nhưng backend vẫn phải chống race/duplicate.
- Action receipt ngắn hạn đề xuất 5 phút, gắn actor/session/action/target/payload fingerprint, dùng một lần nguyên tử qua Redis. Receipt là quyền thực hiện đúng hành động sau step-up; không đưa receipt vào URL/log/storage bền.
- Với Danger cần xác minh lại identity: local user xác minh password bằng bcrypt có quota; Google cần flow reauthentication gắn đúng tài khoản và verified state. Access token vừa refresh hoặc text “CONFIRM” không đủ chứng minh fresh identity.
- Thiếu step-up provider đã nghiệm thu thì vô hiệu hóa action tương ứng với thông báo rõ; không fallback OAuth-only sang password rỗng. Trước code chốt request/response và callback riêng trong docs/04,09.
- Focus trap/keyboard/escape/return-focus/accessibility; typed confirmation chỉ là giảm thao tác nhầm, không thay quyền backend.

### 6.3 Frontend và config

- `features/admin` gồm api/hooks/types/pages/components; AdminLayout reuse dashboard primitives/theme tokens. Route guard chờ auth hydration; mọi trang admin noindex, xóa metadata story trước đó.
- Users/author/moderator tables tải cursor, stable sort, bounded page; skeleton/error/empty/permission-denied rõ; không cache dữ liệu quản trị cho phiên khác. Khi logout/role change clear admin query namespace.
- Bảng không tự thêm virtualization/library chart trước khi có số đo. Cursor20–100 đủ cho bảng bounded; chart SVG đơn giản kèm bảng số liệu accessible nếu phù hợp. Package mới chỉ đề xuất khi thực sự cần và được duyệt cụ thể.
- Story management tái dùng moderation API/service đang có; không tạo luồng approve/hide thứ hai thiếu audit/visibility.
- Config bản đầu: tên/mô tả hiển thị và announcement text thuần, có maxlength/version/preview. Cấu hình SEO canonical/indexing, maintenance/auth/content limits trong đặc tả rộng cần allowlist riêng và regression trước khi bật; mặc định không editable từ UI Phase 9 cho đến khi contract được duyệt.
- Không cho nhập SMTP password/JWT/Redis credentials hoặc HTML email/script quảng cáo vào config. Không tăng giới hạn input vượt sanitize/budget đang dùng.

## 7. Backup/restore và vận hành

1. Chốt storage riêng có access control/encryption, retention mặc định đề xuất 7 daily + 4 weekly, quota dung lượng; chọn runtime có tool backup được hỗ trợ. Không chọn nhà cung cấp hoặc cài CLI/package ngầm.
2. API enqueue job có quota và singleton lease, queue bền theo DB metadata; timeout/cancellation/shutdown hữu hạn. `accepted` không phải `succeeded`.
3. Backup nhất quán theo deployment Mongo replica set, ghi checksum/manifest/version; credentials chỉ từ secret runtime. Không serve file qua thư mục public/CDN hoặc log connection string.
4. Download nếu cần phải contract riêng với quyền admin/step-up và signed URL TTL ngắn; mặc định UI chỉ status/history, không xuất mọi user bằng CSV/JSON không kiểm soát.
5. Restore thử vào **DB tách biệt**, xác minh counts/invariants/visibility/session invalidation và đo RPO/RTO. Runbook production có maintenance, snapshot trước restore, rollback và thao tác duyệt riêng; không chạy restore production trong coding/test.
6. Nếu storage/runtime chưa chốt, ghi backup NOT_CONFIGURED/NOT_TESTED; không dùng mock success để đóng Phase 9. Backup thủ công có kiểm chứng có thể là gate vận hành sớm, không được gọi là worker tự động hoàn tất.

## 8. Unit/integration/browser tests Phase 9

| Nhóm | Assertion có ý nghĩa |
|---|---|
| Route/auth | Guest401, user/author/moderator403, locked/demoted admin bị từ chối dù access token còn hạn; wrong JWT purpose không vào admin |
| Validation/DTO | ObjectId/cursor/filter/time range/limit hợp lệ; reject operators/unknown fields; không lộ password/hash/token/provider secrets/base64 payload hàng loạt |
| User transitions | pending author→approved/revoked, ban/unban, suspend trước/sau hết hạn, stale version, tự thao tác bị cấm, invalid target/reason |
| Concurrent admin | Hai admin giảm quyền/khóa song song; guard giữ admin cuối; actor bị hạ trong lúc request chưa commit; Mongo integration chứng minh invariant |
| Audit | before/after allowlist đúng, actor snapshot đúng; log fail rollback; duplicate action không tạo side effect dư; không có update/delete path |
| Step-up | Quota/error Redis fail-closed, receipt expired/replayed/wrong actor/session/target/payload, OAuth state mismatch, không dùng refresh làm proof |
| Metrics | Fixtures có hidden/mature/draft/pending/deleted, timezone/day boundaries; KPI khớp truy vấn độc lập; chart chưa có sample là gap, không số0 giả; không double-count story/chapter |
| Config | expectedVersion conflict, reject secret/script/unsafe URL, public DTO giới hạn; mutation invalidate cache, outage không dùng config giả |
| Backup | Job lease/idempotency/timeout/failure; checksum/storage permission; metadata không chứa credentials; integration restore chỉ DB test có guard |
| Browser | Deep link/reload/logout/demotion, noindex/head cleanup; tables cursor/filter/error; dialogs keyboard/focus; responsive4themes; không request trùng hoặc quyền theo UI đơn thuần |
| Regression | Reader miễn phí, mature gate, ads eligibility, author/moderation, SSR/sitemap/cookie/auth/session hiện hữu giữ đúng policy |

Dùng Vitest có sẵn. Mock để kiểm tra policy/error branches; transaction/cursor/aggregation/Lua/quota thực kiểm tra với Mongo replica set/Redis thật biệt lập. Không mock trả đúng số mong muốn rồi coi dashboard khớp DB. Không viết snapshot-only tests, không lặp lại implementation trong assertions. Không đặt mục tiêu “100% coverage” hoặc test count thay cho nghiệp vụ/rủi ro được kiểm chứng.

Performance nghiệm thu trên fixture đại diện: users≥10.000, stories≥1.000, chapters≥50.000 và audit logs đủ lớn; giải thích số liệu không đại diện kho production nếu phân bố khác. So sánh query count/explain/latency/RAM trước–sau, có quota thật và dependency outage. Ngưỡng p95 đề xuất ban đầu: users list ≤300ms, dashboard≤500ms ở warm HTTP concurrency10 trong test environment được mô tả; đây là mục tiêu để đo và điều chỉnh bằng bằng chứng, chưa là SLA đã đạt.

## 9. File dự kiến Phase 9 và lý do

| File/nhóm dự kiến | Trách nhiệm |
|---|---|
| `server/src/modules/admin/{admin.routes,admin.validation,admin.controller,admin.service}.ts` | Boundaries auth/strict input/HTTP/policy rõ, unit-testable |
| `server/src/repositories/admin-*.repository.ts` | Bounded DB queries, projection/cursor/aggregate/transaction helpers |
| `server/src/models/{AuditLog,SiteConfig,AdminControl,AdminMetricSnapshot}.model.ts` | Schema/index/version/invariant đã duyệt; không sửa model private ngoài scope |
| `User.model.ts`, user repository, auth service/Passport/auth middleware/Socket auth | Suspend hiệu lực, thay đổi role/lock xuyên mọi đường phiên; giữ purpose tokens |
| `server/src/jobs/admin-metrics.job.ts` | Sample idempotent/deadline/shutdown, gap khi job không chạy |
| Backup job/repository/model/adapter khi được chốt | Sao lưu có trạng thái thật và storage riêng |
| `server/src/app.ts`, `server.ts` | Mount router/job, readiness/shutdown đúng dependency; không business logic |
| `client/src/features/admin/{api,hooks,types,pages,components}` | Dashboard, tables/config/audit/dialogs tách file nhỏ, query theo scope |
| `client/src/app/router.tsx`, query keys/role guard/policy | Lazy routes admin/private noindex và cache invalidation đúng |
| Tests cạnh feature + opt-in integration + browser scripts | Chứng minh policy và hành vi lỗi; giữ artifact theo ngày/build |
| `docs/01–05,07–09,16`, báo cáo kiểm chứng mới | Contract final, migration/runbook/rollback và trạng thái gate có bằng chứng |

Tên file cuối có thể tách nhỏ thêm theo quy tắc repo; không refactor module không liên quan chỉ để đổi naming.

## 10. Những việc không nên làm và lý do

| Không làm | Lý do |
|---|---|
| Tuyên bố release Phase 9 chỉ vì unit tests PASS | Phát triển local đã được duyệt nhưng DoD SEO/HTTPS/backup/OAuth còn mở; tests chưa thay thế nghiệm thu môi trường thật |
| Xóa toàn QueryCache hoặc bỏ noindex/visibility để sửa F8-01 | Mất dữ liệu đúng, tăng refetch; có thể lộ metadata private/mature |
| Coi lỗi storage là đã xác nhận18+ | Biến lỗi kỹ thuật thành consent giả; phải giữ xác nhận explicit trong memory |
| Dựng chart online/views/ngày/health bằng số giả | Source không có dữ liệu lịch sử tương ứng; làm sai quyết định vận hành |
| Dùng dialog/RequireRole frontend làm bảo mật | Có thể gọi API trực tiếp; backend phải kiểm quyền/trạng thái/step-up |
| Count admin trước update mà không serialize invariant | Hai transaction có thể đồng thời loại admin cuối; cần guard chung |
| Update user rồi ghi audit riêng | Crash/audit error để lại thay đổi không có dấu vết; cùng transaction |
| Bật generic CRUD config hoặc xuất toàn Mongo | Lộ secret/user data, bypass policy; DTO và field allowlist bắt buộc |
| Thêm bulk ban/delete, reset DB, restore production từ UI mặc định | Tác động rộng/không đảo ngược; thiếu contract, recovery và authorization thao tác cụ thể |
| Bỏ limiter, trust mọi X-Forwarded-For, tăng Redis budget tùy ý | Tạo đường bypass abuse và memory/quota vượt năng lực thật |
| Cache chung response có preview/private hoặc gỡ no-store toàn API | Nguy cơ lộ draft/metadata giữa các phiên; CDN cần purge/visibility design riêng |
| Chuyển framework/DB, thêm microservices/queue/chart package hàng loạt | Tăng complexity và dependency trước khi có bottleneck được đo |
| Nạp scripts quảng cáo/tracking hoặc mở lại thu phí | Ngoài chính sách miễn phí và phạm vi placeholders đã chốt |
| Migration/syncIndexes/drop dữ liệu thật khi test | Không được user duyệt thao tác cụ thể; có thể mất dữ liệu/index/độ sẵn sàng |
| Dùng benchmark fixture/historical tests chứng nhận release | Không đo mạng/HTTPS/cold host/DB/quota/memory hiện tại; cần evidence môi trường thật |
| Dọn toàn 79 lint warnings bằng refactor rộng trong 8R | Tăng regression ngoài scope; chỉ sửa warnings ở phần chạm và backlog hóa phần còn lại |

## 11. Nghiệm thu, bàn giao và rollback

- Mỗi chặng bàn giao diff, lý do từng nhóm file, kiểm tra thực chạy/skip, rủi ro và artifact mới. Không đánh dấu check đã PASS khi chỉ có mock hoặc chưa chạy.
- Phase 9 source DoD: dashboard khớp DB theo metric đã duyệt, API/admin mutations có quyền/transaction/audit, config bounded, backup thực đã kiểm chứng theo contract; browser/accessibility/regression và checks PASS.
- Các mục trong docs/16 như admin verify-email override, gửi email hàng loạt, reset password người khác, template editor và restore/reset UI **chưa được đưa vào mặc định**. Cần amend phạm vi docs/16 khi duyệt; nếu người dùng yêu cầu giữ nguyên toàn bộ đặc tả, phải mở contract/test riêng, không gọi bản giới hạn là đầy đủ spec.
- Production release DoD bổ sung gates A/8 và Phase10 áp dụng: HTTPS/auth/cookie/proxy, representative load, quota/freshness, backup recovery, monitoring/alerts và rollback artifact. Không triển khai trong kế hoạch coding này.
- Rollback 8R bằng artifact code trước; không thay DB. Phase9 schema additive có compat/migration plan, backup trước thao tác thật; rollback không xóa audit hoặc dữ liệu người dùng để trở về version cũ.

## 12. Phạm vi cần duyệt

**Người dùng đã duyệt 8R.1–8R.3 và ngày12/10 yêu cầu làm Phase9, chọn backup “local trước”.** Scope quản trị, metrics thật, config/audit, encrypted backup local/worker/isolated restore, unit/integration/browser đã triển khai local; backup paths/key/native tools/ACL thật chưa cấu hình và OAuth step-up chưa được nghiệm thu.

Không yêu cầu duyệt lại các phần đã được triển khai trong scope12/10. Người dùng xác nhận có storage riêng và sẽ gửi mô tả; worker backup/restore và hành động nguy hiểm cho OAuth-only chưa được bật. Không cần gửi secrets qua chat. Hồ sơ kiểm chứng tại docs/34, runbook/gates tại docs/35.
