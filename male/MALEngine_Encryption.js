/* =====================================================================
 *  MALEngine_Encryption.js  -  sealed data files for MALE games (.malengine)
 * ---------------------------------------------------------------------
 *  Turns game data (save games, player settings, anything JSON) into a
 *  .malengine file and back. A file is compressed, encrypted and sealed:
 *  every byte of it is covered by a signature (HMAC-SHA-256) made with the
 *  game's key, so a file that was edited, cut short, padded or damaged in
 *  ANY way fails to decode instead of loading changed data.
 *
 *  Standalone: needs no other engine file. Plain synchronous JavaScript (no
 *  WebCrypto, which is async and only exists on https pages), so it works
 *  from file://, over plain http, and in Node.
 *
 *  ---- Use -----------------------------------------------------------
 *    const opts = { key: 'my game secret', type: 'mygame.save' };
 *
 *    MALEngine_Encryption.save(data, 'slot1', opts);             // downloads slot1.malengine
 *    const data = await MALEngine_Encryption.pickAndLoad(opts);  // file picker -> data (null = cancelled)
 *    const data = await MALEngine_Encryption.load(file, opts);   // a File from <input type=file> / a drop
 *
 *    const bytes = MALEngine_Encryption.encode(data, opts);      // -> Uint8Array (keep it anywhere)
 *    const back  = MALEngine_Encryption.decode(bytes, opts);     // -> the data, or throws MALEncryptionError
 *    MALEngine_Encryption.verify(bytes, opts);                   // -> true / false (checks the seal only)
 *    MALEngine_Encryption.info(bytes);                           // -> { version, type, compressed, kind, size }, no key needed
 *    MALEngine_Encryption.toBase64(bytes) / .fromBase64(text)    // as text, for localStorage / sessionStorage
 *    (MALCrypt is a shorter name for the same object.)
 *
 *  data  any JSON value (objects, arrays, strings, numbers, booleans, null), or bytes
 *        (Uint8Array / ArrayBuffer), which come back as a Uint8Array.
 *  opts  key       the game's secret: any text (or bytes). A file only opens with the key
 *                  it was made with. Pick one per game and keep it: changing it makes
 *                  every older file unreadable.
 *        type      a short label for what the file holds ('mygame.save'), up to 255 bytes.
 *                  It is stored readable at the start of the file and checked first, so a
 *                  file meant for something else gives a clear 'wrong_type' error. It is
 *                  sealed like everything else.
 *        compress  false = store the data as it is (default: compress when that is smaller)
 *        kind      'text' = store a string as plain text instead of JSON (decode returns the string)
 *        maxBytes  load() / pickAndLoad(): refuse bigger files (default 64 MB)
 *        accept    pickFile() / pickAndLoad(): the file types the picker offers (default '.malengine')
 *
 *  Errors are MALEncryptionError, with err.code:
 *    'not_malengine'        not a .malengine file (or cut down to almost nothing)
 *    'unsupported_version'  made with a newer version of this file format
 *    'wrong_type'           a .malengine file of another type (opts.type)
 *    'tampered'             the seal doesn't match: the file was edited or damaged, or the key is wrong
 *    'corrupt'              sealed correctly, but the contents can't be read (a bug: shouldn't happen)
 *    'too_big'              load(): the file is bigger than opts.maxBytes
 *    'bad_data'             encode(): the data can't be stored (undefined, a BigInt, a cycle...)
 *    'bad_type'             encode(): the type is longer than 255 bytes
 *    'no_browser'           save() / load() / pickFile() outside a browser page
 *
 *  ---- How safe ------------------------------------------------------
 *  Anyone who changes a file without knowing this format AND the game's key
 *  (in a text or hex editor, by pasting in parts of another save, by changing
 *  the type...) gets a file that won't load. The data inside is encrypted, so
 *  it can't be read either. The key has to live in the game's own code,
 *  though: someone who reads that code can still make files of their own. No
 *  game that runs in the player's browser can fully stop that; this stops
 *  everyone else.
 *
 *  ---- File format (version 1) ---------------------------------------
 *    offset  size  field
 *    0       4     magic "MALE"
 *    4       1     format version (1)
 *    5       1     flags: bit 0 = compressed, bits 1-2 = kind (0 JSON, 1 text, 2 bytes)
 *    6       1     type length n
 *    7       n     type (UTF-8)
 *    7+n     16    salt (random, new for every file)
 *    23+n    12    nonce (random, new for every file)
 *    35+n    m     the body, encrypted with ChaCha20 (RFC 8439, block counter from 1):
 *                    4 bytes  the data's size before compression (little endian)
 *                    ...      the data (UTF-8 JSON / UTF-8 text / bytes), compressed when flag bit 0 is set
 *    end-32  32    seal: HMAC-SHA-256 of every byte before it
 *  Keys (HKDF-SHA-256): prk = HMAC(salt, key), enc = HMAC(prk, info + 0x01),
 *  mac = HMAC(prk, enc + info + 0x02), info = "MALEngine_Encryption v1 " + type.
 *  The salt gives every file its own keys. Compression: LZ77 with a 64 KB window
 *  and 4 byte minimum matches (see compress()).
 * ===================================================================== */
