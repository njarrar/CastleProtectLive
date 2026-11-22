//! Byte grid terrain with copy on write tiles. One byte per cell, the value
//! is a terrain material code. y = 0 is the top of the map, y grows down.

use std::sync::Arc;

pub const TILE: i32 = 64;
pub const CHUNK: i32 = 256;

pub const AIR: u8 = 0;

/// Material flags looked up by code. Filled from content at battle start.
#[derive(Clone, Debug)]
pub struct MatTable {
    pub solid: [bool; 256],
    pub loose: [bool; 256],
    pub liquid: [bool; 256],
    pub carve_pct: [i32; 256],
    pub heavy_carve_pct: [i32; 256],
    pub bore_pct: [i32; 256],
}

#[derive(Clone, Debug)]
pub struct Terrain {
    pub w: i32,
    pub h: i32,
    tw: i32,
    tiles: Vec<Arc<[u8; 4096]>>,
    /// Dirty 256 x 256 chunks since the last snapshot.
    pub dirty: Vec<bool>,
    pub mats: Arc<MatTable>,
}

impl Terrain {
    pub fn new(w: i32, h: i32, mats: MatTable) -> Self {
        let tw = (w + TILE - 1) / TILE;
        let th = (h + TILE - 1) / TILE;
        let blank: Arc<[u8; 4096]> = Arc::new([AIR; 4096]);
        let cw = (w + CHUNK - 1) / CHUNK;
        let ch = (h + CHUNK - 1) / CHUNK;
        Terrain {
            w,
            h,
            tw,
            tiles: vec![blank; (tw * th) as usize],
            dirty: vec![true; (cw * ch) as usize],
            mats: Arc::new(mats),
        }
    }

    pub fn chunks_wide(&self) -> i32 {
        (self.w + CHUNK - 1) / CHUNK
    }
    pub fn chunks_high(&self) -> i32 {
        (self.h + CHUNK - 1) / CHUNK
    }

    #[inline]
    pub fn get(&self, x: i32, y: i32) -> u8 {
        if x < 0 || x >= self.w || y >= self.h {
            return 255; // walls and floor outside the map read as bedrock-like
        }
        if y < 0 {
            return AIR;
        }
        let t = &self.tiles[((y / TILE) * self.tw + x / TILE) as usize];
        t[((y % TILE) * TILE + x % TILE) as usize]
    }

    #[inline]
    pub fn set(&mut self, x: i32, y: i32, v: u8) {
        if x < 0 || x >= self.w || y < 0 || y >= self.h {
            return;
        }
        let idx = ((y / TILE) * self.tw + x / TILE) as usize;
        let t = Arc::make_mut(&mut self.tiles[idx]);
        t[((y % TILE) * TILE + x % TILE) as usize] = v;
    }

    pub fn mark_dirty(&mut self, x0: i32, y0: i32, x1: i32, y1: i32) {
        let cw = self.chunks_wide();
        let ch = self.chunks_high();
        let cx0 = (x0.max(0) / CHUNK).min(cw - 1);
        let cx1 = (x1.max(0) / CHUNK).min(cw - 1);
        let cy0 = (y0.max(0) / CHUNK).min(ch - 1);
        let cy1 = (y1.max(0) / CHUNK).min(ch - 1);
        for cy in cy0..=cy1 {
            for cx in cx0..=cx1 {
                self.dirty[(cy * cw + cx) as usize] = true;
            }
        }
    }

    #[inline]
    pub fn solid(&self, x: i32, y: i32) -> bool {
        let v = self.get(x, y);
        v == 255 || self.mats.solid[v as usize]
    }

    /// Solid or liquid: a shell stops on it.
    #[inline]
    pub fn blocks_shell(&self, x: i32, y: i32) -> bool {
        let v = self.get(x, y);
        v == 255 || self.mats.solid[v as usize] || self.mats.liquid[v as usize]
    }

    /// First cell from the top in column x that is solid or liquid, or h.
    pub fn surface(&self, x: i32) -> i32 {
        let mut y = 0;
        while y < self.h && !self.blocks_shell(x, y) {
            y += 1;
        }
        y
    }

    /// First solid or liquid cell at or below y in column x.
    pub fn surface_below(&self, x: i32, y: i32) -> i32 {
        let mut y = y.max(0);
        while y < self.h && !self.blocks_shell(x, y) {
            y += 1;
        }
        y
    }

