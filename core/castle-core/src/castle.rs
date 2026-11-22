//! Castle grids: blocks, rooms, the support solver and Lean Lines.
//! Grid column 0 is the back of the fort for side 0 (left), the front faces
//! the rival. Row 0 is the Footing. Blueprints are authored facing right and
//! mirrored for side 1.

use crate::content::{Blueprint, Content};

pub const BLOCK: i32 = 16;
pub const MAX_W: i32 = 8;
pub const MAX_H: i32 = 10;
pub const BUDGET: i32 = 72;
pub const KETTLE_HP: i32 = 300;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Slot {
    Empty,
    Block(Block),
    /// Part of a Nook (index into nooks).
    Nook(u8),
    Kettle,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Block {
    pub mat: u8,
    pub hp: i32,
    pub max: i32,
    pub peephole: bool,
    /// Boss weak spot (the Sprinkler Root).
    pub root: bool,
}

#[derive(Clone, Debug)]
pub struct Room {
    /// Bottom left grid slot.
    pub c: i32,
    pub r: i32,
    /// Loophole flap: rounds of the current front it stays shut; 0 open.
    pub flap: bool,
    /// Pot Lid over this room until the owner's next turn.
    pub lid: bool,
    /// Tick the Loophole was buried (for the newest burial rule).
    pub buried_tick: i64,
}

#[derive(Clone, Debug)]
pub struct Castle {
    pub side: u8,
    /// World x of the left edge, y of the bottom of the Footing.
    pub x: i32,
    pub base_y: i32,
    pub cols: i32,
    pub rows: i32,
    pub slots: Vec<Slot>,
    /// What each slot held at battle start (for rebuilds).
    pub original: Vec<Slot>,
    pub nooks: Vec<Room>,
    pub kettle: Room,
    pub kettle_hp: i32,
    pub steam: i32,
    pub steam_turn: i32,
    /// Fatigue (from round 10): damaged blocks reach one less to the side.
    pub fatigue: bool,
}

fn glyph_mat(content: &Content, g: char) -> Option<usize> {
    content
        .materials
        .blocks
        .iter()
        .position(|m| m.glyph.starts_with(g))
}

/// Parse a blueprint into slots (row 0 = bottom). Front faces right.
fn parse(
    content: &Content,
    bp: &Blueprint,
) -> Result<(i32, i32, Vec<Slot>, Vec<(i32, i32)>, (i32, i32)), String> {
    let rows = bp.rows.len() as i32;
    if rows == 0 {
        return Err("no rows".into());
    }
    let cols = bp.rows[0].chars().count() as i32;
    if bp.rows.iter().any(|r| r.chars().count() as i32 != cols) {
        return Err("rows differ in width".into());
    }
    if cols > MAX_W || rows > MAX_H || cols < 3 || rows < 3 {
        return Err(format!(
            "grid {}x{} outside 3x3 to {}x{}",
            cols, rows, MAX_W, MAX_H
        ));
    }
    let mut slots = vec![Slot::Empty; (cols * rows) as usize];
    let mut nook_cells: Vec<Vec<(i32, i32)>> = vec![vec![]; 5];
    let mut kettle_cells = vec![];
    for (i, line) in bp.rows.iter().enumerate() {
        let r = rows - 1 - i as i32;
        for (c, g) in line.chars().enumerate() {
            let c = c as i32;
            let idx = (r * cols + c) as usize;
            slots[idx] = match g {
                '.' => Slot::Empty,
                'K' => {
                    kettle_cells.push((c, r));
                    Slot::Kettle
                }
                '1'..='5' => {
                    let n = g as usize - '1' as usize;
                    nook_cells[n].push((c, r));
                    Slot::Nook(n as u8)
                }
                'r' => {
                    let m = glyph_mat(content, 't').ok_or("no timber")?;
                    let hp = content.materials.blocks[m].hp;
                    Slot::Block(Block {
                        mat: m as u8,
                        hp,
                        max: hp,
                        peephole: false,
                        root: true,
                    })
                }
                _ => {
                    let m = glyph_mat(content, g).ok_or(format!("unknown glyph {g}"))?;
                    let hp = content.materials.blocks[m].hp;
                    Slot::Block(Block {
                        mat: m as u8,
                        hp,
                        max: hp,
                        peephole: false,
                        root: false,
                    })
                }
            };
        }
    }
    let room = |cells: &Vec<(i32, i32)>, what: &str| -> Result<(i32, i32), String> {
        if cells.len() != 4 {
            return Err(format!("{what} must be 2 x 2"));
        }
        let c = cells.iter().map(|p| p.0).min().unwrap_or(0);
        let r = cells.iter().map(|p| p.1).min().unwrap_or(0);
        for (dc, dr) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
            if !cells.contains(&(c + dc, r + dr)) {
                return Err(format!("{what} must be 2 x 2"));
            }
        }
        Ok((c, r))
    };
    let k = room(&kettle_cells, "Kettle Room")?;
    let mut nooks = vec![];
    for (i, cells) in nook_cells.iter().enumerate() {
        if cells.is_empty() {
            continue;
        }
        if nooks.len() != i {
            return Err("Nook numbers must start at 1 with no gaps".into());
        }
        nooks.push(room(cells, "Nook")?);
    }
    Ok((cols, rows, slots, nooks, k))
}

