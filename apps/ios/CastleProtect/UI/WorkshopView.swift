import SwiftUI

// MARK: S10, the Workshop (Part 2 Plate 4 Redesign)

/// The Workshop's state: the grid being edited, the tool, and what the core said about it.
@MainActor
final class WorkshopModel: ObservableObject {
    @Published private(set) var grid: WorkshopGrid
    @Published var tool: WorkshopTool = .timber
    @Published private(set) var check = WorkshopCheck()
    @Published private(set) var saved = false
    private var undoStack: [WorkshopGrid] = []
    private let checker: WorkshopChecker
    private let start: [String]

    init(rows: [String]?, checker: WorkshopChecker, deferInitialCheck: Bool = false) {
        let first = (rows?.isEmpty == false ? rows : nil) ?? WorkshopGrid.homeRows
        start = first
        grid = WorkshopGrid(rows: first)
        self.checker = checker
        if deferInitialCheck {
            check = WorkshopCheck(ok: false, used: grid.used, budget: WorkshopGrid.budget, cost: 0,
                                  words: tx("workshop.checking"), marked: [])
        } else {
            check = checker.check(grid)
        }
    }

    var canUndo: Bool { !undoStack.isEmpty }
    var canRevert: Bool { grid != WorkshopGrid(rows: start) }

    /// Starts the validator core off the main thread and runs the initial check (iOS-M2).
    func refreshAsync() async {
        await checker.warmUp()
        let snapshot = grid
        let result = await checker.checkAsync(snapshot)
        if grid == snapshot {
            check = result
        }
    }

    /// A tap on cell (c, r) with the current tool. Returns true if the grid changed.
    @discardableResult
    func tap(c: Int, r: Int) -> Bool {
        var next = grid
        guard next.apply(tool, c: c, r: r) else { return false }
        undoStack.append(grid)
        if undoStack.count > 50 { undoStack.removeFirst() }
        grid = next
        saved = false
        check = checker.check(grid)
        return true
    }

    func undo() {
        guard let last = undoStack.popLast() else { return }
        grid = last
        saved = false
        check = checker.check(grid)
    }

    /// Back to the fort the Workshop opened with (no-op when already unchanged: iOS-M2).
    func revert() {
        let original = WorkshopGrid(rows: start)
        guard grid != original else { return }
        undoStack.append(grid)
        grid = original
        saved = false
        check = checker.check(grid)
    }

    /// The rows to save, only when the core accepted the fort.
    func rowsToSave() -> [String]? {
        guard check.ok else { return nil }
        saved = true
        return grid.glyphRows()
    }
}

struct WorkshopView: View {
    @ObservedObject var model: AppModel
    @StateObject private var workshop: WorkshopModel

    /// Canonical seat labels for Nooks 1...5 (content/hobs.json crew order), named by
    /// `hobs.<id>.short` from content/text.json.
    private static var seatCrew: [(art: String, short: String)] {
        ["marge", "quill", "jax", "grub", "bobbin"].map { (art: $0, short: GameText.shared.hobShort($0)) }
    }

    private static let colLetters = ["A", "B", "C", "D", "E", "F", "G", "H"]