    /// Carve a disc. `carve_pct` scales the radius per material; heavy shots
    /// use the heavy share. Returns the number of cells changed.
    pub fn carve(&mut self, cx: i32, cy: i32, r: i32, heavy: bool) -> i64 {
        if r <= 0 {
            return 0;
        }
        let mut n = 0;
        let r2 = (r * r) as i64;
        for y in (cy - r).max(0)..=(cy + r).min(self.h - 1) {
            for x in (cx - r).max(0)..=(cx + r).min(self.w - 1) {
                let v = self.get(x, y);
                if v == AIR || self.mats.liquid[v as usize] {
                    continue;
                }
                let p = if heavy {
                    self.mats.heavy_carve_pct[v as usize]
                } else {
                    self.mats.carve_pct[v as usize]
                };
                if p <= 0 {
                    continue;
                }
                let rr = (r as i64 * p as i64) / 100;
                let dx = (x - cx) as i64;
                let dy = (y - cy) as i64;
                if dx * dx + dy * dy <= rr * rr && dx * dx + dy * dy <= r2 {
                    self.set(x, y, AIR);
                    n += 1;
                }
            }
        }
        if n > 0 {
            self.mark_dirty(cx - r, cy - r, cx + r, cy + r);
        }
        n
    }

    /// Stamp a disc of a material into air cells only.
    pub fn stamp(&mut self, cx: i32, cy: i32, r: i32, mat: u8) {
        for y in (cy - r).max(0)..=(cy + r).min(self.h - 1) {
            for x in (cx - r).max(0)..=(cx + r).min(self.w - 1) {
                let dx = x - cx;
                let dy = y - cy;
                if dx * dx + dy * dy <= r * r && self.get(x, y) == AIR {
                    self.set(x, y, mat);
                }
            }
        }
        self.mark_dirty(cx - r, cy - r, cx + r, cy + r);
    }

    /// Clear a rectangle to air (Shove Off, tunnels).
    pub fn clear_rect(&mut self, x0: i32, y0: i32, x1: i32, y1: i32) {
        for y in y0.max(0)..=y1.min(self.h - 1) {
            for x in x0.max(0)..=x1.min(self.w - 1) {
                let v = self.get(x, y);
                if v != AIR && self.mats.solid[v as usize] && self.mats.bore_pct[v as usize] > 0 {
                    self.set(x, y, AIR);
                }
            }
        }
        self.mark_dirty(x0, y0, x1, y1);
    }

    /// Loose ground falls straight down in each column of the range until it
    /// rests on something solid. `blocked(x, y)` adds castle blocks as floors.
    pub fn settle<F: Fn(i32, i32) -> bool>(&mut self, x0: i32, x1: i32, blocked: F) {
        let x0 = x0.max(0);
        let x1 = x1.min(self.w - 1);
        for x in x0..=x1 {
            let mut floor = self.h - 1; // next free landing row
            let mut moved = false;
            let mut top = self.h;
            let mut y = self.h - 1;
            while y >= 0 {
                let v = self.get(x, y);
                if v == AIR {
                    if blocked(x, y) {
                        floor = y - 1;
                    }
                } else if self.mats.loose[v as usize] {
                    if floor > y {
                        self.set(x, floor, v);
                        self.set(x, y, AIR);
                        moved = true;
                        top = top.min(y);
                    }
                    floor -= 1;
                } else {
                    floor = y - 1;
                }
                y -= 1;
            }
            if moved {
                self.mark_dirty(x, top, x, self.h - 1);
            }
        }
    }

    /// Bytes of one 256 x 256 chunk, row major, cut at the map edge.
    pub fn chunk_bytes(&self, cx: i32, cy: i32) -> (i32, i32, Vec<u8>) {
        let x0 = cx * CHUNK;
        let y0 = cy * CHUNK;
        let w = (self.w - x0).min(CHUNK);
        let h = (self.h - y0).min(CHUNK);
        let mut out = Vec::with_capacity((w * h) as usize);
        for y in y0..y0 + h {
            for x in x0..x0 + w {
                out.push(self.get(x, y));
            }
        }
        (w, h, out)
    }

    pub fn hash_into(&self, hs: &mut crate::hash::StateHasher) {
        hs.i32(self.w);
        hs.i32(self.h);
        for t in &self.tiles {
            hs.bytes(&t[..]);
        }
    }
}
