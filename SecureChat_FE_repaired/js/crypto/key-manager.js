export const DEMO_PASSPHRASE = 'SecureChat-Demo-2026!';
const storageKey = id => `securechat.key.${id}`;
export function getConversationPassphrase(conversationId) { return sessionStorage.getItem(storageKey(conversationId)) || ''; }
export function setConversationPassphrase(conversationId, passphrase) {
  if (!String(passphrase).trim()) throw new Error('Khóa hội thoại không được để trống.');
  sessionStorage.setItem(storageKey(conversationId), passphrase);
}
export function clearConversationPassphrase(conversationId) { sessionStorage.removeItem(storageKey(conversationId)); }
export function clearAllPassphrases() { for (const key of Object.keys(sessionStorage)) if (key.startsWith('securechat.key.')) sessionStorage.removeItem(key); }
