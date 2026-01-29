# 飞书应用从 0 跑通 SOP（clawdbot-feishu / moltbot）

目标：**新建一个飞书自建应用**，用最小权限完成「本地长连接(WebSocket)收消息 → 机器人能回消息」的闭环。

> 关键理解：你在飞书控制台里选择“长连接/WebSocket”时，**必须先把本地网关跑起来并保持在线**，否则飞书控制台可能会提示“需要长连接在线才能保存”。

## 0. 你需要准备什么

- 飞书账号（有创建“自建应用”的权限；部分权限/数据范围可能需要企业管理员审批）
- 一个应用名（建议：`molt` / `clawdbot` + 环境后缀，比如 `molt-dev`）
- 本地运行环境（至少能启动你的 bot 网关/服务；下面会给验证方式）

参考：
- 飞书开发者后台：`https://open.feishu.cn/app`
- 飞书“长连接”官方文档：`https://open.feishu.cn/document/ukTMukTMukTM/uETO1YjLxkTN24SM5UjN`

## 1. 创建应用（自建应用）

1. 打开飞书开发者后台 `https://open.feishu.cn/app` 并登录
2. 创建 **自建应用**
3. 填写应用名称、描述、图标（之后在飞书里搜索机器人时用得到）
4. 在“机器人/Robot”能力页，确认 **机器人能力已开启**

## 2. 获取 App ID / App Secret（凭证）

1. 进入该应用详情页
2. 找到“凭证/credentials/应用凭证”页面
3. 记录：
   - `App ID`（通常长得像 `cli_xxx`）
   - `App Secret`

> 不要把 `App Secret` 提交到 git。建议仅放在本机 `.env` / 本机配置里。

## 3. 最小权限配置（先跑通再加）

在“权限管理”中，先只勾选 README 里列的 **Required Permissions**：

- `contact:user.base:readonly`
- `im:message`
- `im:message.p2p_msg:readonly`
- `im:message.group_at_msg:readonly`
- `im:message:send_as_bot`
- `im:resource`

### 常见卡点：数据权限范围（Data Access Scope）

如果某些权限旁边出现类似“**数据权限范围请申请必要的数据权限配置更新**”：

1. 点进该权限行对应的“数据权限范围/范围配置”
2. 先选一个能跑通的最小范围（例如“仅本人/测试成员”这类最小粒度）
3. 需要审批时：先走审批，或临时换成不需要审批的最小权限组合先跑通闭环

## 4. 事件订阅：长连接(WebSocket) + 必要事件

1. 进入“事件订阅/事件与回调”
2. 找到“配置”（一般会有编辑按钮）
3. 选择 **长连接 / WebSocket** 并保存
   
> 提醒：长连接/WebSocket 模式下 **不需要填写“请求地址/回调 URL”**。如果页面要求你填写 URL，说明你选的是 Webhook 模式。
4. 在事件列表里订阅（至少）：
   - `im.message.receive_v1`（必需：收消息）
   - `im.chat.member.bot.added_v1`（建议：机器人被拉入群/会话）
   - `im.chat.member.bot.deleted_v1`（建议：机器人被移除）
   - `im.message.message_read_v1`（可选：读消息回执/已读）
5. 保存

> 如果这里“保存”失败，提示必须长连接在线：先完成 **第 5 节**（本地网关在线），然后再回到这里保存。

## 5. 本地先把“长连接在线”跑起来（让控制台能保存）

你需要启动你的 bot 主进程（或网关），让它连接飞书，并在日志里看到 **WebSocket client started** 类似字样。

为了更方便在“事件订阅”里保存 **长连接/WebSocket**（控制台会校验“长连接在线”），本仓库提供了一个最小脚本用于把长连接挂起来：

前提：在仓库根目录 `.env` 放好：

- `FEISHU_ID=cli_xxx`
- `FEISHU_KEY=app_secret`
- （可选）`FEISHU_DOMAIN=feishu|lark`

启动长连接（保持进程不要退出）：

```bash
pnpm tsx scripts/feishu-ws-online.ts
# 或
npx tsx scripts/feishu-ws-online.ts
```

判断成功：终端出现 `feishu-ws-online: WebSocket client started`。

> 不同项目启动方式不同，但“**让长连接在线**”是硬要求：控制台保存 WebSocket 配置时会校验这一点。

## 6. 版本/可用范围/发布（否则你在飞书里搜不到机器人）

很多“搜不到机器人/无法私聊”的根因是：**应用没有发布/没有安装/不在可用范围**。

按飞书控制台常见路径：

1. 进入“版本管理与发布”
2. 创建一个版本（例如 `0.0.1`），填写更新说明
3. 滚动到页面底部，找到“**可用范围**”
   - 点击“编辑”
   - 把你自己加入可用范围（至少要包含你自己）
   - 在弹窗里点“确定”
4. 保存版本
5. 走“发布/提交审核/发布到企业”（不同企业策略不同）
6. 发布后到“测试/安装/在飞书打开”相关入口，把应用安装到你的飞书账号

## 7. 把凭证配置到本地（clawdbot 配置）

本插件侧需要：

- `channels.feishu.appId` = 你的 `App ID`
- `channels.feishu.appSecret` = 你的 `App Secret`

README 里提供了示例命令与 YAML。你也可以把 `App ID/Secret` 放到本仓库根目录 `.env`（`FEISHU_ID` / `FEISHU_KEY`），再由你的启动脚本/配置读取。

## 8. 自动化（可选）：Playwright 一键勾权限/事件 + 保存登录态

本仓库暂未内置“飞书控制台自动化”脚本（权限/事件订阅/发布流程会随 UI 与企业策略变化）。建议先手动跑通一次；如确需自动化，可在你的主项目里维护 Playwright 录制/脚本化流程。

## 9. 最终验收（跑通定义）

当你完成上述步骤后，应该能做到：

- 飞书客户端里能搜索到应用/机器人（在可用范围内并已安装）
- 私聊机器人发送一句话
- 本地日志能看到收到事件（`im.message.receive_v1`）并成功回消息

如果卡住：

- 事件收不到：优先检查 **事件订阅** 是否已保存 + 是否订阅了 `im.message.receive_v1`
- 保存不了长连接：优先检查 **本地网关是否在线**
- 搜不到机器人：优先检查 **版本是否发布** + **可用范围是否包含你** + **是否已安装**
