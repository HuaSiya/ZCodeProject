import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
const passcode = process.env.ADMIN_PASSCODE ?? "dev-admin-123";
const outputDir = path.resolve(".screenshots");
fs.mkdirSync(outputDir, { recursive: true });

const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const executablePath = browserCandidates.find((candidate) =>
  fs.existsSync(candidate),
);

if (!executablePath) {
  throw new Error("No Chrome or Edge executable found.");
}

const browser = await chromium.launch({ executablePath, headless: true });
const problems = [];

function watch(page, label) {
  page.on("pageerror", (error) => {
    problems.push(`[${label}] pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`[${label}] console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(
        `[${label}] HTTP ${response.status()} ${response.url()}`,
      );
    }
  });
}

async function shot(page, name, options = {}) {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(outputDir, name),
    fullPage: true,
    ...options,
  });
  console.log(`✓ 截图 ${name}`);
}

try {
  const adminContext = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const page = await adminContext.newPage();
  watch(page, "admin");

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "公开投票" }).waitFor();
  await shot(page, "01-home-empty.png");

  await page.goto(`${baseUrl}/create`, { waitUntil: "networkidle" });
  await page.getByText("管理员登录").waitFor();
  await shot(page, "02-admin-login.png");

  await page.fill("#admin-passcode", passcode);
  await page.getByRole("button", { name: "进入管理后台" }).click();
  await page.getByRole("heading", { name: "发起投票" }).waitFor();
  await page.getByLabel("投票标题").waitFor();

  await page.getByRole("button", { name: "创建并获取链接" }).click();
  await page.getByText("请填写投票标题").waitFor();
  console.log("✓ 空表单校验生效");

  await page.fill("#poll-title", "周五团建去哪里？");
  await page.fill(
    "#poll-description",
    "这周五下班后聚餐，选出你想去的地方。每人最多选两个，按票数决定。",
  );
  await page.getByLabel("选项 1", { exact: true }).fill("火锅");
  await page.getByLabel("选项 2", { exact: true }).fill("烧烤");
  await page.getByRole("button", { name: "添加选项" }).click();
  await page.getByLabel("选项 3", { exact: true }).fill("日料");
  await page.fill("#poll-max-choices", "2");
  await page.getByRole("switch", { name: "公开到首页" }).click();
  await shot(page, "03-create-form.png");

  await page.getByRole("button", { name: "创建并获取链接" }).click();
  await page.waitForURL(/\/p\/[a-z0-9]+/);
  await page.getByText("投票已创建").waitFor();
  await shot(page, "04-poll-created.png");

  const pollUrl = page.url().replace(/\?.*$/, "");
  const pollId = new URL(pollUrl).pathname.split("/").pop();

  await page.getByRole("button", { name: "二维码" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByText("扫码投票").waitFor();
  await page.locator('[role="dialog"] svg').nth(1).waitFor();
  await shot(page, "05-qr-modal.png");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭" })
    .click();

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("周五团建去哪里？").waitFor();
  await shot(page, "06-home-with-poll.png");

  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByText("我的投票").waitFor();
  await page.getByText("周五团建去哪里？").waitFor();
  await shot(page, "07-admin-dashboard.png");

  const pollCard = page
    .locator("div.rounded-2xl")
    .filter({ hasText: "周五团建去哪里？" })
    .first();
  await pollCard.getByRole("button", { name: "截止" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByText("提前截止这场投票？").waitFor();
  await shot(page, "08-admin-confirm.png");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消" })
    .click();

  const voterContext = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const voterPage = await voterContext.newPage();
  watch(voterPage, "voter");

  await voterPage.goto(pollUrl, { waitUntil: "networkidle" });
  await voterPage.getByText("最多选择 2 项").waitFor();
  if ((await voterPage.getByText("投票结果").count()) !== 0) {
    throw new Error("Results should be hidden before voting.");
  }
  await shot(voterPage, "09-poll-vote.png");

  await voterPage.getByText("火锅", { exact: true }).click();
  await voterPage.getByText("烧烤", { exact: true }).click();
  await voterPage.getByText("已选 2/2").waitFor();
  await voterPage.getByRole("button", { name: "提交投票" }).click();
  await voterPage.getByText("投票结果").waitFor();
  const participants = await voterPage
    .locator("text=人参与")
    .first()
    .textContent();
  if (!participants?.includes("1")) {
    throw new Error(`Unexpected participant count: ${participants}`);
  }
  await shot(voterPage, "10-poll-results.png");

  await page.goto(`${baseUrl}/admin/polls/${pollId}/edit`, {
    waitUntil: "networkidle",
  });
  await page.getByText("编辑投票").waitFor();
  await page.getByText(/已有 1 人参与/).waitFor();
  await shot(page, "11-edit-locked.png");

  await page.goto(`${baseUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByText("我的投票").waitFor();
  const resultsCard = page
    .locator("div.rounded-2xl")
    .filter({ hasText: "周五团建去哪里？" })
    .first();
  await resultsCard.getByRole("button", { name: "结果" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByText("投票结果").waitFor();
  await page.getByText(/共 1 人参与/).waitFor();
  await shot(page, "12-admin-results.png");
  await page.keyboard.press("Escape");

  const secondVoterContext = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const secondVoterPage = await secondVoterContext.newPage();
  watch(secondVoterPage, "voter-2");
  await secondVoterPage.goto(pollUrl, { waitUntil: "networkidle" });
  await secondVoterPage.getByText("最多选择 2 项").waitFor();
  if ((await secondVoterPage.getByText("投票结果").count()) !== 0) {
    throw new Error("A fresh voter should not see results yet.");
  }
  console.log("✓ 新的访问者仍然看不到结果");

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  watch(mobilePage, "mobile");
  await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });
  await mobilePage.getByText("周五团建去哪里？").waitFor();
  await shot(mobilePage, "13-mobile-home.png");
  await mobilePage.goto(pollUrl, { waitUntil: "networkidle" });
  await mobilePage.getByText("最多选择 2 项").waitFor();
  await shot(mobilePage, "14-mobile-poll.png");
  await mobilePage.goto(`${baseUrl}/admin`, {
    waitUntil: "networkidle",
  });
  await mobilePage.getByText("管理员登录").waitFor();
  await mobilePage.fill("#admin-passcode", passcode);
  await mobilePage
    .getByRole("button", { name: "进入管理后台" })
    .click();
  await mobilePage.getByText("我的投票").waitFor();
  await mobilePage.getByText("周五团建去哪里？").waitFor();
  await shot(mobilePage, "15-mobile-admin.png");

  await secondVoterContext.close();
  await voterContext.close();
  await mobileContext.close();
  await adminContext.close();
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error("\n发现页面问题：");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exitCode = 1;
} else {
  console.log("\n界面检查完成，没有控制台错误或失败请求。");
}
