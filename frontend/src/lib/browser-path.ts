function normalizeSlashes(input: string) {
  return input.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function normalize(input: string) {
  return normalizeSlashes(input);
}

export function join(...parts: string[]) {
  return normalizeSlashes(parts.filter(Boolean).join("/"));
}

export function resolve(...parts: string[]) {
  return normalize(join(...parts));
}

export function dirname(input: string) {
  const normalized = normalizeSlashes(input);
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : ".";
}

export function basename(input: string) {
  const normalized = normalizeSlashes(input);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

export function extname(input: string) {
  const base = basename(input);
  const index = base.lastIndexOf(".");
  return index >= 0 ? base.slice(index) : "";
}

export function isAbsolute(input: string) {
  return input.startsWith("/") || /^[A-Za-z]:\//.test(input);
}

export default {
  normalize,
  join,
  resolve,
  dirname,
  basename,
  extname,
  isAbsolute,
};
