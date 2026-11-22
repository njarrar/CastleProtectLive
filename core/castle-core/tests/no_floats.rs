//! Determinism guards: no floats and no hash maps in the rules sources.

fn sources() -> Vec<(String, String)> {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/src");
    let mut out = vec![];
    for e in std::fs::read_dir(dir).unwrap() {
        let p = e.unwrap().path();
        if p.extension().is_some_and(|x| x == "rs") {
            out.push((p.display().to_string(), std::fs::read_to_string(&p).unwrap()));
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
            assert!(has_word(&src, w).is_none(), "{w} in {path} line {:?}", has_word(&src, w));
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