fn is_block(slots: &[Slot], cols: i32, rows: i32, c: i32, r: i32) -> bool {
    c >= 0
        && r >= 0
        && c < cols
        && r < rows
        && matches!(slots[(r * cols + c) as usize], Slot::Block(_))
}

/// The Workshop validator. `seats` is how many Hobs must be seated.
pub fn validate_blueprint(content: &Content, bp: &Blueprint, seats: i32) -> Result<(), String> {
    let (cols, rows, slots, nooks, k) = parse(content, bp)?;
    let footing = content.materials.blocks.iter().position(|m| m.never_falls);
    for c in 0..cols {
        match &slots[c as usize] {
            Slot::Block(b) if Some(b.mat as usize) == footing => {}
            _ => return Err("row 0 must be full Footing".into()),
        }
    }
    for r in 1..rows {
        for c in 0..cols {
            if let Slot::Block(b) = &slots[(r * cols + c) as usize] {
                if Some(b.mat as usize) == footing {
                    return Err("Footing only in row 0".into());
                }
            }
        }
    }
    if k.0 < 1 || k.0 + 2 > cols - 1 || k.1 < 1 || k.1 + 2 > rows - 1 {
        return Err("Kettle Room must sit one block in from every outer face".into());
    }
    let walled = |c: i32, r: i32| -> bool {
        let mut ok = true;
        for d in 0..2 {
            ok &= is_block(&slots, cols, rows, c + d, r - 1);
            ok &= is_block(&slots, cols, rows, c + d, r + 2);
            ok &= is_block(&slots, cols, rows, c - 1, r + d);
            ok &= is_block(&slots, cols, rows, c + 2, r + d);
        }
        ok
    };
    if !walled(k.0, k.1) {
        return Err("Kettle Room must be walled".into());
    }
    for (i, n) in nooks.iter().enumerate() {
        if !walled(n.0, n.1) {
            return Err(format!("Nook {} must be walled on all four sides", i + 1));
        }
    }
    if (nooks.len() as i32) < seats {
        return Err(format!("{} Nooks for {} Hobs", nooks.len(), seats));
    }
    if nooks.len() > 5 {
        return Err("at most 5 Nooks".into());
    }
    let used = slots[cols as usize..]
        .iter()
        .filter(|s| !matches!(s, Slot::Empty))
        .count() as i32;
    if used > BUDGET {
        return Err(format!("Block Budget {} over {}", used, BUDGET));
    }
    Ok(())
}

impl Castle {
    pub fn from_blueprint(
        content: &Content,
        bp: &Blueprint,
        side: u8,
        steam: i32,
    ) -> Result<Castle, String> {
        let (cols, rows, mut slots, mut nooks, mut k) = parse(content, bp)?;
        if side == 1 {
            // mirror so the front faces left
            let mut m = slots.clone();
            for r in 0..rows {
                for c in 0..cols {
                    m[(r * cols + (cols - 1 - c)) as usize] =
                        slots[(r * cols + c) as usize].clone();
                }
            }
            slots = m;
            for n in nooks.iter_mut() {
                n.0 = cols - 2 - n.0;
            }
            k.0 = cols - 2 - k.0;
        }
        let room = |p: (i32, i32)| Room {
            c: p.0,
            r: p.1,
            flap: false,
            lid: false,
            buried_tick: -1,
        };
        Ok(Castle {
            side,
            x: 0,
            base_y: 0,
            cols,
            rows,
            original: slots.clone(),
            slots,
            nooks: nooks.into_iter().map(room).collect(),
            kettle: room(k),
            kettle_hp: KETTLE_HP,
            steam,
            steam_turn: 0,
            fatigue: false,
        })
    }

    #[inline]
    pub fn idx(&self, c: i32, r: i32) -> usize {
        (r * self.cols + c) as usize
    }

    pub fn in_grid(&self, c: i32, r: i32) -> bool {
        c >= 0 && r >= 0 && c < self.cols && r < self.rows
    }

    pub fn block(&self, c: i32, r: i32) -> Option<&Block> {
        if !self.in_grid(c, r) {
            return None;
        }
        match &self.slots[self.idx(c, r)] {
            Slot::Block(b) => Some(b),
            _ => None,
        }
    }

