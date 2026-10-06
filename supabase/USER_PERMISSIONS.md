# 用户与权限部署

## 数据库先于新功能启用

当前项目的旧版 profiles 表只有 id、email、role。新功能依赖 status 等字段及三个受保护的 RPC。

1. 在 Supabase 中备份 schema、RLS 策略与现有 profiles、links 数据。
2. 先在隔离测试项目执行 `supabase/migrations/202610070001_user_permissions.sql`。
3. 检查匿名、普通用户 A、普通用户 B、管理员四身份的权限。
4. 审核实际部署中已有 RLS 策略，再在目标项目 SQL Editor 执行迁移，最后部署代码。

迁移可重复执行，补齐缺失 profile，保留既有用户角色；新用户由 Auth 触发器自动创建普通用户 profile。新增权限修改 RPC 通过事务锁保护最后一个有效管理员，并记录审计。登录活跃时间通过受保护的 RPC 更新。

**迁移前兼容：** 仅当数据库明确返回缺少 status 字段时，原有登录和管理员功能使用旧角色逻辑。普通网络错误、权限错误或实际 disabled 状态不会降级放行。新用户管理页面会显示数据库升级提示。迁移后 status 为 active 的账号可继续使用，disabled 会被应用登录、middleware、Actions/API 与 RLS 拒绝。

## 首期规则

- 普通用户只管理本人链接；管理员可以查看、删除全局链接。
- 管理员可调整角色、禁用/启用账号，必须填写原因。
- 禁用不删除用户或已有链接，不改变公开短链解析政策。
- 不能禁用自己，不能禁用或降权最后一个有效管理员。
- 管理员可永久删除账号，同时删除该账号的短链接、profile 和 Auth 身份。必须输入匹配的邮箱（无邮箱时为用户 ID）及原因；不能删除自己或最后一个有效管理员。
- 删除操作通过 `202610070002_delete_user.sql` 中的受保护事务 RPC 执行，与角色修改共享并发锁。删除审计保留；删除失败则整个事务回滚。
- 不提供管理员改登录密码或修改他人链接密码。
- profiles 的认证端直接写入权限撤销；权限修改仅走受控 RPC。
- 管理员删除链接通过数据库触发器审计，不记录目标 URL 或密码 hash。
- status 是应用状态，不调用 Supabase Auth banUser；直接 Auth 登录可能仍产生 token，但 token 无法管理应用数据。若要求认证服务自身拒绝登录，需要单独设计 Auth 管理接口。

## 删除账号增量升级

已执行第一份权限迁移的项目，只需在 SQL Editor 执行 `supabase/migrations/202610070002_delete_user.sql` 的完整 SQL 内容，不是文件路径。新项目先执行 001，再执行 002。两份脚本均可重复执行。

账号删除会触发 Supabase Auth 的关联清理。若实际 schema 中有其他业务表或 Storage 对用户的阻止删除外键，删除事务会失败并保留账号及链接，不应绕过这些约束；先确认额外资源的清理规则。

## 核验

`pnpm test:permissions` 使用本地 PGlite PostgreSQL 引擎，不连接线上数据库。覆盖迁移重跑、触发器、RLS、匿名/普通用户越权、禁用旧 session、最后管理员、审计和乐观并发检查。PGlite 单连接测试不等同于真实 PostgreSQL 多连接并发测试，上线前应在隔离 Supabase 项目再验证。

`tests/user-permissions.browser.mjs` 运行隔离临时 Next 项目和模拟 Supabase，不提供公共测试路由、不使用真实账号。需安装 Playwright，可通过 PLAYWRIGHT_PATH 指定其模块路径，EDGE_PATH 指定浏览器可执行文件。截图输出到 `reports/user-permissions-screenshots/`。

迁移不会修正现有 settings 公开读取、匿名短链跳转/创建的旧策略。公开解析应使用最小数据的受控服务端路径；不要为了跳转给 links 全表开放匿名读取。
