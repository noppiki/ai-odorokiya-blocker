(() => {
  const PROCESSED = "data-ai-odorokiya-processed";
  const DEFAULTS = {
    enabled: true,
    threshold: 60,
    mode: "collapse",
    accountScores: {},
    whitelist: []
  };

  const RULES = [
    { pattern: /これは(?:ヤバい|やばい|凄い|すごい|エグい)/i, score: 24, label: "これはヤバい系" },
    { pattern: /(?:AI|ChatGPT|Claude|Gemini|GPT|Cursor|Devin).{0,18}(?:終わった|終了|オワコン)/i, score: 34, label: "AI製品終了断定" },
    { pattern: /(?:エンジニア|プログラマ|デザイナ|ライタ|仕事|職業).{0,18}(?:終わる|終わった|不要|なくなる|消える)/i, score: 36, label: "職業消滅断定" },
    { pattern: /(?:ゲームチェンジャー|革命的|革命が起きる|世界が変わる)/i, score: 24, label: "革命系" },
    { pattern: /知らないと(?:損|ヤバい|危険)/i, score: 28, label: "知らないと損系" },
    { pattern: /今すぐ.{0,12}(?:使う|試す|触る|導入)/i, score: 18, label: "今すぐ系" },
    { pattern: /たった.{0,12}(?:秒|分|時間)で/i, score: 16, label: "短時間強調" },
    { pattern: /(?:完全に|マジで|本当に).{0,10}(?:別次元|異次元|次世代|化け物)/i, score: 18, label: "極端な形容" },
    { pattern: /(?:ついに来た|遂に来た|衝撃|激震)/i, score: 18, label: "衝撃系" },
    { pattern: /(?:保存推奨|ブクマ推奨|絶対に見て)/i, score: 12, label: "拡散誘導" },
    { pattern: /🤯/u, score: 12, label: "🤯" },
    { pattern: /🚨/u, score: 12, label: "🚨" },
    { pattern: /🔥{2,}/u, score: 10, label: "🔥連打" },
    { pattern: /(?:！{3,}|!{3,})/u, score: 10, label: "感嘆符連打" },
    { pattern: /(?:史上最強|過去最高|最強すぎる)/i, score: 18, label: "最上級断定" }
  ];

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
  }

  function storageSet(value) {
    return new Promise((resolve) => chrome.storage.sync.set(value, resolve));
  }

  async function getSettings() {
    const stored = await storageGet(DEFAULTS);
    return { ...DEFAULTS, ...stored };
  }

  function getTweetText(tweet) {
    const el = tweet.querySelector('[data-testid="tweetText"]');
    return el?.innerText?.trim() || "";
  }

  function getHandle(tweet) {
    const links = [...tweet.querySelectorAll('a[href^="/"]')];
    for (const link of links) {
      const text = link.textContent?.trim() || "";
      if (/^@[A-Za-z0-9_]{1,15}$/.test(text)) return text.toLowerCase();
    }
    return null;
  }

  function scoreTweet(text, handle, settings) {
    let score = 0;
    const reasons = [];

    for (const rule of RULES) {
      if (rule.pattern.test(text)) {
        score += rule.score;
        reasons.push(`${rule.label} +${rule.score}`);
      }
    }

    const accountBoost = handle ? Number(settings.accountScores?.[handle] || 0) : 0;
    if (accountBoost) {
      score += accountBoost;
      reasons.push(`アカウント学習 ${accountBoost > 0 ? "+" : ""}${accountBoost}`);
    }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  }

  function createBadge(score) {
    const badge = document.createElement("span");
    badge.className = "ai-odorokiya-score";
    badge.textContent = `🙄 驚き屋 ${score}`;
    badge.title = "AI驚き屋バスターの判定スコア";
    return badge;
  }

  function collapseTweet(tweet, score, reasons) {
    if (tweet.querySelector(":scope > .ai-odorokiya-cover")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "ai-odorokiya-cover";

    const info = document.createElement("div");
    info.className = "ai-odorokiya-cover__info";
    info.innerHTML = `<strong>🙄 AI驚き屋度 ${score}</strong><span>誇張表現の可能性が高いため折りたたみました</span>`;

    const details = document.createElement("div");
    details.className = "ai-odorokiya-cover__details";
    details.textContent = reasons.slice(0, 4).join(" / ");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ai-odorokiya-show";
    button.textContent = "表示";
    button.addEventListener("click", () => {
      tweet.classList.remove("ai-odorokiya-collapsed");
      wrapper.remove();
    });

    info.appendChild(details);
    wrapper.append(info, button);
    tweet.classList.add("ai-odorokiya-collapsed");
    tweet.prepend(wrapper);
  }

  function addFeedback(tweet, handle, score) {
    if (tweet.querySelector(".ai-odorokiya-feedback")) return;

    const host = tweet.querySelector('[role="group"]')?.parentElement || tweet;
    const box = document.createElement("div");
    box.className = "ai-odorokiya-feedback";
    box.appendChild(createBadge(score));

    const mark = document.createElement("button");
    mark.type = "button";
    mark.textContent = "🙄 驚き屋";
    mark.title = "この投稿者の驚き屋スコアを上げる";
    mark.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!handle) return;
      const settings = await getSettings();
      const scores = { ...settings.accountScores };
      scores[handle] = Math.min(50, Number(scores[handle] || 0) + 15);
      await storageSet({ accountScores: scores });
      mark.textContent = "✓ 学習した";
    });

    const pardon = document.createElement("button");
    pardon.type = "button";
    pardon.textContent = "違う";
    pardon.title = "この投稿者へのペナルティを下げる";
    pardon.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!handle) return;
      const settings = await getSettings();
      const scores = { ...settings.accountScores };
      scores[handle] = Math.max(-40, Number(scores[handle] || 0) - 15);
      await storageSet({ accountScores: scores });
      pardon.textContent = "✓ 学習した";
    });

    box.append(mark, pardon);
    host.appendChild(box);
  }

  async function processTweet(tweet) {
    if (!(tweet instanceof HTMLElement) || tweet.hasAttribute(PROCESSED)) return;
    tweet.setAttribute(PROCESSED, "1");

    const settings = await getSettings();
    if (!settings.enabled) return;

    const text = getTweetText(tweet);
    if (!text) return;

    const handle = getHandle(tweet);
    if (handle && settings.whitelist?.includes(handle)) return;

    const result = scoreTweet(text, handle, settings);
    addFeedback(tweet, handle, result.score);

    if (result.score < Number(settings.threshold || 60)) return;

    if (settings.mode === "hide") {
      tweet.style.display = "none";
    } else {
      collapseTweet(tweet, result.score, result.reasons);
    }
  }

  function scan(root = document) {
    root.querySelectorAll?.('article[data-testid="tweet"]').forEach(processTweet);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.('article[data-testid="tweet"]')) processTweet(node);
        else scan(node);
      }
    }
  });

  chrome.storage.onChanged.addListener(() => {
    document.querySelectorAll(`article[data-testid="tweet"][${PROCESSED}]`).forEach((tweet) => {
      tweet.removeAttribute(PROCESSED);
      tweet.style.display = "";
      tweet.classList.remove("ai-odorokiya-collapsed");
      tweet.querySelector(":scope > .ai-odorokiya-cover")?.remove();
      tweet.querySelectorAll(".ai-odorokiya-feedback").forEach((el) => el.remove());
    });
    scan();
  });

  scan();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
