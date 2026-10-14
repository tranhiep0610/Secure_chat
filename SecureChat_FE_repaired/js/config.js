(() => {
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const RENDER = "https://secure-chat-6oyl.onrender.com";

  // Thêm ?api=render vào URL để ép dùng Render khi đang ở local
  const forceRender = new URLSearchParams(location.search).get("api") === "render";

  const BACKEND = isLocal && !forceRender
    ? `http://${location.hostname}:3000`
    : RENDER;

  const realFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      if (typeof input === "string") {
        const match = input.match(/^(?:https?:\/\/[^/]+)?(\/api\/.*)$/);
        if (match && !input.startsWith(BACKEND)) {
          input = BACKEND + match[1];
          init = { ...init, credentials: "include" };
        }
      }
    } catch (error) {
      console.error("SecureChat API config error:", error);
    }
    return realFetch(input, init);
  };

  window.SECURECHAT_API = BACKEND;
})();