(function(root){
    'use strict';

    /** What encode / decode / load throw. err.code says what went wrong (see the list above). */
    class MALEncryptionError extends Error {
        constructor(code, message){
            super(message);
            this.name = 'MALEncryptionError';
            this.code = code;
        }
    }
    function fail(code, message){ throw new MALEncryptionError(code, message); }

    const EXTENSION = '.malengine';
    const MAGIC = [0x4D, 0x41, 0x4C, 0x45];                   // "MALE"
    const VERSION = 1;
    const SALT_LEN = 16, NONCE_LEN = 12, TAG_LEN = 32, SIZE_LEN = 4;
    const FLAG_COMPRESSED = 1;
    const KINDS = ['json', 'text', 'bytes'];                  // flags bits 1-2
    const INFO = 'MALEngine_Encryption v1 ';
    const DEFAULT_KEY = 'MALEngine_Encryption default key';   // when opts.key is left out (pass your own)
    const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

    /* =================================================================
     * Bytes and text
     * ================================================================= */
    const _encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    const _decoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8', { fatal: true }) : null;
    function utf8Encode(text){
        text = String(text);
        if(_encoder) return _encoder.encode(text);
        const bin = unescape(encodeURIComponent(text)), out = new Uint8Array(bin.length);
        for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    /** Throws on bytes that aren't valid UTF-8. */
    function utf8Decode(bytes){
        if(_decoder) return _decoder.decode(bytes);
        return decodeURIComponent(escape(binaryString(bytes)));
    }
    function binaryString(bytes){
        let s = '';
        for(let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return s;
    }
    /** Uint8Array / ArrayBuffer / any typed array / array of numbers -> Uint8Array (no copy when it can). Text -> its UTF-8. */
    function asBytes(v, what = 'data'){
        if(v instanceof Uint8Array) return v;
        if(v instanceof ArrayBuffer) return new Uint8Array(v);
        if(ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        if(Array.isArray(v)) return Uint8Array.from(v);
        if(typeof v === 'string') return utf8Encode(v);
        return fail('bad_data', `${what} must be text or bytes.`);
    }
    function concatBytes(...parts){
        let n = 0;
        for(const p of parts) n += p.length;
        const out = new Uint8Array(n);
        let o = 0;
        for(const p of parts){ out.set(p, o); o += p.length; }
        return out;
    }
    const readU32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;   // little endian
    function writeU32(b, o, v){ b[o] = v & 255; b[o + 1] = (v >>> 8) & 255; b[o + 2] = (v >>> 16) & 255; b[o + 3] = (v >>> 24) & 255; }
    function randomBytes(n){
        const out = new Uint8Array(n), c = root.crypto;
        if(c && typeof c.getRandomValues === 'function') c.getRandomValues(out);   // works on http and file:// too
        else for(let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
        return out;
    }
    /** Same bytes? Takes the same time wherever they differ. */
    function sameBytes(a, b){
        if(a.length !== b.length) return false;
        let d = 0;
        for(let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
        return d === 0;
    }
    function toBase64(bytes){ return btoa(binaryString(asBytes(bytes))); }
    function fromBase64(text){
        const bin = atob(String(text).replace(/\s+/g, '')), out = new Uint8Array(bin.length);
        for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    /* =================================================================
     * SHA-256 (FIPS 180-4) and HMAC-SHA-256 (RFC 2104)
     * ================================================================= */
    const K256 = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ]);
    /** Incremental SHA-256: new Sha256().update(a).update(b).digest() -> 32 bytes. */
    class Sha256 {
        constructor(){
            this.h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
            this.w = new Uint32Array(64);
            this.buf = new Uint8Array(64);   // bytes waiting for a full 64 byte block
            this.bufLen = 0;
            this.total = 0;                  // bytes hashed so far
        }
        update(data){
            const d = asBytes(data), n = d.length;
            let i = 0;
            this.total += n;
            if(this.bufLen){
                i = Math.min(64 - this.bufLen, n);
                this.buf.set(d.subarray(0, i), this.bufLen);
                this.bufLen += i;
                if(this.bufLen < 64) return this;
                this._block(this.buf, 0);
                this.bufLen = 0;
            }
            for(; i + 64 <= n; i += 64) this._block(d, i);
            if(i < n){ this.buf.set(d.subarray(i), 0); this.bufLen = n - i; }
            return this;
        }
        digest(){
            // padding: 0x80, zeros, then the length in bits (64 bit big endian), to a whole number of blocks
            const tail = new Uint8Array((this.bufLen + 9 + 63) & ~63);
            tail.set(this.buf.subarray(0, this.bufLen));
            tail[this.bufLen] = 0x80;
            const bits = this.total * 8, hi = Math.floor(bits / 0x100000000), lo = bits >>> 0, L = tail.length;
            tail[L - 8] = hi >>> 24; tail[L - 7] = (hi >>> 16) & 255; tail[L - 6] = (hi >>> 8) & 255; tail[L - 5] = hi & 255;
            tail[L - 4] = lo >>> 24; tail[L - 3] = (lo >>> 16) & 255; tail[L - 2] = (lo >>> 8) & 255; tail[L - 1] = lo & 255;
            for(let o = 0; o < L; o += 64) this._block(tail, o);
            const out = new Uint8Array(32);
            for(let i = 0; i < 8; i++){
                const v = this.h[i];
                out[i * 4] = v >>> 24; out[i * 4 + 1] = (v >>> 16) & 255; out[i * 4 + 2] = (v >>> 8) & 255; out[i * 4 + 3] = v & 255;
            }
            return out;
        }
        _block(b, o){
            const w = this.w, h = this.h;
            for(let t = 0; t < 16; t++, o += 4) w[t] = (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
            for(let t = 16; t < 64; t++){
                const x = w[t - 15], y = w[t - 2];
                const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
                const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
                w[t] = w[t - 16] + s0 + w[t - 7] + s1;
            }
            let a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for(let t = 0; t < 64; t++){
                const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
                const ch = (e & f) ^ (~e & g);
                const t1 = (hh + S1 + ch + K256[t] + w[t]) | 0;
                const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
                const maj = (a & bb) ^ (a & c) ^ (bb & c);
                const t2 = (S0 + maj) | 0;
                hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
            }
            h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
        }
    }
    /** SHA-256 of text or bytes -> 32 bytes. */
    function sha256(data){ return new Sha256().update(data).digest(); }
    /** HMAC-SHA-256 of the data parts (joined) with this key -> 32 bytes. */
    function hmacSha256(key, ...parts){
        let k = asBytes(key, 'key');
        if(k.length > 64) k = sha256(k);
        const pad = new Uint8Array(64);
        pad.set(k);
        const ipad = new Uint8Array(64), opad = new Uint8Array(64);
        for(let i = 0; i < 64; i++){ ipad[i] = pad[i] ^ 0x36; opad[i] = pad[i] ^ 0x5c; }
        const inner = new Sha256().update(ipad);
        for(const p of parts) inner.update(p);
        return new Sha256().update(opad).update(inner.digest()).digest();
    }

    /* =================================================================
     * ChaCha20 (RFC 8439)
     * ================================================================= */
    function quarter(x, a, b, c, d){
        let v;
        x[a] += x[b]; v = x[d] ^ x[a]; x[d] = (v << 16) | (v >>> 16);
        x[c] += x[d]; v = x[b] ^ x[c]; x[b] = (v << 12) | (v >>> 20);
        x[a] += x[b]; v = x[d] ^ x[a]; x[d] = (v << 8)  | (v >>> 24);
        x[c] += x[d]; v = x[b] ^ x[c]; x[b] = (v << 7)  | (v >>> 25);
    }
    /**
     * data XOR the ChaCha20 key stream (encrypting and decrypting are the same).
     * key 32 bytes, nonce 12 bytes, counter = the first block's number.
     */
    function chacha20(key, nonce, counter, data){
        key = asBytes(key, 'key'); nonce = asBytes(nonce, 'nonce'); data = asBytes(data);
        if(key.length !== 32 || nonce.length !== 12) fail('bad_data', 'chacha20 needs a 32 byte key and a 12 byte nonce.');
        const s = new Uint32Array(16), x = new Uint32Array(16), ks = new Uint8Array(64);
        s[0] = 0x61707865; s[1] = 0x3320646e; s[2] = 0x79622d32; s[3] = 0x6b206574;   // "expand 32-byte k"
        for(let i = 0; i < 8; i++) s[4 + i] = readU32(key, i * 4);
        s[12] = counter >>> 0;
        for(let i = 0; i < 3; i++) s[13 + i] = readU32(nonce, i * 4);
        if(Math.ceil(data.length / 64) > 0x100000000 - s[12]) fail('bad_data', 'Too much data for one ChaCha20 stream.');
        const out = new Uint8Array(data.length);
        for(let off = 0; off < data.length; off += 64){
            x.set(s);
            for(let r = 0; r < 10; r++){   // 20 rounds: column rounds, then diagonal rounds
                quarter(x, 0, 4, 8, 12); quarter(x, 1, 5, 9, 13); quarter(x, 2, 6, 10, 14); quarter(x, 3, 7, 11, 15);
                quarter(x, 0, 5, 10, 15); quarter(x, 1, 6, 11, 12); quarter(x, 2, 7, 8, 13); quarter(x, 3, 4, 9, 14);
            }
            for(let i = 0; i < 16; i++) writeU32(ks, i * 4, (x[i] + s[i]) >>> 0);
            const n = Math.min(64, data.length - off);
            for(let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
            s[12]++;
        }
        return out;
    }

    /* =================================================================
     * Compression: LZ77 sequences, written like an LZ4 block
     *   token (literal count << 4 | match length - 4; 15 = more in 255-continued bytes),
     *   the literal bytes, then a 2 byte offset back into the output and more match length.
     *   The last sequence is literals only (it ends the input).
     * ================================================================= */
    const MIN_MATCH = 4, MAX_OFFSET = 0xFFFF, HASH_BITS = 15;
    function compress(input){
        const src = asBytes(input), n = src.length;
        const out = new Uint8Array(n + (n >>> 7) + 64);            // the worst case (nothing repeats) fits
        const table = new Int32Array(1 << HASH_BITS);              // position + 1 of the last 4 bytes with that hash
        const read32 = i => src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24);
        const hashAt = i => Math.imul(read32(i), 0x9E3779B1) >>> (32 - HASH_BITS);
        let op = 0, ip = 0, anchor = 0;
        const putLength = len => { while(len >= 255){ out[op++] = 255; len -= 255; } out[op++] = len; };
        const lastStart = n - MIN_MATCH;                           // a match can't start after this
        while(ip <= lastStart){
            const h = hashAt(ip), cand = table[h] - 1;
            table[h] = ip + 1;
            if(cand < 0 || ip - cand > MAX_OFFSET || read32(cand) !== read32(ip)){ ip++; continue; }
            let len = MIN_MATCH;
            while(ip + len < n && src[cand + len] === src[ip + len]) len++;
            const lits = ip - anchor, ml = len - MIN_MATCH, off = ip - cand;
            out[op++] = (Math.min(lits, 15) << 4) | Math.min(ml, 15);
            if(lits >= 15) putLength(lits - 15);
            out.set(src.subarray(anchor, ip), op); op += lits;
            out[op++] = off & 255; out[op++] = off >>> 8;
            if(ml >= 15) putLength(ml - 15);
            const end = ip + len;
            for(let k = ip + 1; k < end && k <= lastStart; k++) table[hashAt(k)] = k + 1;   // later matches can start inside this one
            ip = anchor = end;
        }
        const lits = n - anchor;
        out[op++] = Math.min(lits, 15) << 4;
        if(lits >= 15) putLength(lits - 15);
        out.set(src.subarray(anchor, n), op); op += lits;
        return out.slice(0, op);
    }
    /** compress() backwards. `size` = the length it was before compressing. Throws 'corrupt' on anything malformed. */
    function decompress(input, size){
        const src = asBytes(input), n = src.length, out = new Uint8Array(size);
        const bad = () => fail('corrupt', 'The compressed data is damaged.');
        const getLength = len => {
            let b;
            do { if(ip >= n) bad(); b = src[ip++]; len += b; } while(b === 255);
            return len;
        };
        let ip = 0, op = 0;
        for(;;){
            if(ip >= n) bad();
            const token = src[ip++];
            let lits = token >>> 4;
            if(lits === 15) lits = getLength(lits);
            if(ip + lits > n || op + lits > size) bad();
            out.set(src.subarray(ip, ip + lits), op); ip += lits; op += lits;
            if(ip === n) break;                                    // the last sequence: literals only
            if(ip + 2 > n) bad();
            const off = src[ip] | (src[ip + 1] << 8);
            ip += 2;
            let len = token & 15;
            if(len === 15) len = getLength(len);
            len += MIN_MATCH;
            if(off === 0 || off > op || op + len > size) bad();
            let from = op - off;
            if(off >= len){ out.copyWithin(op, from, from + len); op += len; }
            else for(let k = 0; k < len; k++) out[op++] = out[from++];   // overlapping: repeats the last `off` bytes
        }
        if(op !== size) bad();
        return out;
    }

    /* =================================================================
     * The .malengine file
     * ================================================================= */
    function deriveKeys(key, salt, type){
        const secret = key == null ? utf8Encode(DEFAULT_KEY) : asBytes(key, 'key');
        const prk = hmacSha256(salt, secret);                     // HKDF-Extract
        const info = utf8Encode(INFO + type);
        const enc = hmacSha256(prk, info, [1]);                   // HKDF-Expand, 64 bytes
        const mac = hmacSha256(prk, enc, info, [2]);
        return { enc, mac };
    }
    function toPayload(data, opts){
        if(data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return { kind: 2, bytes: asBytes(data) };
        if(opts.kind === 'text') return { kind: 1, bytes: utf8Encode(data) };
        let json;
        try { json = JSON.stringify(data); }
        catch(e){ fail('bad_data', `The data can't be stored as JSON: ${e.message}`); }
        if(json === undefined) fail('bad_data', "The data can't be stored as JSON (it's undefined or a function).");
        return { kind: 0, bytes: utf8Encode(json) };
    }
    function fromPayload(bytes, kind){
        if(kind === 'bytes') return bytes.slice();
        let text;
        try { text = utf8Decode(bytes); } catch(e){ fail('corrupt', "The file's text isn't valid UTF-8."); }
        if(kind === 'text') return text;
        try { return JSON.parse(text); } catch(e){ return fail('corrupt', "The file's data isn't valid JSON."); }
    }
    /** The file's bytes as a Uint8Array (a string is refused: decode() takes the file, see fromBase64). */
    function fileBytes(v){
        if(typeof v === 'string') fail('not_malengine', 'decode() takes the file bytes (fromBase64() turns base64 text back into them).');
        if(v instanceof Uint8Array || v instanceof ArrayBuffer || ArrayBuffer.isView(v) || Array.isArray(v)) return asBytes(v);
        return fail('not_malengine', 'Not a .malengine file.');
    }
    /** Reads the readable start of a file. Throws 'not_malengine' / 'unsupported_version'. */
    function readHeader(b){
        const notOurs = () => fail('not_malengine', 'Not a .malengine file.');
        if(b.length < 7 || b[0] !== MAGIC[0] || b[1] !== MAGIC[1] || b[2] !== MAGIC[2] || b[3] !== MAGIC[3]) notOurs();
        const version = b[4];
        if(version === 0) notOurs();
        if(version > VERSION) fail('unsupported_version', `This file was made with a newer .malengine format (version ${version}); this one reads up to version ${VERSION}.`);
        const flags = b[5], typeLen = b[6];
        const typeAt = 7, saltAt = typeAt + typeLen, nonceAt = saltAt + SALT_LEN, bodyAt = nonceAt + NONCE_LEN;
        if(b.length < bodyAt + SIZE_LEN + TAG_LEN) notOurs();
        let type;
        try { type = utf8Decode(b.subarray(typeAt, saltAt)); } catch(e){ notOurs(); }
        return {
            version, flags, type,
            compressed: !!(flags & FLAG_COMPRESSED),
            kind: KINDS[(flags >>> 1) & 3] ?? null,
            salt: b.subarray(saltAt, nonceAt), nonce: b.subarray(nonceAt, bodyAt),
            bodyAt, tagAt: b.length - TAG_LEN,
        };
    }
    const sealOk = (b, head, macKey) => sameBytes(hmacSha256(macKey, b.subarray(0, head.tagAt)), b.subarray(head.tagAt));

    /** Data -> the bytes of a .malengine file (see the top of this file for data / opts). */
    function encode(data, opts = {}){
        const { kind, bytes } = toPayload(data, opts);
        const type = String(opts.type ?? 'data'), typeBytes = utf8Encode(type);
        if(typeBytes.length > 255) fail('bad_type', 'The type can be at most 255 bytes long.');
        let body = bytes, flags = kind << 1;
        if(opts.compress !== false && bytes.length > 32){
            const packed = compress(bytes);
            if(packed.length < bytes.length){ body = packed; flags |= FLAG_COMPRESSED; }
        }
        const plain = new Uint8Array(SIZE_LEN + body.length);
        writeU32(plain, 0, bytes.length);
        plain.set(body, SIZE_LEN);
        const salt = randomBytes(SALT_LEN), nonce = randomBytes(NONCE_LEN);
        const keys = deriveKeys(opts.key, salt, type);
        const header = concatBytes(MAGIC, [VERSION, flags, typeBytes.length], typeBytes, salt, nonce);
        const out = new Uint8Array(header.length + plain.length + TAG_LEN);
        out.set(header, 0);
        out.set(chacha20(keys.enc, nonce, 1, plain), header.length);
        out.set(hmacSha256(keys.mac, out.subarray(0, out.length - TAG_LEN)), out.length - TAG_LEN);
        return out;
    }
    /** The bytes of a .malengine file -> the data. Throws MALEncryptionError when it isn't exactly a file this key made. */
    function decode(bytes, opts = {}){
        const b = fileBytes(bytes), head = readHeader(b);
        if(opts.type != null && head.type !== String(opts.type)) fail('wrong_type', `This file holds '${head.type}', not '${opts.type}'.`);
        const keys = deriveKeys(opts.key, head.salt, head.type);
        if(!sealOk(b, head, keys.mac)) fail('tampered', 'The file was changed or damaged after it was made (or this is the wrong key).');
        if(!head.kind) fail('unsupported_version', 'This file holds a kind of data this version doesn\'t know.');
        const plain = chacha20(keys.enc, head.nonce, 1, b.subarray(head.bodyAt, head.tagAt));
        const size = readU32(plain, 0);
        let data = plain.subarray(SIZE_LEN);
        if(head.compressed) data = decompress(data, size);
        else if(data.length !== size) fail('corrupt', 'The data has the wrong size.');
        return fromPayload(data, head.kind);
    }
    /** Is this exactly a file made with this key (and of opts.type, when given)? Checks the seal only. */
    function verify(bytes, opts = {}){
        try {
            const b = fileBytes(bytes), head = readHeader(b);
            if(opts.type != null && head.type !== String(opts.type)) return false;
            return sealOk(b, head, deriveKeys(opts.key, head.salt, head.type).mac);
        } catch(e){ return false; }
    }
    /** What the readable start of a file says (no key needed, nothing is checked): { version, type, compressed, kind, size }. */
    function info(bytes){
        const b = fileBytes(bytes), head = readHeader(b);
        return { format: 'malengine', version: head.version, type: head.type, compressed: head.compressed, kind: head.kind, size: b.length };
    }
    /** Does this start like a .malengine file? (never throws) */
    function isMalengine(bytes){
        try { const b = fileBytes(bytes); return b.length >= 4 && MAGIC.every((m, i) => b[i] === m); } catch(e){ return false; }
    }

    /* =================================================================
     * Browser helpers: download, file picker, reading files
     * ================================================================= */
    const needPage = what => { if(typeof document === 'undefined') fail('no_browser', `${what} needs a browser page.`); };
    /** A safe file name that ends in .malengine. */
    function fileName(name){
        let s = String(name ?? '').trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_');
        if(!s) s = 'data';
        if(!s.toLowerCase().endsWith(EXTENSION)) s += EXTENSION;
        return s;
    }
    /** Downloads bytes as a file (the name gets .malengine). Returns the file name. */
    function download(bytes, name = 'data'){
        needPage('download()');
        const file = fileName(name);
        const url = URL.createObjectURL(new Blob([asBytes(bytes)], { type: 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url; a.download = file; a.rel = 'noopener'; a.style.display = 'none';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return file;
    }
    /** encode() + download(): saves data as <name>.malengine. Returns { file, bytes }. */
    function save(data, name = 'data', opts = {}){
        const bytes = encode(data, opts);
        return { file: download(bytes, name), bytes };
    }
    /** A File / Blob -> Promise<Uint8Array>. */
    function readFile(file){
        if(file && typeof file.arrayBuffer === 'function') return file.arrayBuffer().then(buf => new Uint8Array(buf));
        return new Promise((resolve, reject) => {
            if(typeof FileReader === 'undefined' || !file) return reject(new MALEncryptionError('no_browser', 'readFile() needs a File (or Blob) in a browser page.'));
            const r = new FileReader();
            r.onload = () => resolve(new Uint8Array(r.result));
            r.onerror = () => reject(r.error || new Error('The file could not be read.'));
            r.readAsArrayBuffer(file);
        });
    }
    /** A File / Blob -> Promise<data> (readFile + decode). Rejects with MALEncryptionError. */
    function load(file, opts = {}){
        const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;
        if(file && file.size > max) return Promise.reject(new MALEncryptionError('too_big', `The file is bigger than ${max} bytes.`));
        return readFile(file).then(bytes => decode(bytes, opts));
    }
    /**
     * Opens the browser's file picker. Promise<File | null> (null = cancelled).
     * Call it from a click (browsers only open the picker right after the player does something).
     */
    function pickFile(opts = {}){
        needPage('pickFile()');
        return new Promise(resolve => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = opts.accept ?? EXTENSION;
            input.style.display = 'none';
            let done = false;
            const finish = file => {
                if(done) return;
                done = true;
                window.removeEventListener('focus', onFocus);
                input.remove();
                resolve(file);
            };
            // browsers without the 'cancel' event: the page gets its focus back with nothing picked
            const onFocus = () => setTimeout(() => { if(!(input.files && input.files.length)) finish(null); }, 1500);
            input.addEventListener('change', () => finish(input.files && input.files[0] || null));
            input.addEventListener('cancel', () => finish(null));
            window.addEventListener('focus', onFocus);
            (document.body || document.documentElement).appendChild(input);
            input.click();
        });
    }
    /** pickFile() + load(): Promise<data | null> (null = cancelled). */
    function pickAndLoad(opts = {}){
        return pickFile(opts).then(file => file ? load(file, opts) : null);
    }

    const API = {
        EXTENSION, VERSION,
        Error: MALEncryptionError,
        encode, decode, verify, info, isMalengine,
        save, download, fileName, readFile, load, pickFile, pickAndLoad,
        toBase64, fromBase64,
        // the building blocks (the unit tests check them against published test vectors)
        sha256, hmacSha256, chacha20, compress, decompress, Sha256,
        utf8: { encode: utf8Encode, decode: utf8Decode },
    };
    root.MALEncryptionError = MALEncryptionError;
    root.MALEngine_Encryption = API;
    root.MALCrypt = API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
