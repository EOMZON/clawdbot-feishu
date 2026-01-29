import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import * as Lark from "@larksuiteoapi/node-sdk";

type EnvMap = Record<string, string>;

function parseDotEnv(contents: string): EnvMap {
  const env: EnvMap = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (!key) continue;

    // Unquote simple quoted values.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      // Strip trailing inline comment: "VALUE # comment"
      const commentIdx = value.indexOf(" #");
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();
    }

    env[key] = value;
  }
  return env;
}

function loadDotEnv(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function pickEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function resolveDomain(domainRaw: string | undefined): Lark.Domain {
  return domainRaw?.toLowerCase() === "lark" ? Lark.Domain.Lark : Lark.Domain.Feishu;
}

loadDotEnv(path.resolve(process.cwd(), ".env"));

const appId = pickEnv(["FEISHU_ID", "FEISHU_APP_ID", "LARK_APP_ID"]);
const appSecret = pickEnv(["FEISHU_KEY", "FEISHU_APP_SECRET", "LARK_APP_SECRET"]);
const domainRaw = pickEnv(["FEISHU_DOMAIN", "LARK_DOMAIN"]) ?? "feishu";

if (!appId || !appSecret) {
  console.error(
    [
      "Missing Feishu credentials.",
      'Set env vars (or add them to ".env") then re-run:',
      "- FEISHU_ID=cli_xxx",
      "- FEISHU_KEY=app_secret",
      "- (optional) FEISHU_DOMAIN=feishu|lark",
    ].join("\n"),
  );
  process.exit(1);
}

const domain = resolveDomain(domainRaw);

const wsClient = new Lark.WSClient({
  appId,
  appSecret,
  domain,
  loggerLevel: Lark.LoggerLevel.info,
});

const eventDispatcher = new Lark.EventDispatcher({}).register({
  "im.message.receive_v1": async (data) => {
    const message = (data as { message?: { chat_id?: string; content?: string } })?.message;
    const chatId = message?.chat_id ?? "unknown";
    let text: string | undefined;
    try {
      if (message?.content) text = (JSON.parse(message.content) as { text?: string }).text;
    } catch {
      text = undefined;
    }
    console.log(`[im.message.receive_v1] chat_id=${chatId}${text ? ` text=${text}` : ""}`);
  },
});

try {
  wsClient.start({ eventDispatcher });
  console.log("feishu-ws-online: WebSocket client started");
  console.log(`feishu-ws-online: domain=${domainRaw.toLowerCase() === "lark" ? "lark" : "feishu"} appId=${appId}`);
  console.log("feishu-ws-online: Keep this process running while you save “事件订阅 → 长连接/WebSocket” in Feishu console.");
} catch (err) {
  console.error(`feishu-ws-online: failed to start WS client: ${String(err)}`);
  process.exit(1);
}

const stop = (signal: string) => {
  console.log(`feishu-ws-online: received ${signal}, exiting...`);
  process.exit(0);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