    pub fn block_mut(&mut self, c: i32, r: i32) -> Option<&mut Block> {
        if !self.in_grid(c, r) {
            return None;
        }
        let i = self.idx(c, r);
        match &mut self.slots[i] {
            Slot::Block(b) => Some(b),
            _ => None,
        }
    }

    pub fn has_block(&self, c: i32, r: i32) -> bool {
        self.block(c, r).is_some()
    }

    /// World box of a grid slot: (x0, y0, x1, y1), inclusive.
    pub fn slot_box(&self, c: i32, r: i32) -> (i32, i32, i32, i32) {
        let x0 = self.x + c * BLOCK;
        let y0 = self.base_y - (r + 1) * BLOCK;
        (x0, y0, x0 + BLOCK - 1, y0 + BLOCK - 1)
    }

    pub fn width_cells(&self) -> i32 {
        self.cols * BLOCK
    }

    pub fn top_y(&self) -> i32 {
        self.base_y - self.rows * BLOCK
    }

    /// Grid slot under a world cell.
    pub fn slot_at(&self, x: i32, y: i32) -> Option<(i32, i32)> {
        if x < self.x || x >= self.x + self.cols * BLOCK || y >= self.base_y || y < self.top_y() {
            return None;
        }
        Some(((x - self.x) / BLOCK, (self.base_y - 1 - y) / BLOCK))
    }

    /// Room box (2 x 2 slots) in world cells, inclusive.
    pub fn room_box(&self, room: &Room) -> (i32, i32, i32, i32) {
        let (x0, _, _, y1) = self.slot_box(room.c, room.r);
        let (_, y0, x1, _) = self.slot_box(room.c + 1, room.r + 1);
        (x0, y0, x1, y1)
    }

    /// +1 when the front faces right (side 0), -1 for side 1.
    pub fn front_dir(&self) -> i32 {
        if self.side == 0 {
            1
        } else {
            -1
        }
    }

    /// The four wall sides of a room: floor, ceiling, back, front (slots).
    pub fn room_walls(&self, room: &Room) -> [[(i32, i32); 2]; 4] {
        let (c, r) = (room.c, room.r);
        let left = [(c - 1, r), (c - 1, r + 1)];
        let right = [(c + 2, r), (c + 2, r + 1)];
        let (back, front) = if self.side == 0 {
            (left, right)
        } else {
            (right, left)
        };
        [
            [(c, r - 1), (c + 1, r - 1)],
            [(c, r + 2), (c + 1, r + 2)],
            back,
            front,
        ]
    }

    /// Intact: every block on all four sides stands. `excuse` skips one wall side
    /// index (Broad Back excuses the front wall of the Hob behind Grub).
    pub fn room_intact(&self, room: &Room, excuse_front: bool) -> bool {
        let walls = self.room_walls(room);
        for (i, side) in walls.iter().enumerate() {
            if i == 3 && excuse_front {
                continue;
            }
            for &(c, r) in side {
                if !self.has_block(c, r) {
                    return false;
                }
            }
        }
        true
    }

    /// Loophole rect in world cells: a slot 6 cells tall at chest height in the
    /// front wall of the Nook.
    pub fn loophole_rect(&self, room: &Room) -> (i32, i32, i32, i32) {
        let fc = if self.side == 0 {
            room.c + 2
        } else {
            room.c - 1
        };
        let (x0, _, x1, y1) = self.slot_box(fc, room.r);
        // floor of the nook is y1 of row r; chest is 14 to 20 cells above it
        (x0, y1 - 19, x1, y1 - 14)
    }

    /// Hob seat point: centre of the Nook floor.
    pub fn seat_point(&self, room: &Room) -> (i32, i32) {
        let (x0, _, x1, y1) = self.room_box(room);
        ((x0 + x1) / 2, y1)
    }

    pub fn kettle_box(&self) -> (i32, i32, i32, i32) {
        let (x0, _, x1, y1) = self.room_box(&self.kettle);
        let cx = (x0 + x1) / 2;
        (cx - 10, y1 - 19, cx + 10, y1)
    }

