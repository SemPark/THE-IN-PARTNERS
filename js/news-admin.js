const GITHUB_OWNER = "SemPark";
const GITHUB_REPO = "THE-IN-PARTNERS";
const GITHUB_BRANCH = "main";
const NEWS_FILE_PATH = "data/news.json";
const GITHUB_CONTENTS_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${NEWS_FILE_PATH}`;

const loginPanel = document.querySelector("#loginPanel");
const managerPanel = document.querySelector("#managerPanel");
const loginForm = document.querySelector("#loginForm");
const githubToken = document.querySelector("#githubToken");
const newsForm = document.querySelector("#newsForm");
const newsUrl = document.querySelector("#newsUrl");
const newsTitle = document.querySelector("#newsTitle");
const newsExcerpt = document.querySelector("#newsExcerpt");
const newsImage = document.querySelector("#newsImage");
const newsDate = document.querySelector("#newsDate");
const adminList = document.querySelector("#adminList");
const message = document.querySelector("#message");
const loginMessage = document.querySelector("#loginMessage");
const adminCount = document.querySelector("#adminCount");
const newsFormTitle = document.querySelector("#newsFormTitle");
const newsSubmit = document.querySelector("#newsSubmit");
const newsEditCancel = document.querySelector("#newsEditCancel");
const editStatus = document.querySelector("#editStatus");
const newsImagePreview = document.querySelector("#newsImagePreview");

let token = sessionStorage.getItem("thein_news_github_token") || "";
let fileSha = "";
let newsItems = [];
let editingId = "";

if (token) {
  githubToken.value = token;
  loadAdminNews();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  token = githubToken.value.trim();
  sessionStorage.setItem("thein_news_github_token", token);
  await loadAdminNews();
});

newsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const item = normalizeAdminNewsItem({
      id: editingId || crypto.randomUUID(),
      url: newsUrl.value,
      title: newsTitle.value,
      sourceName: hostname(newsUrl.value),
      excerpt: newsExcerpt.value,
      image: newsImage.value,
      date: newsDate.value,
    });
    const file = await fetchNewsFile();
    fileSha = file.sha;
    const latestItems = parseNewsContent(file.content);

    if (editingId) {
      const itemIndex = latestItems.findIndex((candidate) => candidate.id === editingId);
      if (itemIndex < 0) throw new Error("수정할 기사를 찾지 못했습니다. 목록을 새로 불러와 주세요.");
      latestItems[itemIndex] = item;
      await saveNewsItems(latestItems, "Update news article");
      resetNewsForm();
      setMessage("기사를 수정했습니다. 사이트 반영에는 잠시 시간이 걸릴 수 있습니다.");
      return;
    }

    await saveNewsItems([item, ...latestItems], "Add news link");
    resetNewsForm();
    setMessage("뉴스 링크를 추가했습니다.");
  } catch (error) {
    setMessage(error.message || "기사를 저장하지 못했습니다.");
  }
});

newsEditCancel.addEventListener("click", () => {
  resetNewsForm();
  setMessage("기사 편집을 취소했습니다.");
});

newsImage.addEventListener("input", () => renderImagePreview(newsImage.value));

async function loadAdminNews() {
  try {
    const file = await fetchNewsFile();
    fileSha = file.sha;
    newsItems = parseNewsContent(file.content);

    loginPanel.classList.add("hidden");
    managerPanel.classList.remove("hidden");
    loginMessage.textContent = "";
    setMessage("GitHub 저장소와 연결되었습니다.");
    renderAdminList(newsItems);
  } catch (error) {
    token = "";
    sessionStorage.removeItem("thein_news_github_token");
    githubToken.value = "";
    githubToken.focus();
    loginPanel.classList.remove("hidden");
    managerPanel.classList.add("hidden");
    setLoginMessage(error.message || "GitHub 토큰을 확인해 주세요.");
  }
}

async function fetchNewsFile() {
  const response = await fetch(`${GITHUB_CONTENTS_API}?ref=${GITHUB_BRANCH}`, {
    headers: githubHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "뉴스 파일을 불러오지 못했습니다.");
  return payload;
}

async function saveNewsItems(items, commitMessage) {
  const cleanItems = items.map(normalizeAdminNewsItem);
  const response = await fetch(GITHUB_CONTENTS_API, {
    method: "PUT",
    headers: {
      ...githubHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: toBase64(JSON.stringify(cleanItems, null, 2) + "\n"),
      sha: fileSha,
      branch: GITHUB_BRANCH,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "GitHub 저장에 실패했습니다.");

  fileSha = payload.content.sha;
  newsItems = cleanItems;
  renderAdminList(newsItems);
}

function renderAdminList(items) {
  adminCount.textContent = items.length;
  if (!items.length) {
    adminList.innerHTML = '<div class="empty">저장된 뉴스 링크가 없습니다.</div>';
    return;
  }

  adminList.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-item";
    if (item.id === editingId) row.classList.add("is-editing");
    row.innerHTML = `
      <div class="admin-thumb">${renderAdminImage(item.image)}</div>
      <div class="admin-news-text">
        <a class="admin-url" href="${escapeAdminHtml(item.url)}" target="_blank" rel="noopener">${escapeAdminHtml(item.title || item.url)}</a>
        <span>${escapeAdminHtml(item.sourceName || hostname(item.url))}</span>
      </div>
      <div class="admin-actions">
        <button class="edit-btn" type="button">수정</button>
        <button class="danger-btn" type="button" aria-label="삭제">×</button>
      </div>
    `;
    row.querySelector(".edit-btn").addEventListener("click", () => startEditing(item));
    row.querySelector(".danger-btn").addEventListener("click", () => deleteNews(item));
    adminList.appendChild(row);
  });
}

function startEditing(item) {
  editingId = item.id;
  newsUrl.value = item.url;
  newsTitle.value = item.title;
  newsExcerpt.value = item.excerpt;
  newsImage.value = item.image;
  newsDate.value = item.date;
  newsFormTitle.textContent = "기사 편집";
  newsSubmit.textContent = "수정 저장";
  newsEditCancel.classList.remove("hidden");
  editStatus.classList.remove("hidden");
  renderImagePreview(item.image);
  renderAdminList(newsItems);
  newsForm.scrollIntoView({ behavior: "smooth", block: "start" });
  newsTitle.focus();
}

function resetNewsForm() {
  editingId = "";
  newsForm.reset();
  newsFormTitle.textContent = "기사 추가";
  newsSubmit.textContent = "추가";
  newsEditCancel.classList.add("hidden");
  editStatus.classList.add("hidden");
  renderImagePreview("");
  renderAdminList(newsItems);
}

async function deleteNews(target) {
  try {
    const file = await fetchNewsFile();
    fileSha = file.sha;
    const latestItems = parseNewsContent(file.content);
    const nextItems = latestItems.filter((item) => item.id !== target.id && item.url !== target.url);

    if (nextItems.length === latestItems.length) {
      throw new Error("삭제할 뉴스를 찾지 못했습니다.");
    }

    await saveNewsItems(nextItems, "Remove news link");
    if (editingId === target.id) resetNewsForm();
    setMessage("뉴스 링크를 삭제했습니다.");
  } catch (error) {
    setMessage(error.message || "삭제하지 못했습니다.");
  }
}

function parseNewsContent(content) {
  try {
    const json = fromBase64(content);
    const items = JSON.parse(json);
    return Array.isArray(items) ? items.map(normalizeAdminNewsItem) : [];
  } catch {
    throw new Error("뉴스 파일 형식을 읽지 못했습니다.");
  }
}

function normalizeAdminNewsItem(item) {
  const url = String(item.url || "").trim();
  if (!isValidUrl(url)) throw new Error("올바른 뉴스 링크를 입력해 주세요.");
  return {
    id: item.id || crypto.randomUUID(),
    url,
    title: String(item.title || hostname(url)).trim(),
    sourceName: String(item.sourceName || hostname(url)).trim(),
    excerpt: String(item.excerpt || "").trim(),
    image: String(item.image || "").trim(),
    date: String(item.date || "").trim(),
  };
}

function renderAdminImage(value) {
  const imageUrl = normalizeAdminImageUrl(value);
  if (!imageUrl) return '<div class="admin-thumb-fallback">NO IMAGE</div>';
  return `<img src="${escapeAdminHtml(imageUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.innerHTML='&lt;div class=&quot;admin-thumb-fallback&quot;&gt;NO IMAGE&lt;/div&gt;'">`;
}

function renderImagePreview(value) {
  const imageUrl = normalizeAdminImageUrl(value);
  if (!imageUrl) {
    newsImagePreview.innerHTML = '<div class="image-preview-empty">썸네일 미리보기</div>';
    return;
  }

  newsImagePreview.innerHTML = `<img src="${escapeAdminHtml(imageUrl)}" alt="선택한 썸네일 미리보기" referrerpolicy="no-referrer">`;
  newsImagePreview.querySelector("img").addEventListener("error", () => {
    newsImagePreview.innerHTML = '<div class="image-preview-empty">이미지를 불러오지 못했습니다.</div>';
  }, { once: true });
}

function normalizeAdminImageUrl(value) {
  const src = String(value || "").trim();
  if (!src) return "";

  try {
    const url = new URL(src);
    if (url.hostname === "drive.google.com") {
      const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const id = pathMatch?.[1] || url.searchParams.get("id");
      if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
    }
  } catch {
    return src;
  }

  return src;
}

function githubHeaders() {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
}

function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "news";
  }
}

function setMessage(text) {
  message.textContent = text;
}

function setLoginMessage(text) {
  loginMessage.textContent = text;
}

function escapeAdminHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
