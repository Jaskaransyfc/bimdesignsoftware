export function readFileSync() {
  throw new Error("fs.readFileSync is not available in the browser bundle");
}

export function writeFileSync() {
  throw new Error("fs.writeFileSync is not available in the browser bundle");
}

export function existsSync() {
  return false;
}

export function statSync() {
  throw new Error("fs.statSync is not available in the browser bundle");
}

export function readdirSync() {
  return [];
}

export function mkdirSync() {
  return undefined;
}

export function rmSync() {
  return undefined;
}

export default {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
  mkdirSync,
  rmSync,
};
