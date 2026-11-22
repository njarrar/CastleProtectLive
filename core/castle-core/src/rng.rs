//! sfc32 random numbers with named streams. Every stream is seeded from the
//! battle seed and its name, so adding a stream never shifts another.

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sfc32 {
    a: u32,
    b: u32,
    c: u32,
    d: u32,
}

fn splitmix(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

pub fn name_hash(name: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in name.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x0100_0000_01b3);
    }
    h
}

impl Sfc32 {
    pub fn new(seed: u64, stream: &str) -> Self {
        let mut s = seed ^ name_hash(stream);
        let x = splitmix(&mut s);
        let y = splitmix(&mut s);
        let mut r = Sfc32 {
            a: x as u32,
            b: (x >> 32) as u32,
            c: y as u32,
            d: 1,
        };
        for _ in 0..12 {
            r.next_u32();
        }
        r
    }

    pub fn next_u32(&mut self) -> u32 {
        let t = self.a.wrapping_add(self.b).wrapping_add(self.d);
        self.d = self.d.wrapping_add(1);
        self.a = self.b ^ (self.b >> 9);
        self.b = self.c.wrapping_add(self.c << 3);
        self.c = self.c.rotate_left(21);
        self.c = self.c.wrapping_add(t);
        t
    }

    /// Uniform in lo..=hi.
    pub fn range(&mut self, lo: i32, hi: i32) -> i32 {
        if hi <= lo {
            return lo;
        }
        let span = (hi as i64 - lo as i64 + 1) as u64;
        (lo as i64 + (self.next_u32() as u64 % span) as i64) as i32
    }

    /// Standard normal in Q16.16 (Irwin-Hall with 12 draws).
    pub fn normal_q16(&mut self) -> i64 {
        let mut s: i64 = 0;
        for _ in 0..12 {
            s += (self.next_u32() >> 16) as i64;
        }
        s - 6 * 65536
    }

    pub fn state(&self) -> [u32; 4] {
        [self.a, self.b, self.c, self.d]
    }
}

/// The named streams of one battle.
#[derive(Clone, Debug)]
pub struct Streams {
    pub battle: Sfc32,
    pub hazard: Sfc32,
    pub ai: [Sfc32; 2],
}

impl Streams {
    pub fn new(seed: u64) -> Self {
        Streams {
            battle: Sfc32::new(seed, "battle"),
            hazard: Sfc32::new(seed, "hazard"),
            ai: [Sfc32::new(seed, "ai.0"), Sfc32::new(seed, "ai.1")],
        }
    }
}
