//! Determinism guards: no floats and no hash maps in the rules sources.

fn sources() -> Vec<(String, String)> {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/src");
    let mut out = vec![];
    for e in std::fs::read_dir(dir).unwrap() {
        let p = e.unwrap().path();
        if p.extension().is_some_and(|x| x == "rs") {
            out.push((
                p.display().to_string(),
                std::fs::read_to_string(&p).unwrap(),
            ));
        }
    }
    out
}

fn has_word(src: &str, word: &str) -> Option<usize> {
    for (n, line) in src.lines().enumerate() {
        let code = line.split("//").next().unwrap_or("");
        let b = code.as_bytes();
        let mut i = 0;
        while let Some(pos) = code[i..].find(word) {
            let s = i + pos;
            let e = s + word.len();
            let before = s == 0 || !(b[s - 1].is_ascii_alphanumeric() || b[s - 1] == b'_');
            let after = e >= b.len() || !(b[e].is_ascii_alphanumeric() || b[e] == b'_');
            if before && after {
                return Some(n + 1);
            }
            i = e;
        }
    }
    None
}

#[test]
fn no_floats_in_rules() {
    for (path, src) in sources() {
        for w in ["f32", "f64"] {
            assert!(
                has_word(&src, w).is_none(),
                "{w} in {path} line {:?}",
                has_word(&src, w)
            );
        }
    }
}

#[test]
fn no_hash_maps_in_rules() {
    for (path, src) in sources() {
        for w in ["HashMap", "HashSet"] {
            assert!(has_word(&src, w).is_none(), "{w} in {path}");
        }
    }
}

/// Code of a line with comments and string literals blanked.
fn code_only(line: &str) -> String {
    let mut out = String::new();
    let mut in_str = false;
    let mut prev = ' ';
    let chars: Vec<char> = line.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if !in_str && c == '/' && chars.get(i + 1) == Some(&'/') {
            break;
        }
        if c == '"' && prev != '\\' {
            in_str = !in_str;
            out.push(' ');
        } else {
            out.push(if in_str { ' ' } else { c });
        }
        prev = c;
        i += 1;
    }
    out
}

#[test]
fn no_float_literals_or_casts_in_rules() {
    // A bare literal such as `0.5` or a call such as `as_f64` slips past the
    // word check; look for digit '.' digit outside strings and comments.
    for (path, src) in sources() {
        for (n, line) in src.lines().enumerate() {
            let code = code_only(line);
            let b = code.as_bytes();
            for i in 1..b.len().saturating_sub(1) {
                let float_lit = b[i] == b'.'
                    && b[i - 1].is_ascii_digit()
                    && b[i + 1].is_ascii_digit()
                    && (i < 2 || b[i - 2] != b'.');
                assert!(!float_lit, "float literal in {path} line {}", n + 1);
            }
            assert!(!code.contains("as_f64"), "as_f64 in {path} line {}", n + 1);
        }
    }
}