    /// Support solve. Returns per slot reach (None = unsupported). `held` lists
    /// slots that count as supported from below (Ridgepole).
    pub fn solve(&self, content: &Content, held: &[(i32, i32)]) -> Vec<Option<i32>> {
        let n = (self.cols * self.rows) as usize;
        let mut reach: Vec<Option<i32>> = vec![None; n];
        for c in 0..self.cols {
            if self.has_block(c, 0) {
                reach[self.idx(c, 0)] = Some(0);
            }
        }
        for &(c, r) in held {
            if self.has_block(c, r) {
                reach[self.idx(c, r)] = Some(0);
            }
        }
        let fatigue = self.fatigue;
        let limit = |b: &Block| {
            let base = content.materials.blocks[b.mat as usize].side_support;
            if fatigue && b.hp < b.max {
                (base - 1).max(0)
            } else {
                base
            }
        };
        let mut changed = true;
        let mut passes = 0;
        while changed && passes < 64 {
            changed = false;
            passes += 1;
            for r in 1..self.rows {
                for c in 0..self.cols {
                    let Some(b) = self.block(c, r) else { continue };
                    let i = self.idx(c, r);
                    let mut best = reach[i];
                    if let Some(v) = reach[self.idx(c, r - 1)] {
                        if self.has_block(c, r - 1) {
                            best = Some(best.map_or(v, |x| x.min(v)));
                        }
                    }
                    for dc in [-1, 1] {
                        let nc = c + dc;
                        if self.has_block(nc, r) {
                            if let Some(v) = reach[self.idx(nc, r)] {
                                if v < limit(b) {
                                    let nv = v + 1;
                                    best = Some(best.map_or(nv, |x| x.min(nv)));
                                }
                            }
                        }
                    }
                    if best != reach[i] {
                        reach[i] = best;
                        changed = true;
                    }
                }
            }
        }
        reach
    }

    /// Unsupported blocks grouped into chunks by 4 way flood fill in slot order.
    pub fn falling_chunks(&self, content: &Content, held: &[(i32, i32)]) -> Vec<Vec<(i32, i32)>> {
        let reach = self.solve(content, held);
        let mut seen = vec![false; reach.len()];
        let mut out = vec![];
        for r in 0..self.rows {
            for c in 0..self.cols {
                let i = self.idx(c, r);
                if seen[i] || !self.has_block(c, r) || reach[i].is_some() {
                    continue;
                }
                let mut chunk = vec![];
                let mut stack = vec![(c, r)];
                seen[i] = true;
                while let Some((cc, rr)) = stack.pop() {
                    chunk.push((cc, rr));
                    for (dc, dr) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                        let (nc, nr) = (cc + dc, rr + dr);
                        if self.has_block(nc, nr) {
                            let j = self.idx(nc, nr);
                            if !seen[j] && reach[j].is_none() {
                                seen[j] = true;
                                stack.push((nc, nr));
                            }
                        }
                    }
                }
                chunk.sort_by_key(|p| (p.1, p.0));
                out.push(chunk);
            }
        }
        out
    }

    /// Lean Lines: which blocks would fall if the block at (c, r) broke.
    pub fn lean_lines(
        &self,
        content: &Content,
        c: i32,
        r: i32,
        held: &[(i32, i32)],
    ) -> Vec<(i32, i32)> {
        if !self.has_block(c, r) {
            return vec![];
        }
        let mut copy = self.clone();
        let i = copy.idx(c, r);
        copy.slots[i] = Slot::Empty;
        let mut all: Vec<(i32, i32)> = copy
            .falling_chunks(content, held)
            .into_iter()
            .flatten()
            .collect();
        all.sort_by_key(|p| (p.1, p.0));
        all
    }

    /// Blocks hanging at the very end of their reach (Shimmer).
    pub fn shimmer(&self, content: &Content, held: &[(i32, i32)]) -> Vec<(i32, i32)> {
        let reach = self.solve(content, held);
        let mut out = vec![];
        for r in 1..self.rows {
            for c in 0..self.cols {
                if let (Some(b), Some(v)) = (self.block(c, r), reach[self.idx(c, r)]) {
                    let lim = content.materials.blocks[b.mat as usize].side_support
                        - if self.fatigue && b.hp < b.max { 1 } else { 0 };
                    if v > 0 && v == lim {
                        out.push((c, r));
                    }
                }
            }
        }
        out
    }

    pub fn standing_hp(&self, content: &Content) -> i64 {
        let _ = content;
        self.slots
            .iter()
            .map(|s| match s {
                Slot::Block(b) => b.hp as i64,
                _ => 0,
            })
            .sum()
    }

    pub fn hash_into(&self, hs: &mut crate::hash::StateHasher) {
        hs.i32(self.side as i32);
        hs.i32(self.x);
        hs.i32(self.base_y);
        hs.i32(self.kettle_hp);
        hs.i32(self.steam);
        hs.i32(self.steam_turn);
        hs.i32(self.fatigue as i32);
        for s in &self.slots {
            match s {
                Slot::Empty => hs.i32(-1),
                Slot::Kettle => hs.i32(-2),
                Slot::Nook(n) => hs.i32(-10 - *n as i32),
                Slot::Block(b) => {
                    hs.i32(b.mat as i32);
                    hs.i32(b.hp);
                    hs.i32(b.peephole as i32);
                }
            }
        }
        for n in &self.nooks {
            hs.i32(n.flap as i32);
            hs.i32(n.lid as i32);
        }
        hs.i32(self.kettle.lid as i32);
    }
}
