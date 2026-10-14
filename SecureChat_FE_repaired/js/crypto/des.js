// DES implementation for learning/benchmark only. DES is obsolete; do not use it for real security.
const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const S = [
[[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7],[0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8],[4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0],[15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]],
[[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10],[3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5],[0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15],[13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]],
[[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8],[13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1],[13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7],[1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]],
[[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15],[13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9],[10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4],[3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14]],
[[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9],[14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6],[4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14],[11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]],
[[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11],[10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8],[9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6],[4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]],
[[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1],[13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6],[1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2],[6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]],
[[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7],[1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2],[7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8],[2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]]];
const MASK28 = (1n << 28n) - 1n; const MASK32 = (1n << 32n) - 1n;
const permute = (value, table, inputBits) => table.reduce((out, position) => (out << 1n) | ((value >> BigInt(inputBits - position)) & 1n), 0n);
const bytesToBig = bytes => Array.from(bytes).reduce((n, b) => (n << 8n) | BigInt(b), 0n);
const bigToBytes = (n, length) => { const out = new Uint8Array(length); for (let i=length-1;i>=0;i--) { out[i]=Number(n & 255n); n >>= 8n; } return out; };
function subkeys(keyBytes) {
  if (keyBytes.length !== 8) throw new Error('Khóa DES phải dài đúng 8 byte.');
  const selected = permute(bytesToBig(keyBytes), PC1, 64); let c = (selected >> 28n) & MASK28; let d = selected & MASK28;
  const keys = [];
  for (const shift of SHIFTS) {
    c = ((c << BigInt(shift)) | (c >> BigInt(28-shift))) & MASK28;
    d = ((d << BigInt(shift)) | (d >> BigInt(28-shift))) & MASK28;
    keys.push(permute((c << 28n) | d, PC2, 56));
  }
  return keys;
}
function feistel(r, key) {
  const expanded = permute(r, E, 32) ^ key; let out = 0n;
  for (let i=0;i<8;i++) {
    const six = Number((expanded >> BigInt((7-i)*6)) & 63n);
    const row = ((six & 32) >> 4) | (six & 1); const col = (six >> 1) & 15;
    out = (out << 4n) | BigInt(S[i][row][col]);
  }
  return Number(permute(out, P, 32));
}
export function desBlock(inputBytes, keyBytes, decrypt = false) {
  if (inputBytes.length !== 8) throw new Error('DES xử lý từng khối 8 byte.');
  const keys = subkeys(keyBytes); if (decrypt) keys.reverse();
  const ip = permute(bytesToBig(inputBytes), IP, 64); let left = Number((ip >> 32n) & MASK32); let right = Number(ip & MASK32);
  for (const key of keys) { const next = (left ^ feistel(BigInt(right), key)) >>> 0; left = right; right = next; }
  return bigToBytes(permute((BigInt(right) << 32n) | BigInt(left), FP, 64), 8);
}
const encoder = new TextEncoder(); const decoder = new TextDecoder();
const toBase64 = bytes => { const a = new Uint8Array(bytes); let binary = ''; for (let i = 0; i < a.length; i += 0x8000) binary += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(binary); };
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
const unhex = text => Uint8Array.from(text.match(/.{2}/g) || [], x => parseInt(x,16));
function xor8(a,b) { const out = new Uint8Array(8); for(let i=0;i<8;i++) out[i]=a[i]^b[i]; return out; }
function cbcEncrypt(plain, key, iv) {
  const pad = 8 - (plain.length % 8); const padded = new Uint8Array(plain.length + pad); padded.set(plain); padded.fill(pad, plain.length);
  const out = new Uint8Array(padded.length); let prev = iv;
  for(let offset=0;offset<padded.length;offset+=8) { const block=desBlock(xor8(padded.slice(offset,offset+8),prev),key); out.set(block,offset); prev=block; }
  return out;
}
function cbcDecrypt(cipher, key, iv) {
  if (!cipher.length || cipher.length % 8) throw new Error('Ciphertext DES không hợp lệ.');
  const out = new Uint8Array(cipher.length); let prev=iv;
  for(let offset=0;offset<cipher.length;offset+=8) { const block=cipher.slice(offset,offset+8); out.set(xor8(desBlock(block,key,true),prev),offset); prev=block; }
  const pad=out[out.length-1]; if(pad<1 || pad>8) throw new Error('Padding DES không hợp lệ.');
  for(let i=out.length-pad;i<out.length;i++) if(out[i]!==pad) throw new Error('Padding DES không hợp lệ.');
  return out.slice(0,out.length-pad);
}
async function deriveDesKeys(passphrase, conversationId) {
  if (!String(passphrase).trim()) throw new Error('Hãy nhập khóa hội thoại trước khi mã hóa.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveBits']);
  const salt=encoder.encode(`SecureChat-v1|${conversationId}|DES-CBC-HMAC-SHA256`);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,320));
  return { desKey:bits.slice(0,8), macKey:bits.slice(8,40) };
}
async function hmac(keyBytes, data) {
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(data)));
}
const macPayload = e => JSON.stringify([e.version,e.conversationId,e.senderId,e.algorithm,e.keyId,e.iv,e.ciphertext,e.timestamp]);
export async function encryptDESMessage(plaintext, passphrase, conversationId, senderId) {
  const {desKey,macKey}=await deriveDesKeys(passphrase,conversationId);
  const iv=crypto.getRandomValues(new Uint8Array(8));
  const e={version:1,algorithm:'DES-CBC-HMAC-SHA256',conversationId,senderId,keyId:`des_${hex(await crypto.subtle.digest('SHA-256',encoder.encode(`${conversationId}|${passphrase}|des`))).slice(0,16)}`,iv:toBase64(iv),timestamp:Date.now()};
  e.ciphertext=toBase64(cbcEncrypt(encoder.encode(plaintext),desKey,iv));
  e.mac=toBase64(await hmac(macKey,macPayload(e)));
  return e;
}
export async function decryptDESMessage(envelope, passphrase, expectedConversationId) {
  if(!envelope || envelope.algorithm!=='DES-CBC-HMAC-SHA256' || envelope.version!==1) throw new Error('Gói DES không hợp lệ.');
  if(envelope.conversationId!==expectedConversationId) throw new Error('Tin nhắn thuộc cuộc trò chuyện khác.');
  const {desKey,macKey}=await deriveDesKeys(passphrase,expectedConversationId);
  const expected=await hmac(macKey,macPayload(envelope)); const actual=fromBase64(envelope.mac || '');
  if(expected.length!==actual.length || !expected.every((v,i)=>v===actual[i])) throw new Error('HMAC không hợp lệ: dữ liệu DES có thể đã bị sửa hoặc khóa sai.');
  return decoder.decode(cbcDecrypt(fromBase64(envelope.ciphertext),desKey,fromBase64(envelope.iv)));
}
export async function desSelfTest() {
  const key=unhex('133457799BBCDFF1'); const plain=unhex('0123456789ABCDEF');
  const cipher=hex(desBlock(plain,key));
  if(cipher!=='85e813540f0ab405') throw new Error(`DES known-answer test thất bại: ${cipher}`);
  const back=hex(desBlock(unhex(cipher),key,true));
  if(back!=='0123456789abcdef') throw new Error('DES giải mã khối thất bại.');
  const e=await encryptDESMessage('Kiểm tra DES 🔐','self-test-passphrase','test-conversation','test-sender');
  if(await decryptDESMessage(e,'self-test-passphrase','test-conversation')!=='Kiểm tra DES 🔐') throw new Error('DES message round-trip thất bại.');
  const tampered={...e,ciphertext:e.ciphertext.slice(0,-4)+'AAAA'}; let rejected=false;
  try { await decryptDESMessage(tampered,'self-test-passphrase','test-conversation'); } catch { rejected=true; }
  if(!rejected) throw new Error('DES không từ chối HMAC sai.');
  return {knownAnswer:true,roundTrip:true,tamperRejected:true};
}
