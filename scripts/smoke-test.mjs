import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
const passcode = process.env.ADMIN_PASSCODE ?? "dev-admin-123";
const keepPolls = process.env.KEEP_POLLS === "1";

class Client {
  constructor() {
    this.cookies = new Map();
  }

  async request(path, options = {}) {
    const headers = {};
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (this.cookies.size > 0) {
      headers.Cookie = [...this.cookies.entries()]
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      redirect: "manual",
    });

    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!value || /max-age=0/i.test(setCookie)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: response.status, data };
  }
}

function log(message) {
  console.log(`✓ ${message}`);
}

function createPayload(overrides = {}) {
  return {
    title: `测试投票 ${Math.random().toString(36).slice(2, 8)}`,
    description: "这是一场由冒烟测试创建的投票。",
    options: ["选项 A", "选项 B", "选项 C"],
    maxChoices: 1,
    deadlineAt: null,
    isListed: true,
    ...overrides,
  };
}

const createdPollIds = [];
const admin = new Client();

try {
  const health = await new Client().request("/api/health");
  assert.equal(health.status, 200);
  log("健康检查");

  const anonymousSession = await admin.request("/api/admin/session");
  assert.equal(anonymousSession.data.authenticated, false);
  log("未登录会话状态正确");

  const wrongLogin = await admin.request("/api/admin/login", {
    method: "POST",
    body: { passcode: "definitely-wrong" },
  });
  assert.equal(wrongLogin.status, 401);
  log("错误口令被拒绝");

  const login = await admin.request("/api/admin/login", {
    method: "POST",
    body: { passcode },
  });
  assert.equal(login.status, 200);
  log("管理员登录成功");

  const unauthorized = await new Client().request("/api/admin/polls", {
    method: "POST",
    body: createPayload(),
  });
  assert.equal(unauthorized.status, 401);
  log("未登录不能创建投票");

  const badCreate = await admin.request("/api/admin/polls", {
    method: "POST",
    body: createPayload({ options: ["只有一个选项"] }),
  });
  assert.equal(badCreate.status, 400);
  log("非法选项数量被拒绝");

  const created = await admin.request("/api/admin/polls", {
    method: "POST",
    body: createPayload({
      options: ["火锅", "烧烤", "日料"],
      maxChoices: 2,
      deadlineAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
    }),
  });
  assert.equal(created.status, 201);
  const pollId = created.data.id;
  createdPollIds.push(pollId);
  log("创建公开多选投票");

  const adminDetail = await admin.request(`/api/admin/polls/${pollId}`);
  assert.equal(adminDetail.status, 200);
  assert.equal(adminDetail.data.totalVoters, 0);
  assert.equal(adminDetail.data.options.length, 3);
  const optionIds = adminDetail.data.options.map((option) => option.id);
  log("管理后台读取投票详情");

  const partialEdit = await admin.request(`/api/admin/polls/${pollId}`, {
    method: "PATCH",
    body: { description: "更新后的描述" },
  });
  assert.equal(partialEdit.status, 200);
  assert.equal(partialEdit.data.description, "更新后的描述");
  log("无人投票时可以修改投票内容");

  const publicList = await new Client().request("/api/polls");
  assert.ok(publicList.data.some((poll) => poll.id === pollId));
  log("公开投票出现在首页列表");

  const voterA = new Client();
  const beforeVote = await voterA.request(`/api/polls/${pollId}`);
  assert.equal(beforeVote.status, 200);
  assert.equal(beforeVote.data.results, null);
  assert.equal(beforeVote.data.hasVoted, false);
  log("投票前看不到结果");

  const voteA = await voterA.request(`/api/polls/${pollId}/vote`, {
    method: "POST",
    body: { optionIds: [optionIds[0], optionIds[1]] },
  });
  assert.equal(voteA.status, 200);
  assert.equal(voteA.data.results.totalVoters, 1);
  assert.equal(
    voteA.data.results.options.find(
      (option) => option.id === optionIds[0],
    ).count,
    1,
  );
  log("投票后立即看到结果");

  const repeatedVote = await voterA.request(`/api/polls/${pollId}/vote`, {
    method: "POST",
    body: { optionIds: [optionIds[0]] },
  });
  assert.equal(repeatedVote.status, 409);
  log("同一浏览器不能重复投票");

  const revisit = await voterA.request(`/api/polls/${pollId}`);
  assert.equal(revisit.data.hasVoted, true);
  assert.ok(revisit.data.results);
  log("已投票者再次访问直接看到结果");

  const voterB = new Client();
  const beforeVoteB = await voterB.request(`/api/polls/${pollId}`);
  assert.equal(beforeVoteB.data.results, null);

  const voteB = await voterB.request(`/api/polls/${pollId}/vote`, {
    method: "POST",
    body: { optionIds: [optionIds[0]] },
  });
  assert.equal(voteB.status, 200);
  assert.equal(voteB.data.results.totalVoters, 2);
  log("第二位参与者正常投票");

  const blockedEdit = await admin.request(`/api/admin/polls/${pollId}`, {
    method: "PATCH",
    body: { title: "有票后不应修改成功" },
  });
  assert.equal(blockedEdit.status, 409);
  log("已有投票后禁止修改投票内容");

  const tooMany = await new Client().request(
    `/api/polls/${pollId}/vote`,
    {
      method: "POST",
      body: { optionIds: optionIds.slice(0, 3) },
    },
  );
  assert.equal(tooMany.status, 400);
  log("超过最多可选数被拒绝");

  const closed = await admin.request(
    `/api/admin/polls/${pollId}/close`,
    { method: "POST" },
  );
  assert.equal(closed.status, 200);
  assert.equal(closed.data.isClosed, true);
  log("管理员提前截止投票");

  const voterC = new Client();
  const afterClose = await voterC.request(`/api/polls/${pollId}`);
  assert.ok(afterClose.data.results);
  assert.equal(afterClose.data.results.totalVoters, 2);
  log("截止后未投票者也能看到结果");

  const lateVote = await voterC.request(
    `/api/polls/${pollId}/vote`,
    { method: "POST", body: { optionIds: [optionIds[0]] } },
  );
  assert.equal(lateVote.status, 409);
  log("截止后无法继续投票");

  const unlisted = await admin.request("/api/admin/polls", {
    method: "POST",
    body: createPayload({ title: "未公开测试投票", isListed: false }),
  });
  assert.equal(unlisted.status, 201);
  const unlistedId = unlisted.data.id;
  createdPollIds.push(unlistedId);

  const publicListAfterUnlisted = await new Client().request("/api/polls");
  assert.ok(
    !publicListAfterUnlisted.data.some(
      (poll) => poll.id === unlistedId,
    ),
  );
  log("未公开投票不出现在首页列表");

  const duplicated = await admin.request(
    `/api/admin/polls/${pollId}/duplicate`,
    { method: "POST" },
  );
  assert.equal(duplicated.status, 201);
  createdPollIds.push(duplicated.data.id);

  const duplicateDetail = await admin.request(
    `/api/admin/polls/${duplicated.data.id}`,
  );
  assert.equal(duplicateDetail.data.isListed, false);
  assert.equal(duplicateDetail.data.totalVoters, 0);
  assert.ok(duplicateDetail.data.title.endsWith("（副本）"));
  log("复制投票：无投票记录、默认不公开");

  const deleted = await admin.request(
    `/api/admin/polls/${unlistedId}`,
    { method: "DELETE" },
  );
  assert.equal(deleted.status, 200);

  const gone = await admin.request(`/api/admin/polls/${unlistedId}`);
  assert.equal(gone.status, 404);
  createdPollIds.splice(createdPollIds.indexOf(unlistedId), 1);
  log("删除投票后无法再访问");

  const logout = await admin.request("/api/admin/logout", {
    method: "POST",
  });
  assert.equal(logout.status, 200);
  const sessionAfterLogout = await admin.request("/api/admin/session");
  assert.equal(sessionAfterLogout.data.authenticated, false);
  log("退出登录");
} finally {
  if (!keepPolls && createdPollIds.length > 0) {
    const cleanupAdmin = new Client();
    const login = await cleanupAdmin.request("/api/admin/login", {
      method: "POST",
      body: { passcode },
    });
    if (login.status === 200) {
      for (const pollId of createdPollIds) {
        await cleanupAdmin.request(`/api/admin/polls/${pollId}`, {
          method: "DELETE",
        });
      }
      console.log(`✓ 清理了 ${createdPollIds.length} 场测试投票`);
    }
  } else if (keepPolls) {
    console.log(
      `ℹ 保留了测试投票：${createdPollIds.join(", ") || "无"}`,
    );
  }
}

console.log("\n全部冒烟测试通过。");