    init(model: AppModel) {
        self.model = model
        let rows = model.save.fort?.rows
        let standIn = model.bridge.isStandIn
        // Made once: the checker owns its own core handle and thread; initial check runs in `.task`.
        _workshop = StateObject(wrappedValue: WorkshopModel(rows: rows, checker: WorkshopChecker(standIn: standIn),
                                                            deferInitialCheck: true))
    }

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= geo.size.height * 1.2
            VStack(spacing: 0) {
                ScreenHeader(title: tx("workshop.title")) { model.screen = .map }
                if wide {
                    // Landscape drafting studio: living cutaway board left, structured inspector + palette right.
                    HStack(alignment: .top, spacing: 14) {
                        draftingBoard(CGSize(width: geo.size.width * 0.56, height: geo.size.height - 76))
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                inspectorSummary
                                palette
                                buttons
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    .padding(.horizontal, 12)
                } else {
                    // Portrait: drafting board capped cleanly above scrollable inspector + pinned action bar.
                    draftingBoard(CGSize(width: geo.size.width - 24, height: geo.size.height * 0.48))
                        .padding(.horizontal, 12)
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            inspectorSummary
                            palette
                        }
                        .padding(12)
                    }
                    buttons
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            Theme.cream
                                .overlay(alignment: .top) { Rectangle().fill(Theme.sepiaBorder).frame(height: 1.5) }
                                .ignoresSafeArea(edges: .bottom)
                        )
                }
            }
        }
        .background(Theme.paper.ignoresSafeArea())
        .task { await workshop.refreshAsync() }
    }

    // MARK: Cutaway Drafting Board (A-H, 1-9, FRONT -> Loopholes, Unified 2x2 Rooms, 3 Stompers)

    private struct RoomOrigin: Hashable {
        let c: Int
        let r: Int
        let isKettle: Bool
        let nookNumber: Int
    }

    private func roomOrigins(in grid: WorkshopGrid) -> [RoomOrigin] {
        var found: [RoomOrigin] = []
        var kettleDone = false
        var seenNooks = Set<Int>()
        for r in 0..<(WorkshopGrid.rows - 1) {
            for c in 0..<(WorkshopGrid.cols - 1) {
                let cell = grid.cell(c, r)
                switch cell {
                case .kettle where !kettleDone:
                    if grid.cell(c + 1, r) == .kettle && grid.cell(c, r + 1) == .kettle && grid.cell(c + 1, r + 1) == .kettle {
                        kettleDone = true
                        found.append(RoomOrigin(c: c, r: r, isKettle: true, nookNumber: 0))
                    }
                case .nook(let n) where !seenNooks.contains(n):
                    if grid.cell(c + 1, r) == .nook(n) && grid.cell(c, r + 1) == .nook(n) && grid.cell(c + 1, r + 1) == .nook(n) {
                        seenNooks.insert(n)
                        found.append(RoomOrigin(c: c, r: r, isKettle: false, nookNumber: n))
                    }
                default:
                    break
                }
            }
        }
        return found
    }

    private func draftingBoard(_ area: CGSize) -> some View {
        let axisW: CGFloat = 22
        let frontW: CGFloat = 34
        let headerH: CGFloat = 22
        let stomperH: CGFloat = 22
        let inner = CGSize(width: max(120, area.width - axisW - frontW - 24),
                           height: max(120, area.height - headerH - stomperH - 24))
        let cell = WorkshopGrid.cellSize(for: inner)
        let gridW = cell * CGFloat(WorkshopGrid.cols)
        let gridH = cell * CGFloat(WorkshopGrid.rows)
        let rooms = roomOrigins(in: workshop.grid)
        let nookTopRows = Set(rooms.filter { !$0.isKettle }.map { $0.r + 1 })
        let isFloatingError = workshop.check.words == tx("workshop.problems.nothing_under")

        return ScrollView([.horizontal, .vertical], showsIndicators: false) {
            VStack(alignment: .leading, spacing: 2) {
                // Top coordinate header: A-H columns + FRONT -> banner
                HStack(spacing: 0) {
                    Spacer().frame(width: axisW)
                    ForEach(0..<WorkshopGrid.cols, id: \.self) { c in
                        Text(c < Self.colLetters.count ? Self.colLetters[c] : "\(c + 1)")
                            .font(Theme.number(12))
                            .foregroundStyle(Theme.inkSoft)
                            .frame(width: cell, height: headerH)
                    }
                    HStack(spacing: 2) {
                        Text(tx("workshop.front").uppercased())
                            .font(Theme.title(12))
                            .minimumScaleFactor(0.75)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 10, weight: .heavy))
                    }
                    .foregroundStyle(Theme.orangeInk)
                    .padding(.horizontal, 4)
                    .frame(minWidth: frontW, height: headerH)
                    .background(Capsule().fill(Theme.brassHi.opacity(0.7)).overlay(Capsule().stroke(Theme.orangeInk, lineWidth: 1)))
                }

                // Main row: 1-9 vertical coordinates + Grid with unified 2x2 rooms + Enemy-facing Loophole arches
                HStack(alignment: .top, spacing: 0) {
                    // Left row axis (9 down to 1, plus F for Footing)
                    VStack(spacing: 0) {
                        ForEach(Array((0..<WorkshopGrid.rows).reversed()), id: \.self) { r in
                            Text("\(r + 1)")
                                .font(Theme.number(12))
                                .foregroundStyle(Theme.inkSoft)
                                .frame(width: axisW, height: cell)
                        }
                        Text("F")
                            .font(Theme.number(12))
                            .foregroundStyle(Theme.inkSoft)
                            .frame(width: axisW, height: cell * 0.55)
                    }

                    // Drafting board grid + unified rooms + footing + 3 Stompers
                    VStack(spacing: 0) {
                        ZStack(alignment: .topLeading) {
                            // Subtle storybook drafting sky backdrop
                            LinearGradient(colors: [Theme.sky.opacity(0.32), Theme.paper],
                                           startPoint: .top, endPoint: .bottom)
                                .frame(width: gridW, height: gridH)

                            // Layer 1: Unified 2x2 Kettle Room & 2x2 warm lantern-lit Hob Nooks
                            ForEach(rooms, id: \.self) { room in
                                let topRowIndex = WorkshopGrid.rows - 1 - (room.r + 1)
                                unifiedRoomView(room, cell: cell)
                                    .frame(width: cell * 2, height: cell * 2)
                                    .offset(x: CGFloat(room.c) * cell, y: CGFloat(topRowIndex) * cell)
                                    .allowsHitTesting(false)
                            }

                            // Layer 2: Interactive cell grid (textured blocks, transparent hit regions on rooms, pinpoint errors)
                            VStack(spacing: 0) {
                                ForEach(Array((0..<WorkshopGrid.rows).reversed()), id: \.self) { r in
                                    HStack(spacing: 0) {
                                        ForEach(0..<WorkshopGrid.cols, id: \.self) { c in
                                            cellButton(c: c, r: r, size: cell, isFloatingError: isFloatingError)
                                        }
                                    }
                                }
                            }
                        }
                        .frame(width: gridW, height: gridH)
                        .overlay(Rectangle().stroke(Theme.ink, lineWidth: 2))

                        // Dark stone Footing row with masonry joints
                        HStack(spacing: 0) {
                            ForEach(0..<WorkshopGrid.cols, id: \.self) { c in
                                Rectangle()
                                    .fill(c % 2 == 0 ? Color(hex: 0x5A4A42) : Color(hex: 0x4E3F38))
                                    .overlay(Rectangle().stroke(Theme.ink.opacity(0.65), lineWidth: 1))
                                    .frame(width: cell, height: cell * 0.55)
                            }
                        }
                        .overlay(Rectangle().stroke(Theme.ink, lineWidth: 2))
                        .accessibilityHidden(true)

                        // 3 planted Stomper legs beneath the Footing (Plate 4)
                        WorkshopStompersView(width: gridW, height: stomperH)
                            .accessibilityHidden(true)
                    }

                    // Enemy-facing FRONT wall indicator rail with dark arched Loopholes aligned to Nooks
                    VStack(spacing: 0) {
                        ForEach(Array((0..<WorkshopGrid.rows).reversed()), id: \.self) { r in
                            ZStack {
                                if nookTopRows.contains(r) {
                                    WorkshopLoopholeBadge(size: min(cell * 0.72, 24))
                                }
                            }
                            .frame(width: frontW, height: cell)
                        }
                        Spacer().frame(width: frontW, height: cell * 0.55)
                    }
                }
            }
            .padding(10)
            .hudTier2Panel(corner: 16, fill: Theme.parchmentCard)
            .frame(minWidth: area.width, alignment: .center)
        }
        .frame(maxWidth: area.width, maxHeight: area.height)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(tx("workshop.grid"))
    }

    @ViewBuilder
    private func unifiedRoomView(_ room: RoomOrigin, cell: CGFloat) -> some View {
        let w = cell * 2
        ZStack {
            // Opaque dark-timber cutaway chamber (#3B2D24) + warm lantern glow (#FFCE70)
            Rectangle().fill(Theme.nookBack)
            RadialGradient(colors: [Theme.lanternGlow.opacity(0.55), Theme.lanternGlow.opacity(0.05)],
                           center: .center, startRadius: 2, endRadius: w * 0.55)

            if room.isKettle {
                // Single glowing copper Heartkettle + brass steam pipe running down into Footing
                VStack(spacing: 0) {
                    Spacer(minLength: 2)
                    BrassKettleDialIcon(percent: 100, side: 0, colours: .brickabrac, size: max(28, w * 0.52))
                    Rectangle()
                        .fill(LinearGradient(colors: [Theme.brassHi, Theme.brassLo], startPoint: .leading, endPoint: .trailing))
                        .frame(width: max(5, w * 0.11), height: max(8, w * 0.18))
                        .overlay(Rectangle().stroke(Theme.ink, lineWidth: 1))
                }
                Text(tx("workshop.tools.kettle"))
                    .font(Theme.label(12))
                    .minimumScaleFactor(0.65)
                    .lineLimit(1)
                    .foregroundStyle(Theme.brassHi)
                    .padding(.horizontal, 4)
                    .background(Capsule().fill(Theme.ink.opacity(0.75)))
                    .frame(maxHeight: .infinity, alignment: .top)
                    .padding(.top, 2)
            } else {
                // Unified lantern-lit Hob Nook with portrait + real Hob name (`1 Marge`, `2 Quill`, `3 Jax`...)
                let idx = max(0, min(Self.seatCrew.count - 1, room.nookNumber - 1))
                let crew = Self.seatCrew[idx]
                VStack(spacing: 1) {
                    if let img = SpriteImages.portrait(id: crew.art, name: crew.short, side: 0) {
                        Image(uiImage: img)
                            .resizable().scaledToFit()
                            .frame(width: w * 0.48, height: w * 0.48)
                            .background(Circle().fill(Theme.paper.opacity(0.9)))
                            .overlay(Circle().stroke(Theme.ink, lineWidth: 1.5))
                    } else {
                        Circle()
                            .fill(Theme.side(0))
                            .frame(width: w * 0.42, height: w * 0.42)
                            .overlay(Text("\(room.nookNumber)").font(Theme.title(14)).foregroundStyle(.white))
                            .overlay(Circle().stroke(Theme.ink, lineWidth: 1.5))
                    }
                    Text(tx("workshop.nook_with", ["n": room.nookNumber, "hob": crew.short]))
                        .font(Theme.label(12))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                        .foregroundStyle(Theme.paper)
                        .padding(.horizontal, 4)
                        .background(Capsule().fill(Theme.ink.opacity(0.82)))
                }
                .padding(2)
            }
            Rectangle().stroke(Theme.ink, lineWidth: 2)
        }
    }

    private func cellButton(c: Int, r: Int, size: CGFloat, isFloatingError: Bool) -> some View {
        let cell = workshop.grid.cell(c, r)
        let marked = workshop.check.marked.contains(r * WorkshopGrid.cols + c)
        let isRoom = cell.isRoom
        return Button {
            if workshop.tap(c: c, r: r) {
                model.sound.play(workshop.tool == .erase ? "ui_tap" : "meta_block_place")
            } else {
                model.sound.play("ui_denied")
                model.haptics.play(.illegal)
            }
        } label: {
            ZStack {
                if !isRoom {
                    Rectangle().fill(Self.fill(cell))
                    blockGrain(cell: cell, size: size)
                } else {
                    Color.clear
                }

                // Pinpoint red error callout overlays on exact problem cells (Plate 4)
                if marked {
                    if cell == .empty {
                        Rectangle().fill(Theme.badBg.opacity(0.82))
                        Rectangle()
                            .stroke(Theme.badBorder, style: StrokeStyle(lineWidth: 2.5, dash: [4, 3]))
                            .padding(1)
                        Text(tx("workshop.problems.needs_wall"))
                            .font(.system(size: max(8, size * 0.24), weight: .heavy, design: .rounded))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Theme.badInk)
                            .minimumScaleFactor(0.65)
                    } else {
                        WorkshopRedHatch()
                            .stroke(Theme.badBorder.opacity(0.85), lineWidth: 2)
                            .background(Theme.badBg.opacity(0.45))
                        Rectangle()
                            .stroke(Theme.badBorder, lineWidth: 2.5)
                        Text(isFloatingError ? tx("workshop.wont_stand") : tx("workshop.fix"))
                            .font(.system(size: max(8, size * 0.25), weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 3)
                            .background(Capsule().fill(Theme.badInk))
                    }
                } else if !isRoom {
                    Rectangle().stroke(Theme.ink.opacity(cell == .empty ? 0.14 : 0.65),
                                       lineWidth: cell == .empty ? 0.75 : 1.2)
                }
            }
            .frame(width: size, height: size)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Self.cellSpoken(c: c, r: r, cell: cell, marked: marked))
        .accessibilityIdentifier("cell-\(c)-\(r)")
    }

    @ViewBuilder
    private func blockGrain(cell: WorkshopCell, size: CGFloat) -> some View {
        switch cell {
        case .block("t"):
            // Warm horizontal timber plank grain
            VStack(spacing: max(3, size * 0.22)) {
                Rectangle().fill(Theme.ink.opacity(0.18)).frame(height: 1)
                Rectangle().fill(Theme.ink.opacity(0.18)).frame(height: 1)
            }
            .padding(.horizontal, 2)
        case .block("c"):
            // Cobble stone mortar joints
            HStack(spacing: size * 0.35) {
                Rectangle().fill(Theme.ink.opacity(0.22)).frame(width: 1)
            }
            .overlay(Rectangle().fill(Theme.ink.opacity(0.22)).frame(height: 1))
        case .block("w"):
            // Wicker cross-weave accent
            Rectangle()
                .stroke(Color(hex: 0xB88435).opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                .padding(3)
        default:
            EmptyView()
        }
    }

    static func fill(_ cell: WorkshopCell) -> Color {
        switch cell {
        case .empty: return Color.clear
        case .block("w"): return Color(hex: 0xE3B565)
        case .block("c"): return Color(hex: 0xA9A39A)
        case .block: return Color(hex: 0xB9733A)
        case .nook: return Theme.nookBack
        case .kettle: return Theme.nookBack
        }
    }

    /// "Column 2, row 3, Timber" (`a11y.workshop_cell`), or `_empty`, or `_bad` with the problem.
    static func cellSpoken(c: Int, r: Int, cell: WorkshopCell, marked: Bool) -> String {
        let vars: [String: any CustomStringConvertible] = ["col": c + 1, "row": r + 1, "what": words(cell)]
        if marked {
            var all = vars
            all["problem"] = tx("workshop.fix")
            if cell == .empty { all["what"] = tx("workshop.problems.needs_wall") }
            return tx("a11y.workshop_cell_bad", all)
        }
        if cell == .empty { return tx("a11y.workshop_cell_empty", vars) }
        return tx("a11y.workshop_cell", vars)
    }

    static func words(_ cell: WorkshopCell) -> String {
        switch cell {
        case .empty: return ""
        case .block("w"): return tx("workshop.tools.wicker")
        case .block("c"): return tx("workshop.tools.cobble")
        case .block: return tx("workshop.tools.timber")
        case .nook(let n): return tx("workshop.nook", ["n": n])
        case .kettle: return tx("workshop.kettle_room")
        }
    }

    // MARK: Structured Inspector Summary & Tools (WCAG AA+)

    private var issueCount: Int {
        if workshop.check.ok { return 0 }
        return max(1, workshop.check.marked.count)
    }

    private var inspectorSummary: some View {
        let ok = workshop.check.ok
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                if ok {
                    Label(workshop.saved ? tx("workshop.saved_ready") : tx("workshop.ready"), systemImage: "checkmark.circle.fill")
                        .font(Theme.title(14))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Theme.goodBg))
                } else {
                    Label(GameText.shared.plural("workshop.to_fix", issueCount), systemImage: "exclamationmark.triangle.fill")
                        .font(Theme.title(14))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Theme.badInk))
                }
                Spacer(minLength: 4)
                Text(tx("workshop.nooks", ["n": workshop.grid.nooks, "total": WorkshopGrid.maxNooks]))
                    .font(Theme.label(13))
                    .foregroundStyle(Theme.ink)
            }

            if !ok {
                Text(workshop.check.words)
                    .font(Theme.label(14))
                    .foregroundStyle(Theme.badInk)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 8) {
                statChip(tx("workshop.blocks"), "\(workshop.check.used)/\(workshop.check.budget)")
                statChip(tx("workshop.cost"), "\(workshop.check.cost)")
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(ok ? Theme.parchmentCard : Theme.badBg)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(ok ? Theme.goodBg : Theme.badBorder, lineWidth: 1.8)
                )
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(workshop.saved ? "\(tx("workshop.saved")) \(workshop.check.status)" : workshop.check.status)
        .accessibilityIdentifier("workshopStatus")
    }

    private func statChip(_ title: String, _ value: String) -> some View {
        HStack(spacing: 4) {
            Text(title).font(Theme.label(12)).foregroundStyle(Theme.inkSoft)
            Text(value).font(Theme.number(13)).foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(Theme.paper).overlay(Capsule().stroke(Theme.sepiaBorder, lineWidth: 1)))
    }

    private var palette: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 94), spacing: 8)], spacing: 8) {
            ForEach(WorkshopTool.allCases) { t in
                let selected = workshop.tool == t
                Button {
                    workshop.tool = t
                } label: {
                    HStack(spacing: 6) {
                        if let g = t.glyph {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Self.fill(.block(g)))
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Theme.ink, lineWidth: 1.2))
                                .frame(width: 18, height: 18)
                        } else if t == .kettle {
                            BrassKettleDialIcon(percent: 100, size: 18)
                        } else {
                            Image(systemName: t == .erase ? "eraser.fill" : "person.crop.circle.fill")
                                .font(.system(size: 15, weight: .bold))
                        }
                        Text(t.label).font(Theme.label(14))
                    }
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        Group {
                            if selected {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                                         startPoint: .top, endPoint: .bottom))
                                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.ink, lineWidth: 2.5))
                                    .shadow(color: Theme.brassDeep.opacity(0.45), radius: 0, x: 0, y: 2)
                            } else {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Theme.parchmentCard)
                                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.sepiaBorder, lineWidth: 1.5))
                            }
                        }
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t.label)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }

    private var buttons: some View {
        let valid = workshop.check.ok
        return HStack(spacing: 8) {
            Button(tx("common.undo")) { workshop.undo() }
                .buttonStyle(PaperButtonStyle(height: 48))
                .disabled(!workshop.canUndo)
                .opacity(workshop.canUndo ? 1 : 0.55)
            Button(tx("common.revert")) { workshop.revert() }
                .buttonStyle(PaperButtonStyle(height: 48))
                .disabled(!workshop.canRevert)
                .opacity(workshop.canRevert ? 1 : 0.55)
            Spacer(minLength: 0)
            // Disabled cleanly when fort is invalid so Test Yard never launches or overwrites a broken fort!
            Button {
                model.startTestYard(customRows: workshop.grid.glyphRows())
            } label: {
                HStack(spacing: 4) {
                    if !valid {
                        Image(systemName: "lock.fill").font(.system(size: 12, weight: .bold))
                    }
                    Text(tx("workshop.test_yard"))
                }
            }
            .buttonStyle(PaperButtonStyle(height: 48))
            .disabled(!valid)
            .opacity(valid ? 1 : 0.58)
            .accessibilityLabel(tx("workshop.test_yard_hint"))
            .accessibilityIdentifier("testFort")

            // High-contrast Save button (never washed-out illegible text when disabled!)
            Button {
                if let rows = workshop.rowsToSave() { model.saveWorkshopFort(rows) }
            } label: {
                Text(tx("common.save"))
                    .font(Theme.title(18))
                    .foregroundStyle(valid ? Theme.ink : Theme.inkSoft)
                    .padding(.horizontal, 18)
                    .frame(minWidth: 92, minHeight: 48)
                    .background(
                        Group {
                            if valid {
                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                    .fill(LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                                         startPoint: .top, endPoint: .bottom))
                                    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(Theme.ink, lineWidth: 2.5))
                                    .shadow(color: Theme.brassDeep.opacity(0.5), radius: 0, x: 0, y: 2.5)
                            } else {
                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                    .fill(Color(hex: 0xE2D7C5))
                                    .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous)
                                        .stroke(Theme.inkSoft.opacity(0.65), style: StrokeStyle(lineWidth: 1.5, dash: [5, 3])))
                            }
                        }
                    )
            }
            .buttonStyle(.plain)
            .disabled(!valid)
            .accessibilityIdentifier("saveFort")
        }
    }
}

