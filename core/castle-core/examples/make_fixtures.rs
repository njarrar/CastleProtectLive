//! Writes core/fixtures/ from `castle_core::fixtures::build()`.
//! Run: cargo run -p castle-core --example make_fixtures
fn main() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/");
    for (name, v) in castle_core::fixtures::build() {
        std::fs::write(
            format!("{dir}{name}"),
            serde_json::to_string_pretty(&v).unwrap() + "\n",
        )
        .unwrap();
        println!("wrote {name}");
    }
}
