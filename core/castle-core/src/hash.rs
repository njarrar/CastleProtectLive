//! State hash: FNV-1a 64 over canonical bytes fed in a fixed order.

#[derive(Clone, Debug)]
pub struct StateHasher(u64);

impl Default for StateHasher {
    fn default() -> Self {
        StateHasher(0xcbf2_9ce4_8422_2325)
    }
}

impl StateHasher {
    pub fn bytes(&mut self, b: &[u8]) {
        for x in b {
            self.0 ^= *x as u64;
            self.0 = self.0.wrapping_mul(0x0100_0000_01b3);
        }
    }
    pub fn i64(&mut self, v: i64) {
        self.bytes(&v.to_le_bytes());
    }
    pub fn i32(&mut self, v: i32) {
        self.bytes(&v.to_le_bytes());
    }
    pub fn u32(&mut self, v: u32) {
        self.bytes(&v.to_le_bytes());
    }
    pub fn str(&mut self, s: &str) {
        self.i64(s.len() as i64);
        self.bytes(s.as_bytes());
    }
    pub fn finish(&self) -> u64 {
        self.0
    }
}

pub fn hex(h: u64) -> String {
    format!("{:016x}", h)
}
