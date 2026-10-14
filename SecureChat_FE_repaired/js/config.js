(function () {
  const BACKEND = "https://secure-chat-6oyl.onrender.com";
  const realFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      if (typeof input === "string") {
        const m = input.match(/^(?:https?:\/\/[^\/]+)?(\/api\/.*)$/);
        if (m && !input.startsWith(BACKEND)) {
          input = BACKEND + m[1];
          init = Object.assign({}, init, { credentials: "include" });
        }
      }
    } catch (e) {}
    return realFetch(input, init);
  };

  window.SECURECHAT_API = BACKEND;
})();