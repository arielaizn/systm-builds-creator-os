import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_DIR = path.resolve(here, '..', '..', 'schemas');

const cache = new Map();
export function loadSchema(name) {
  if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8')));
  return cache.get(name);
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const isType = (v, t) => (t === 'number' ? typeof v === 'number' : typeOf(v) === t);

// Small JSON Schema subset: type, enum, const, required, properties, additionalProperties,
// items, min/maxItems, min/maxLength, minimum/maximum, pattern, oneOf, anyOf, $ref (#/definitions/x).
export function validate(schema, data, root = schema, at = '') {
  const errors = [];
  const err = (msg) => errors.push({ path: at || '/', msg });
  if (schema.$ref) {
    const key = schema.$ref.replace('#/definitions/', '');
    return validate(root.definitions[key], data, root, at);
  }
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(data)) err(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(data)) err(`must be one of ${schema.enum.join('|')}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => isType(data, t))) { err(`must be ${types.join('|')}, got ${typeOf(data)}`); return errors; }
  }
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.trim().length < schema.minLength) err(`too short (min ${schema.minLength})`);
    if (schema.maxLength !== undefined && data.length > schema.maxLength) err(`too long (max ${schema.maxLength})`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(data)) err(`must match ${schema.pattern}`);
  }
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) err(`must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) err(`must be <= ${schema.maximum}`);
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) err(`needs at least ${schema.minItems} items, has ${data.length}`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems) err(`needs at most ${schema.maxItems} items, has ${data.length}`);
    if (schema.items) data.forEach((x, i) => errors.push(...validate(schema.items, x, root, `${at}/${i}`)));
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const k of schema.required ?? []) if (data[k] === undefined) errors.push({ path: `${at}/${k}`, msg: 'is required' });
    const props = schema.properties ?? {};
    for (const [k, sub] of Object.entries(props)) if (data[k] !== undefined) errors.push(...validate(sub, data[k], root, `${at}/${k}`));
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(data)) if (!(k in props)) errors.push({ path: `${at}/${k}`, msg: 'unknown field' });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const k of Object.keys(data)) if (!(k in props)) errors.push(...validate(schema.additionalProperties, data[k], root, `${at}/${k}`));
    }
  }
  if (schema.anyOf && !schema.anyOf.some((s) => validate(s, data, root, at).length === 0)) err('matches none of the allowed shapes');
  if (schema.oneOf && schema.oneOf.filter((s) => validate(s, data, root, at).length === 0).length !== 1) err('must match exactly one allowed shape');
  return errors;
}

export function check(name, data) {
  return validate(loadSchema(name), data);
}
