// Writes include/castle_core.h from the extern "C" functions in src/lib.rs.
// A failure here only warns, so cross builds never break on the header.
fn main() {
    println!("cargo:rerun-if-changed=src/lib.rs");
    println!("cargo:rerun-if-changed=cbindgen.toml");
    let dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into());
    let config = cbindgen::Config::from_file(format!("{dir}/cbindgen.toml")).unwrap_or_default();
    match cbindgen::Builder::new()
        .with_crate(&dir)
        .with_config(config)
        .generate()
    {
        Ok(b) => {
            b.write_to_file(format!("{dir}/include/castle_core.h"));
        }
        Err(e) => println!("cargo:warning=cbindgen could not write the header: {e}"),
    }
}
