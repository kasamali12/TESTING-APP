/* ── Admin sign-in check: salted PBKDF2-SHA256 instead of a plain-text password in the file ── */
function _sdHexBytes(h){return Uint8Array.from(String(h).match(/../g)||[],function(x){return parseInt(x,16)})}
const _sdSha256K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const _sdSha256IV=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const _sdW=new Uint32Array(64);
function _sdRotr(x,n){return(x>>>n)|(x<<(32-n))}
function _sdCompress(H,B){
  const W=_sdW,K=_sdSha256K;
  for(let i=0;i<16;i++)W[i]=B[i];
  for(let i=16;i<64;i++){const a=W[i-15],b=W[i-2];W[i]=(W[i-16]+(_sdRotr(a,7)^_sdRotr(a,18)^(a>>>3))+W[i-7]+(_sdRotr(b,17)^_sdRotr(b,19)^(b>>>10)))|0}
  let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
  for(let i=0;i<64;i++){
    const t1=(h+(_sdRotr(e,6)^_sdRotr(e,11)^_sdRotr(e,25))+((e&f)^(~e&g))+K[i]+W[i])|0;
    const t2=((_sdRotr(a,2)^_sdRotr(a,13)^_sdRotr(a,22))+((a&b)^(a&c)^(b&c)))|0;
    h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
  }
  H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
}
function _sdSha256(bytes){
  const n=bytes.length,total=((n+9+63)>>6)<<6,buf=new Uint8Array(total);
  buf.set(bytes);buf[n]=0x80;
  const dv=new DataView(buf.buffer);
  dv.setUint32(total-8,Math.floor(n*8/4294967296));dv.setUint32(total-4,(n*8)>>>0);
  const H=new Uint32Array(_sdSha256IV),B=new Uint32Array(16);
  for(let o=0;o<total;o+=64){for(let i=0;i<16;i++)B[i]=dv.getUint32(o+i*4);_sdCompress(H,B)}
  const out=new Uint8Array(32),ov=new DataView(out.buffer);
  for(let i=0;i<8;i++)ov.setUint32(i*4,H[i]>>>0);
  return out;
}
/* Plain-JS PBKDF2-HMAC-SHA256 (32-byte result). Only used when the browser has no WebCrypto
   (for example a page opened over plain http on a network address), so sign-in never locks out. */
function _sdPbkdf2Js(pw,salt,iter){
  if(pw.length>64)pw=_sdSha256(pw);
  const ip=new Uint8Array(64).fill(0x36),op=new Uint8Array(64).fill(0x5c);
  for(let i=0;i<pw.length;i++){ip[i]^=pw[i];op[i]^=pw[i]}
  const cat=function(a,b){const r=new Uint8Array(a.length+b.length);r.set(a);r.set(b,a.length);return r};
  const blk=function(bytes){const dv=new DataView(bytes.buffer,bytes.byteOffset,64),B=new Uint32Array(16);for(let i=0;i<16;i++)B[i]=dv.getUint32(i*4);return B};
  const iS=new Uint32Array(_sdSha256IV),oS=new Uint32Array(_sdSha256IV);
  _sdCompress(iS,blk(ip));_sdCompress(oS,blk(op));
  let u=_sdSha256(cat(op,_sdSha256(cat(ip,cat(salt,new Uint8Array([0,0,0,1]))))));
  const t=new Uint32Array(8),dv=new DataView(u.buffer);
  for(let i=0;i<8;i++)t[i]=dv.getUint32(i*4);
  let cur=new Uint32Array(t);
  const B=new Uint32Array(16),H=new Uint32Array(8);
  for(let n=1;n<iter;n++){
    for(let i=0;i<8;i++)B[i]=cur[i];B[8]=0x80000000;for(let i=9;i<15;i++)B[i]=0;B[15]=768;
    H.set(iS);_sdCompress(H,B);
    for(let i=0;i<8;i++)B[i]=H[i];B[8]=0x80000000;for(let i=9;i<15;i++)B[i]=0;B[15]=768;
    H.set(oS);_sdCompress(H,B);
    for(let i=0;i<8;i++){cur[i]=H[i];t[i]^=H[i]}
  }
  const out=new Uint8Array(32),ov=new DataView(out.buffer);
  for(let i=0;i<8;i++)ov.setUint32(i*4,t[i]>>>0);
  return out;
}
async function _sdPbkdf2(pw,salt,iter){
  try{
    if(typeof crypto!=='undefined'&&crypto.subtle){
      const k=await crypto.subtle.importKey('raw',pw,'PBKDF2',false,['deriveBits']);
      return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:iter},k,256));
    }
  }catch(e){}
  return _sdPbkdf2Js(pw,salt,iter);
}
async function _sdAdminOk(cred){
  try{
    const want=_sdHexBytes(_SDA_CONF.AH);
    const got=await _sdPbkdf2(new TextEncoder().encode(String(cred)),_sdHexBytes(_SDA_CONF.AS),_SDA_CONF.AI);
    let d=got.length^want.length;
    for(let i=0;i<want.length;i++)d|=got[i]^want[i];
    return d===0;
  }catch(e){return false}
}
