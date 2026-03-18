export type KvValue = string | KvObject;
export interface KvObject {
  [key: string]: KvValue;
}

const stripComments = (text: string) =>
  text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const tokenize = (input: string) => {
  const tokens: string[] = [];
  const text = stripComments(input);
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === "{" || char === "}") {
      tokens.push(char);
      i += 1;
      continue;
    }

    if (char === '"') {
      let value = "";
      i += 1;
      while (i < text.length) {
        const current = text[i];
        if (current === "\\" && i + 1 < text.length) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (current === '"') {
          i += 1;
          break;
        }
        value += current;
        i += 1;
      }
      tokens.push(value);
      continue;
    }

    let raw = "";
    while (i < text.length && !/\s/.test(text[i]) && text[i] !== "{" && text[i] !== "}") {
      raw += text[i];
      i += 1;
    }

    if (raw.length > 0) {
      tokens.push(raw);
    }
  }

  return tokens;
};

const parseObject = (tokens: string[], index: { value: number }) => {
  const obj: KvObject = {};

  while (index.value < tokens.length) {
    const token = tokens[index.value];

    if (token === "}") {
      index.value += 1;
      break;
    }

    const key = token;
    index.value += 1;

    const next = tokens[index.value];

    if (next === "{") {
      index.value += 1;
      obj[key] = parseObject(tokens, index);
      continue;
    }

    if (next === undefined) {
      break;
    }

    obj[key] = next;
    index.value += 1;
  }

  return obj;
};

export const parseKeyValues = (text: string) => {
  const tokens = tokenize(text);
  const index = { value: 0 };

  if (tokens[index.value] === "{") {
    index.value += 1;
    return parseObject(tokens, index);
  }

  if (tokens.length >= 2 && tokens[1] === "{") {
    const key = tokens[0];
    index.value = 2;
    const value = parseObject(tokens, index);
    return { [key]: value };
  }

  return parseObject(tokens, index);
};

const stringifyObject = (obj: KvObject, indent: number): string => {
  const pad = "\t".repeat(indent);
  const innerPad = "\t".repeat(indent + 1);

  const lines = Object.entries(obj).map(([key, value]) => {
    if (typeof value === "string") {
      return `${innerPad}"${key}"\t\t"${value}"`;
    }

    return `${innerPad}"${key}"\n${stringifyObject(value, indent + 1)}`;
  });

  return `${pad}{\n${lines.join("\n")}\n${pad}}`;
};

export const stringifyKeyValues = (obj: KvObject) => {
  const keys = Object.keys(obj);
  if (keys.length === 1 && typeof obj[keys[0]] === "object") {
    const key = keys[0];
    return `"${key}"\n${stringifyObject(obj[key] as KvObject, 0)}`;
  }

  return stringifyObject(obj, 0);
};
