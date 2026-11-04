// ============================================================
// yaml.js
// ------------------------------------------------------------
// A small, dependency-free YAML reader for the engine's data
// files (todo lists, etc.). It works straight from file:// with
// no network access.
//
//   Yaml.parse(text)            -> plain JS value (object/array/scalar)
//   Yaml.patch(text, edits)     -> text with `key: value` lines changed
//                                  in place (comments/layout survive)
//
// Supported YAML subset:
//   - block mappings and block sequences (spaces only, no tabs)
//   - "- key: value" sequence-of-mappings
//   - plain, "double" and 'single' quoted scalars
//   - null (~ / null / empty), true / false, integers, floats
//   - inline flow lists/maps on ONE line:  [a, b]   {x: 1, y: 2}
//   - block scalars:  |  (literal)   >  (folded)   with - / + chomping
//   - # comments, --- document start
// Not supported: anchors/aliases, tags, multi-document files,
// multi-line flow collections, complex (non-scalar) keys.
//
// Every parsed mapping carries a hidden (non-enumerable) __meta
// property recording where its keys live in the source text, which
// is what lets Yaml.patch() edit values without rewriting the file.
// ============================================================

const Yaml = (function () {
    class YamlError extends Error {
        constructor(msg, lineNo) {
            super(lineNo !== undefined ? `YAML line ${lineNo + 1}: ${msg}` : `YAML: ${msg}`);
            this.name = "YamlError";
            this.line = lineNo;
        }
    }

    // ---------- low-level text helpers ----------

    /** Removes a trailing "# comment", ignoring '#' inside quotes. */
    function stripComment(s) {
        let inS = false, inD = false;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (inD) {
                if (c === "\\") i++;
                else if (c === '"') inD = false;
                continue;
            }
            if (inS) {
                if (c === "'") {
                    if (s[i + 1] === "'") i++;
                    else inS = false;
                }
                continue;
            }
            // A quote only OPENS a quoted scalar at the start of a value
            // token, so apostrophes inside plain text ("don't") are safe.
            if (c === '"' || c === "'") {
                let j = i - 1;
                while (j >= 0 && (s[j] === " ")) j--;
                if (j < 0 || ":-,[{".includes(s[j])) {
                    if (c === '"') inD = true; else inS = true;
                }
                continue;
            }
            if (c === "#" && (i === 0 || s[i - 1] === " ")) return s.slice(0, i);
        }
        return s;
    }

    /** Index of the ':' that separates a mapping key from its value, or -1. */
    function findKeyColon(c) {
        if (!c) return -1;
        if (c[0] === "[" || c[0] === "{") return -1;     // a flow collection, not a key
        let i = 0;
        if (c[0] === '"' || c[0] === "'") {
            const q = c[0];
            i = 1;
            while (i < c.length) {
                if (q === '"' && c[i] === "\\") { i += 2; continue; }
                if (c[i] === q) {
                    if (q === "'" && c[i + 1] === "'") { i += 2; continue; }
                    break;
                }
                i++;
            }
            i++;                                          // past the closing quote
            while (c[i] === " ") i++;
            return (c[i] === ":" && (i + 1 >= c.length || c[i + 1] === " ")) ? i : -1;
        }
        for (; i < c.length; i++) {
            if (c[i] === ":" && (i + 1 >= c.length || c[i + 1] === " ")) return i;
        }
        return -1;
    }

    const isDash = (c) => c === "-" || c.startsWith("- ");

    // ---------- scalars ----------

    function parseDouble(s, lineNo) {
        let out = "";
        for (let i = 1; i < s.length; i++) {
            const c = s[i];
            if (c === '"') {
                if (s.slice(i + 1).trim() !== "") throw new YamlError("unexpected text after closing quote", lineNo);
                return out;
            }
            if (c === "\\") {
                const n = s[++i];
                switch (n) {
                    case "n": out += "\n"; break;
                    case "t": out += "\t"; break;
                    case "r": out += "\r"; break;
                    case "0": out += "\0"; break;
                    case "u": out += String.fromCharCode(parseInt(s.substr(i + 1, 4), 16)); i += 4; break;
                    default: out += n;                    // \" \\ \/ and anything else literal
                }
            } else out += c;
        }
        throw new YamlError("unterminated double-quoted string", lineNo);
    }

    function parseSingle(s, lineNo) {
        let out = "";
        for (let i = 1; i < s.length; i++) {
            const c = s[i];
            if (c === "'") {
                if (s[i + 1] === "'") { out += "'"; i++; continue; }
                if (s.slice(i + 1).trim() !== "") throw new YamlError("unexpected text after closing quote", lineNo);
                return out;
            }
            out += c;
        }
        throw new YamlError("unterminated single-quoted string", lineNo);
    }

    function plainScalar(s) {
        if (s === "" || s === "~" || /^(null|Null|NULL)$/.test(s)) return null;
        if (/^(true|True|TRUE)$/.test(s)) return true;
        if (/^(false|False|FALSE)$/.test(s)) return false;
        if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
        return s;
    }

    // ---------- inline flow collections ----------

    function parseFlow(s, lineNo) {
        let i = 0;
        const ws = () => { while (i < s.length && s[i] === " ") i++; };

        function readQuoted() {
            const q = s[i];
            let j = i + 1;
            while (j < s.length) {
                if (q === '"' && s[j] === "\\") { j += 2; continue; }
                if (s[j] === q) {
                    if (q === "'" && s[j + 1] === "'") { j += 2; continue; }
                    break;
                }
                j++;
            }
            if (j >= s.length) throw new YamlError("unterminated string in flow collection", lineNo);
            const tok = s.slice(i, j + 1);
            i = j + 1;
            return q === '"' ? parseDouble(tok, lineNo) : parseSingle(tok, lineNo);
        }

        function readValue(stops) {
            ws();
            if (s[i] === "[") return readSeq();
            if (s[i] === "{") return readMap();
            if (s[i] === '"' || s[i] === "'") return readQuoted();
            let j = i;
            while (j < s.length && !stops.includes(s[j])) j++;
            const tok = s.slice(i, j).trim();
            i = j;
            return plainScalar(tok);
        }

        function readSeq() {
            i++;                                          // [
            const arr = [];
            ws();
            if (s[i] === "]") { i++; return arr; }
            for (;;) {
                arr.push(readValue(",]"));
                ws();
                if (s[i] === ",") { i++; ws(); if (s[i] === "]") { i++; return arr; } continue; }
                if (s[i] === "]") { i++; return arr; }
                throw new YamlError("expected ',' or ']' in flow list", lineNo);
            }
        }

        function readMap() {
            i++;                                          // {
            const obj = {};
            ws();
            if (s[i] === "}") { i++; return obj; }
            for (;;) {
                ws();
                let key;
                if (s[i] === '"' || s[i] === "'") key = readQuoted();
                else {
                    let j = i;
                    while (j < s.length && s[j] !== ":" && s[j] !== "," && s[j] !== "}") j++;
                    key = s.slice(i, j).trim();
                    i = j;
                }
                ws();
                if (s[i] !== ":") throw new YamlError("expected ':' in flow map", lineNo);
                i++;
                obj[key] = readValue(",}");
                ws();
                if (s[i] === ",") { i++; continue; }
                if (s[i] === "}") { i++; return obj; }
                throw new YamlError("expected ',' or '}' in flow map", lineNo);
            }
        }

        const v = readValue("");
        ws();
        if (i < s.length) throw new YamlError("unexpected text after flow collection", lineNo);
        return v;
    }

    function parseScalar(s, lineNo) {
        s = s.trim();
        if (s[0] === '"') return parseDouble(s, lineNo);
        if (s[0] === "'") return parseSingle(s, lineNo);
        if (s[0] === "[" || s[0] === "{") return parseFlow(s, lineNo);
        return plainScalar(s);
    }

    // ---------- document parser ----------

    function parse(text) {
        const src = String(text).replace(/^\uFEFF/, "").split(/\r?\n/);
        const L = src.map((raw, no) => {
            const lead = raw.match(/^ */)[0].length;
            if (raw[lead] === "\t") throw new YamlError("tabs can't be used for indentation", no);
            const content = stripComment(raw.slice(lead)).trimEnd();
            return { no, raw, indent: lead, content, blank: content === "" };
        });

        let pos = 0;
        let lastNo = -1;                                  // last source line holding real content
        const skipBlank = () => { while (pos < L.length && L[pos].blank) pos++; };
        const take = () => { const l = L[pos++]; lastNo = l.no; return l; };

        // "---" starts the document; "..." ends it.
        skipBlank();
        if (pos < L.length && L[pos].content === "---") pos++;
        let end = L.length;
        for (let i = pos; i < L.length; i++) if (L[i].content === "...") { end = i; break; }
        L.length = end;

        function parseNode(indent) {
            skipBlank();
            if (pos >= L.length || L[pos].indent < indent) return null;
            const line = L[pos];
            if (isDash(line.content)) return parseSeq(line.indent);
            if (findKeyColon(line.content) >= 0) return parseMap(line.indent);
            take();
            return parseScalar(line.content, line.no);
        }

        function parseBlockScalar(parentIndent, header) {
            const folded = header[0] === ">";
            const chomp = header[1] || "";
            const body = [];
            let blockIndent = -1;
            while (pos < L.length) {
                const l = L[pos];
                const isEmpty = l.raw.trim() === "";
                if (!isEmpty && l.indent <= parentIndent) break;
                if (!isEmpty && blockIndent < 0) blockIndent = l.indent;
                body.push(isEmpty ? "" : l.raw.slice(Math.min(blockIndent, l.indent)));
                if (!isEmpty) lastNo = l.no;
                pos++;
            }
            while (body.length && body[body.length - 1] === "" && chomp !== "+") body.pop();
            let out;
            if (folded) {
                const paras = [];
                let cur = [];
                for (const ln of body) {
                    if (ln === "") { paras.push(cur.join(" ")); cur = []; } else cur.push(ln);
                }
                paras.push(cur.join(" "));
                out = paras.join("\n");
            } else out = body.join("\n");
            if (chomp === "-" || body.length === 0) return out;
            return out + "\n";
        }

        function parseMap(indent) {
            const obj = {};
            const meta = { indent, keyLines: {}, insertAt: -1 };
            let first = true;
            for (;;) {
                skipBlank();
                if (pos >= L.length) break;
                const line = L[pos];
                if (line.indent > indent) throw new YamlError("unexpected indentation", line.no);
                if (line.indent < indent || isDash(line.content)) break;

                const ci = findKeyColon(line.content);
                if (ci < 0) throw new YamlError('expected "key: value"', line.no);
                const rawKey = line.content.slice(0, ci).trim();
                const key = (rawKey[0] === '"' || rawKey[0] === "'") ? parseScalar(rawKey, line.no) : rawKey;
                const rest = line.content.slice(ci + 1).trim();
                meta.keyLines[key] = line.no;
                take();

                let value;
                if (rest === "") {
                    skipBlank();
                    if (pos < L.length && L[pos].indent > indent) value = parseNode(L[pos].indent);
                    else if (pos < L.length && L[pos].indent === indent && isDash(L[pos].content)) value = parseSeq(indent);
                    else value = null;
                } else if (/^[|>][+-]?$/.test(rest)) {
                    value = parseBlockScalar(indent, rest);
                } else {
                    value = parseScalar(rest, line.no);
                }
                obj[key] = value;
                if (first) { meta.insertAt = lastNo + 1; first = false; }
            }
            Object.defineProperty(obj, "__meta", { value: meta, enumerable: false });
            return obj;
        }

        function parseSeq(indent) {
            const arr = [];
            for (;;) {
                skipBlank();
                if (pos >= L.length) break;
                const line = L[pos];
                if (line.indent !== indent || !isDash(line.content)) {
                    if (line.indent > indent) throw new YamlError("unexpected indentation", line.no);
                    break;
                }
                const rest = line.content.slice(1).trimStart();
                const offset = line.content.length - rest.length;

                if (rest === "") {
                    take();
                    skipBlank();
                    arr.push(pos < L.length && L[pos].indent > indent ? parseNode(L[pos].indent) : null);
                } else if (isDash(rest)) {
                    line.indent = indent + offset; line.content = rest;
                    arr.push(parseSeq(line.indent));
                } else if (findKeyColon(rest) >= 0) {
                    // "- key: value" -> the mapping's keys line up after the dash
                    line.indent = indent + offset; line.content = rest;
                    arr.push(parseMap(line.indent));
                } else if (/^[|>][+-]?$/.test(rest)) {
                    take();
                    arr.push(parseBlockScalar(indent, rest));
                } else {
                    take();
                    arr.push(parseScalar(rest, line.no));
                }
            }
            return arr;
        }

        skipBlank();
        if (pos >= L.length) return null;
        const result = parseNode(L[pos].indent);
        skipBlank();
        if (pos < L.length) throw new YamlError("unexpected content", L[pos].no);
        return result;
    }

    // ---------- in-place patching ----------

    /**
     * Applies value changes to the ORIGINAL text so comments, ordering
     * and formatting survive. Each edit is { target, key, value } where
     * `target` is a mapping object returned by Yaml.parse(text) of that
     * same text. If `key` already exists its value is replaced on its
     * line; otherwise a `key: value` line is inserted into the mapping.
     * Returns the new text (or the same text if nothing applied).
     */
    function patch(text, edits) {
        const eol = text.includes("\r\n") ? "\r\n" : "\n";
        const lines = text.split(/\r?\n/);
        const work = [];

        for (const e of edits || []) {
            const meta = e && e.target && e.target.__meta;
            if (!meta) continue;
            const sv = typeof e.value === "string" ? JSON.stringify(e.value) : String(e.value);
            if (Object.prototype.hasOwnProperty.call(meta.keyLines, e.key)) {
                work.push({ at: meta.keyLines[e.key], replace: true, key: e.key, sv });
            } else if (meta.insertAt >= 0) {
                work.push({ at: meta.insertAt - 0.5, replace: false, indent: meta.indent, key: e.key, sv });
            }
        }

        work.sort((a, b) => b.at - a.at);                 // bottom-up keeps indexes valid
        for (const w of work) {
            if (w.replace) {
                const esc = w.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const re = new RegExp(`^(\\s*(?:-\\s+)?["']?${esc}["']?\\s*:\\s*)([^#\\s](?:[^#]*[^#\\s])?)?(\\s*(?:#.*)?)$`);
                const m = lines[w.at].match(re);
                if (m) lines[w.at] = m[1] + w.sv + (m[3] ? (m[2] ? m[3] : " " + m[3].trimStart()) : "");
            } else {
                lines.splice(Math.ceil(w.at), 0, " ".repeat(w.indent) + w.key + ": " + w.sv);
            }
        }
        return lines.join(eol);
    }

    return { parse, patch, YamlError };
})();
