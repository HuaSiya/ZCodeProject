import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
const passcode = process.env.ADMIN_PASSCODE ?? "dev-admin-123";

const cookies = new Map();

async function request(path, options = {}) {
  const headers = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (cookies.size > 0) {
    headers.Cookie = [...cookies.entries()]
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
      cookies.delete(name);
    } else {
      cookies.set(name, value);
    }
  }
  const text = await response.text();
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
  };
}

const login = await request("/api/admin/login", {
  method: "POST",
  body: { passcode },
});
assert.equal(login.status, 200, "管理员登录失败");

const listed = await request("/api/admin/polls");
assert.equal(listed.status, 200, "读取投票列表失败");

for (const poll of listed.data) {
  const deleted = await request(`/api/admin/polls/${poll.id}`, {
    method: "DELETE",
  });
  assert.equal(deleted.status, 200, `删除 ${poll.id} 失败`);
}

console.log(`已清空 ${listed.data.length} 场本地测试投票。`);
