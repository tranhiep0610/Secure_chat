// js/realtime-client.js
export function connectRealtime(apiBase, handlers = {}) {
  let source = null;
  let closed = false;

  function handle(e) {
    let data;
    try { data = JSON.parse(e.data); } catch { return; }

    const type = e.type !== 'message' ? e.type : (data.type || data.event || 'message');
    const payload = data.data && typeof data.data === 'object' ? data.data : data;

    if (type === 'read') handlers.onRead?.(payload);
    else if (payload.conversationId) handlers.onMessage?.(payload);
  }

  function open() {
    if (closed) return;
    source = new EventSource(`${apiBase}/api/events`, { withCredentials: true });
    source.onopen = () => handlers.onOpen?.();
    source.onerror = () => {
      handlers.onFallback?.();
      if (source.readyState === EventSource.CLOSED) setTimeout(open, 3000);
    };
    source.addEventListener('message', handle);
    source.addEventListener('read', handle);
  }

  open();
  return { close() { closed = true; source?.close(); } };
}