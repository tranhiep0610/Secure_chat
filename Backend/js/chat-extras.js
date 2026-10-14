/*
  Secure Chat - UI Extras
  -------------------------------------------------------
  File này KHÔNG thay đổi logic AES/DES, socket hay API hiện có.
  Nó chỉ bổ sung các tiện ích giao diện cho chat.js cũ:
  - Dark mode
  - Tìm trong hội thoại
  - Emoji nhanh
  - Lưu bản nháp theo người đang chat
  - Copy / Reply tin nhắn
  - Nút cuộn xuống cuối
  - Popup thông tin hội thoại
  - Đếm ký tự
*/

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

ready(() => {
  const body = document.body;
  const chatMain = $('.chat-main');
  const chatHeader = $('.chat-header');
  const messagesPanel = $('#messagesPanel');
  const messageList = $('#messageList');
  const messageInput = $('#messageInput');
  const messageForm = $('#messageForm');
  const userSearch = $('#userSearch');
  const peerName = $('#peerName');
  const peerStatus = $('#peerStatus');
  const algorithmSelect = $('#algorithmSelect');
  const keyStatusText = $('#keyStatusText');
  const composerFooter = $('.chat-composer__footer');

  if (!chatMain || !chatHeader || !messagesPanel || !messageList || !messageInput) {
    console.warn('[chat-extras] Không tìm thấy layout chat cũ. Extras không được khởi tạo.');
    return;
  }

  // =====================================================
  // THEME
  // =====================================================
  const THEME_KEY = 'secure_chat_theme';
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'dark') body.classList.add('extras-dark');

  // =====================================================
  // HEADER ACTIONS
  // =====================================================
  const headerActions = document.createElement('div');
  headerActions.className = 'extras-header-actions';
  headerActions.innerHTML = `
    <button class="extras-icon-btn" id="extrasSearchBtn" type="button" title="Tìm trong đoạn chat" aria-label="Tìm trong đoạn chat">⌕</button>
    <button class="extras-icon-btn" id="extrasInfoBtn" type="button" title="Thông tin hội thoại" aria-label="Thông tin hội thoại">ⓘ</button>
    <button class="extras-icon-btn" id="extrasThemeBtn" type="button" title="Đổi giao diện sáng/tối" aria-label="Đổi giao diện sáng/tối">◐</button>
  `;

  const securityArea = $('.chat-security', chatHeader);
  if (securityArea) {
    securityArea.insertAdjacentElement('afterend', headerActions);
  } else {
    chatHeader.appendChild(headerActions);
  }

  const searchBtn = $('#extrasSearchBtn');
  const infoBtn = $('#extrasInfoBtn');
  const themeBtn = $('#extrasThemeBtn');

  themeBtn?.addEventListener('click', () => {
    body.classList.toggle('extras-dark');
    localStorage.setItem(
      THEME_KEY,
      body.classList.contains('extras-dark') ? 'dark' : 'light'
    );
  });

  // =====================================================
  // SEARCH IN CURRENT CHAT
  // =====================================================
  const searchBox = document.createElement('div');
  searchBox.className = 'extras-chat-search';
  searchBox.hidden = true;
  searchBox.innerHTML = `
    <span class="extras-search-icon">⌕</span>
    <input id="extrasChatSearchInput" type="search" placeholder="Tìm trong hội thoại..." autocomplete="off">
    <span id="extrasSearchCount" class="extras-search-count"></span>
    <button id="extrasSearchClose" type="button" aria-label="Đóng tìm kiếm">×</button>
  `;
  chatMain.appendChild(searchBox);

  const chatSearchInput = $('#extrasChatSearchInput');
  const searchCount = $('#extrasSearchCount');
  const searchClose = $('#extrasSearchClose');

  function applyMessageSearch() {
    const query = (chatSearchInput?.value || '').trim().toLowerCase();
    const rows = $$('.chat-message-row', messageList);
    let matched = 0;

    rows.forEach(row => {
      const text = $('.chat-message__text', row)?.textContent?.toLowerCase() || '';
      const isMatch = !query || text.includes(query);
      row.hidden = !isMatch;
      if (query && isMatch) matched += 1;
    });

    if (!searchCount) return;
    searchCount.textContent = query ? `${matched} kết quả` : '';
  }

  function openMessageSearch() {
    searchBox.hidden = false;
    chatSearchInput?.focus();
    chatSearchInput?.select();
  }

  function closeMessageSearch() {
    searchBox.hidden = true;
    if (chatSearchInput) chatSearchInput.value = '';
    applyMessageSearch();
  }

  searchBtn?.addEventListener('click', openMessageSearch);
  searchClose?.addEventListener('click', closeMessageSearch);
  chatSearchInput?.addEventListener('input', applyMessageSearch);

  // =====================================================
  // INFO MODAL
  // =====================================================
  const infoModal = document.createElement('div');
  infoModal.className = 'extras-info-modal';
  infoModal.hidden = true;
  infoModal.innerHTML = `
    <div class="extras-info-backdrop" data-extras-close-info></div>
    <section class="extras-info-card" role="dialog" aria-modal="true" aria-label="Thông tin hội thoại">
      <button class="extras-info-close" id="extrasInfoClose" type="button" aria-label="Đóng">×</button>
      <div class="extras-info-avatar" id="extrasInfoAvatar">?</div>
      <h2 id="extrasInfoName">Người dùng</h2>
      <p id="extrasInfoStatus">Chưa có hội thoại</p>
      <div class="extras-info-grid">
        <div><span>Loại</span><strong>Chat 1–1</strong></div>
        <div><span>Mã hóa</span><strong id="extrasInfoAlgorithm">—</strong></div>
        <div><span>Khóa hiện tại</span><strong id="extrasInfoKey">—</strong></div>
        <div><span>Bảo vệ</span><strong>Mã hóa trước khi gửi</strong></div>
      </div>
    </section>
  `;
  document.body.appendChild(infoModal);

  function currentPeerName() {
    const value = peerName?.textContent?.trim() || '';
    if (!value || value.toLowerCase().startsWith('chọn một người')) return '';
    return value;
  }

  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  function refreshInfoModal() {
    const name = currentPeerName() || 'Chưa chọn người dùng';
    $('#extrasInfoName').textContent = name;
    $('#extrasInfoAvatar').textContent = getInitials(currentPeerName());
    $('#extrasInfoStatus').textContent = peerStatus?.textContent?.trim() || 'Chưa có hội thoại';
    $('#extrasInfoAlgorithm').textContent = algorithmSelect?.value || '—';
    $('#extrasInfoKey').textContent = keyStatusText?.textContent?.trim() || '—';
    if (infoBtn) infoBtn.disabled = !currentPeerName();
  }

  function openInfoModal() {
    refreshInfoModal();
    if (!currentPeerName()) return;
    infoModal.hidden = false;
  }

  function closeInfoModal() {
    infoModal.hidden = true;
  }

  infoBtn?.addEventListener('click', openInfoModal);
  $('#extrasInfoClose')?.addEventListener('click', closeInfoModal);
  infoModal.addEventListener('click', event => {
    if (event.target.matches('[data-extras-close-info]')) closeInfoModal();
  });

  // =====================================================
  // EMOJI + CHARACTER COUNTER
  // =====================================================
  const composerTools = document.createElement('div');
  composerTools.className = 'extras-composer-tools';
  composerTools.innerHTML = `
    <button id="extrasEmojiBtn" class="extras-composer-btn" type="button" title="Emoji">☺</button>
    <span id="extrasCharCount" class="extras-char-count">0</span>
  `;

  if (composerFooter) {
    composerFooter.prepend(composerTools);
  }

  const emojiBtn = $('#extrasEmojiBtn');
  const charCount = $('#extrasCharCount');

  const emojiPanel = document.createElement('div');
  emojiPanel.className = 'extras-emoji-panel';
  emojiPanel.hidden = true;
  const emojis = ['😀','😂','🥹','😍','😎','🤔','😭','😡','👍','👎','👏','🙏','❤️','🔥','🎉','✅','🔐','💻','👀','✨'];
  emojiPanel.innerHTML = emojis
    .map(emoji => `<button type="button" data-extras-emoji="${emoji}">${emoji}</button>`)
    .join('');
  chatMain.appendChild(emojiPanel);

  function updateCharCount() {
    if (!charCount) return;
    const length = messageInput.value.length;
    charCount.textContent = String(length);
    charCount.classList.toggle('is-long', length > 1500);
  }

  function insertAtCursor(text) {
    if (messageInput.disabled) return;
    const start = messageInput.selectionStart ?? messageInput.value.length;
    const end = messageInput.selectionEnd ?? messageInput.value.length;
    messageInput.value =
      messageInput.value.slice(0, start) +
      text +
      messageInput.value.slice(end);
    const next = start + text.length;
    messageInput.setSelectionRange(next, next);
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    messageInput.focus();
  }

  emojiBtn?.addEventListener('click', event => {
    event.stopPropagation();
    emojiPanel.hidden = !emojiPanel.hidden;
  });

  emojiPanel.addEventListener('click', event => {
    const button = event.target.closest('[data-extras-emoji]');
    if (!button) return;
    insertAtCursor(button.dataset.extrasEmoji || '');
    emojiPanel.hidden = true;
  });

  document.addEventListener('click', event => {
    if (!emojiPanel.hidden && !emojiPanel.contains(event.target) && event.target !== emojiBtn) {
      emojiPanel.hidden = true;
    }
  });

  messageInput.addEventListener('input', updateCharCount);
  updateCharCount();

  // =====================================================
  // DRAFT AUTO SAVE PER PEER
  // =====================================================
  const DRAFT_PREFIX = 'secure_chat_draft:';
  let activeDraftKey = '';

  function draftKey() {
    const peer = currentPeerName();
    return peer ? `${DRAFT_PREFIX}${peer}` : '';
  }

  function saveDraft() {
    const key = activeDraftKey || draftKey();
    if (!key) return;

    if (messageInput.value) {
      localStorage.setItem(key, messageInput.value);
    } else {
      localStorage.removeItem(key);
    }
  }

  function switchDraftForPeer() {
    const nextKey = draftKey();
    if (nextKey === activeDraftKey) return;

    // Lưu draft của peer cũ trước khi chuyển.
    if (activeDraftKey && messageInput.value) {
      localStorage.setItem(activeDraftKey, messageInput.value);
    }

    activeDraftKey = nextKey;
    if (!activeDraftKey) return;

    const saved = localStorage.getItem(activeDraftKey);
    if (saved && !messageInput.value.trim()) {
      messageInput.value = saved;
      messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  messageInput.addEventListener('input', saveDraft);

  messageForm?.addEventListener('submit', () => {
    // chat.js chỉ xóa input khi server xác nhận gửi thành công.
    window.setTimeout(() => {
      if (!activeDraftKey) return;
      if (messageInput.value.trim()) {
        localStorage.setItem(activeDraftKey, messageInput.value);
      } else {
        localStorage.removeItem(activeDraftKey);
      }
      updateCharCount();
    }, 1200);
  });

  // =====================================================
  // COPY / REPLY MESSAGE
  // =====================================================
  function decorateMessages() {
    $$('.chat-message', messageList).forEach(bubble => {
      if (bubble.dataset.extrasDecorated === '1') return;
      bubble.dataset.extrasDecorated = '1';

      const textNode = $('.chat-message__text', bubble);
      if (!textNode) return;

      const actions = document.createElement('div');
      actions.className = 'extras-message-actions';
      actions.innerHTML = `
        <button type="button" data-extras-action="reply" title="Trả lời">↩</button>
        <button type="button" data-extras-action="copy" title="Sao chép">⧉</button>
      `;

      actions.addEventListener('click', async event => {
        const button = event.target.closest('[data-extras-action]');
        if (!button) return;

        const text = textNode.textContent || '';
        const action = button.dataset.extrasAction;

        if (action === 'reply') {
          const excerpt = text.replace(/\s+/g, ' ').trim().slice(0, 80);
          insertAtCursor(`↪ “${excerpt}${text.length > 80 ? '…' : ''}”\n`);
        }

        if (action === 'copy') {
          try {
            await navigator.clipboard.writeText(text);
            button.textContent = '✓';
            window.setTimeout(() => (button.textContent = '⧉'), 900);
          } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
          }
        }
      });

      bubble.appendChild(actions);
    });
  }

  // =====================================================
  // SCROLL TO BOTTOM
  // =====================================================
  const scrollButton = document.createElement('button');
  scrollButton.className = 'extras-scroll-bottom';
  scrollButton.type = 'button';
  scrollButton.title = 'Xuống tin nhắn mới nhất';
  scrollButton.textContent = '↓';
  scrollButton.hidden = true;
  chatMain.appendChild(scrollButton);

  function updateScrollButton() {
    const distance =
      messagesPanel.scrollHeight - messagesPanel.scrollTop - messagesPanel.clientHeight;
    scrollButton.hidden = distance < 180;
  }

  messagesPanel.addEventListener('scroll', updateScrollButton, { passive: true });
  scrollButton.addEventListener('click', () => {
    messagesPanel.scrollTo({ top: messagesPanel.scrollHeight, behavior: 'smooth' });
  });

  // =====================================================
  // KEYBOARD SHORTCUTS
  // =====================================================
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMessageSearch();
      closeInfoModal();
      emojiPanel.hidden = true;
    }

    // Ctrl + K: tìm người dùng bên trái
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      userSearch?.focus();
      userSearch?.select();
    }

    // Ctrl + Shift + F: tìm trong hội thoại
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      openMessageSearch();
    }
  });

  // =====================================================
  // OBSERVERS
  // =====================================================
  const messageObserver = new MutationObserver(() => {
    decorateMessages();
    applyMessageSearch();
    updateScrollButton();
  });
  messageObserver.observe(messageList, { childList: true, subtree: true });

  if (peerName) {
    const peerObserver = new MutationObserver(() => {
      refreshInfoModal();
      // chat.js cập nhật peerName trước khi hoàn tất mở hội thoại.
      // Đợi 1 nhịp để tránh đụng với cập nhật input của code cũ.
      window.setTimeout(switchDraftForPeer, 0);
    });
    peerObserver.observe(peerName, { childList: true, characterData: true, subtree: true });
  }

  algorithmSelect?.addEventListener('change', refreshInfoModal);

  // Khởi tạo ban đầu.
  decorateMessages();
  refreshInfoModal();
  switchDraftForPeer();
  updateScrollButton();
});