/// 3 planted brass-and-iron Stomper legs beneath the Workshop Footing bar (Plate 4).
private struct WorkshopStompersView: View {
    let width: CGFloat
    let height: CGFloat

    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            let ink = Theme.ink
            for frac in [0.18, 0.50, 0.82] as [CGFloat] {
                let cx = w * frac
                let leg = Path(roundedRect: CGRect(x: cx - 5, y: 0, width: 10, height: h * 0.58), cornerRadius: 2)
                ctx.fill(leg, with: .color(Color(hex: 0x7B6B5A)))
                ctx.stroke(leg, with: .color(ink), lineWidth: 1.8)
                let knee = Path(ellipseIn: CGRect(x: cx - 4.5, y: h * 0.34, width: 9, height: 7))
                ctx.fill(knee, with: .color(Theme.brassMid))
                ctx.stroke(knee, with: .color(ink), lineWidth: 1.4)
                let foot = Path(roundedRect: CGRect(x: cx - 12, y: h * 0.52, width: 24, height: h * 0.44), cornerRadius: 4)
                ctx.fill(foot, with: .color(Color(hex: 0x463E3B)))
                ctx.stroke(foot, with: .color(ink), lineWidth: 2)
            }
        }
        .frame(width: width, height: height)
    }
}

/// Dark arched Loophole marker displayed along the Workshop's FRONT enemy-facing edge.
private struct WorkshopLoopholeBadge: View {
    let size: CGFloat

    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            var arch = Path()
            arch.move(to: CGPoint(x: w * 0.22, y: h * 0.90))
            arch.addLine(to: CGPoint(x: w * 0.22, y: h * 0.44))
            arch.addQuadCurve(to: CGPoint(x: w * 0.78, y: h * 0.44), control: CGPoint(x: w * 0.50, y: h * 0.06))
            arch.addLine(to: CGPoint(x: w * 0.78, y: h * 0.90))
            arch.closeSubpath()
            ctx.fill(arch, with: .color(Theme.ink))
            ctx.stroke(arch, with: .color(Theme.brassLo), lineWidth: 1.8)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Diagonal red hazard hatch for floating/unsupported Workshop cells.
private struct WorkshopRedHatch: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let step: CGFloat = 7
        var x = -rect.height
        while x < rect.width {
            p.move(to: CGPoint(x: max(rect.minX, rect.minX + x), y: max(rect.minY, rect.minY - x)))
            p.addLine(to: CGPoint(x: min(rect.maxX, rect.minX + x + rect.height), y: min(rect.maxY, rect.maxY - max(0, x + rect.height - rect.width))))
            x += step
        }
        return p
    }
}
