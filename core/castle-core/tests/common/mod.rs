//! A small JSON Schema checker for the subset our schemas use: type, enum,
//! const, required, properties, additionalProperties: false, items,
//! prefixItems, minItems, maxItems, minLength, maxLength, minimum, maximum,
//! oneOf and local $ref.
#![allow(dead_code)]

use serde_json::Value;

pub fn validate(schema: &Value, v: &Value) -> Vec<String> {
    let mut errs = vec![];
    check(schema, schema, v, "$", &mut errs);
    errs
}

fn type_ok(t: &str, v: &Value) -> bool {
    match t {
        "object" => v.is_object(),
        "array" => v.is_array(),
        "string" => v.is_string(),
        "integer" => v.is_i64() || v.is_u64(),
        "number" => v.is_number(),
        "boolean" => v.is_boolean(),
        "null" => v.is_null(),
        _ => false,
    }
}

fn check(root: &Value, s: &Value, v: &Value, path: &str, errs: &mut Vec<String>) {
    if let Some(r) = s.get("$ref").and_then(|r| r.as_str()) {
        let mut target = root;
        for part in r.trim_start_matches("#/").split('/') {
            target = &target[part];
        }
        return check(root, target, v, path, errs);
    }
    if let Some(t) = s.get("type") {
        let ok = match t {
            Value::String(t) => type_ok(t, v),
            Value::Array(ts) => ts.iter().any(|t| t.as_str().is_some_and(|t| type_ok(t, v))),
            _ => true,
        };
        if !ok {
            errs.push(format!("{path}: expected type {t}, got {v}"));
            return;
        }
    }
    if let Some(e) = s.get("enum").and_then(|e| e.as_array()) {
        if !e.contains(v) {
            errs.push(format!("{path}: {v} not in {}", Value::Array(e.clone())));
        }
    }
    if let Some(c) = s.get("const") {
        if c != v {
            errs.push(format!("{path}: expected {c}"));
        }
    }
    if let Some(one) = s.get("oneOf").and_then(|o| o.as_array()) {
        let n = one
            .iter()
            .filter(|sub| validate_sub(root, sub, v, path))
            .count();
        if n != 1 {
            errs.push(format!("{path}: matches {n} of oneOf"));
        }
    }
    if let Some(m) = s.get("minimum").and_then(|m| m.as_i64()) {
        if v.as_i64().is_some_and(|x| x < m) {
            errs.push(format!("{path}: below {m}"));
        }
    }
    if let Some(m) = s.get("maximum").and_then(|m| m.as_i64()) {
        if v.as_i64().is_some_and(|x| x > m) {
            errs.push(format!("{path}: above {m}"));
        }
    }
    if let Some(sv) = v.as_str() {
        let n = sv.chars().count() as i64;
        if s.get("minLength")
            .and_then(|m| m.as_i64())
            .is_some_and(|m| n < m)
            || s.get("maxLength")
                .and_then(|m| m.as_i64())
                .is_some_and(|m| n > m)
        {
            errs.push(format!("{path}: string length {n}"));
        }
    }
    if let Some(o) = v.as_object() {
        if let Some(req) = s.get("required").and_then(|r| r.as_array()) {
            for k in req {
                if let Some(k) = k.as_str() {
                    if !o.contains_key(k) {
                        errs.push(format!("{path}: missing {k}"));
                    }
                }
            }
        }
        let props = s.get("properties").and_then(|p| p.as_object());
        for (k, val) in o {
            match props.and_then(|p| p.get(k)) {
                Some(ps) => check(root, ps, val, &format!("{path}.{k}"), errs),
                None => {
                    if s.get("additionalProperties") == Some(&Value::Bool(false)) {
                        errs.push(format!("{path}: unknown key {k}"));
                    }
                }
            }
        }
    }
    if let Some(a) = v.as_array() {
        let n = a.len() as i64;
        if s.get("minItems")
            .and_then(|m| m.as_i64())
            .is_some_and(|m| n < m)
            || s.get("maxItems")
                .and_then(|m| m.as_i64())
                .is_some_and(|m| n > m)
        {
            errs.push(format!("{path}: {n} items"));
        }
        let prefix = s.get("prefixItems").and_then(|p| p.as_array());
        for (i, item) in a.iter().enumerate() {
            if let Some(ps) = prefix.and_then(|p| p.get(i)) {
                check(root, ps, item, &format!("{path}[{i}]"), errs);
            } else if let Some(is) = s.get("items") {
                check(root, is, item, &format!("{path}[{i}]"), errs);
            }
        }
    }
}

fn validate_sub(root: &Value, s: &Value, v: &Value, path: &str) -> bool {
    let mut e = vec![];
    check(root, s, v, path, &mut e);
    e.is_empty()
}

pub fn repo() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

pub fn read(p: &std::path::Path) -> Value {
    let s = std::fs::read_to_string(p).unwrap_or_else(|e| panic!("{}: {e}", p.display()));
    serde_json::from_str(&s).unwrap_or_else(|e| panic!("{}: {e}", p.display()))
}
