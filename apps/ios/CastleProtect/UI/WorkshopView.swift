import SwiftUI

// MARK: S10, the Workshop

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

    init(rows: [String]?, checker: WorkshopChecker) {
        let first = (rows?.isEmpty == false ? rows : nil) ?? WorkshopGrid.homeRows
        start = first
        grid = WorkshopGrid(rows: first)
        self.checker = checker
        check = checker.check(grid)
    }

    var canUndo: Bool { !undoStack.isEmpty }

    /// A tap on cell (c, r) with the current tool.
    func tap(c: Int, r: Int) {
        var next = grid
        guard next.apply(tool, c: c, r: r) else { return }
        undoStack.append(grid)
        if undoStack.count > 50 { undoStack.removeFirst() }
        grid = next
        saved = false
        check = checker.check(grid)
    }

    func undo() {
        guard let last = undoStack.popLast() else { return }
        grid = last
        saved = false
        check = checker.check(grid)
    }

    /// Back to the fort the Workshop opened with.
    func revert() {
        undoStack.append(grid)
        grid = WorkshopGrid(rows: start)
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

    init(model: AppModel) {
        self.model = model
        let rows = model.save.fort?.rows
        let standIn = model.bridge.isStandIn
        // Made once: the checker owns its own core handle and thread.
        _workshop = StateObject(wrappedValue: WorkshopModel(rows: rows, checker: WorkshopChecker(standIn: standIn)))
    }

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= geo.size.height * 1.2
            VStack(spacing: 0) {
                ScreenHeader(title: "Workshop") { model.screen = .map }
                if wide {
                    // Landscape: the status and tools sit beside the grid, so they stay on screen.
                    HStack(alignment: .top, spacing: 12) {
                        gridArea(CGSize(width: geo.size.width * 0.55, height: geo.size.height - 72))
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                statusLine
                                palette
                                buttons
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    .padding(.horizontal, 12)
                } else {
                    gridArea(CGSize(width: geo.size.width - 24, height: geo.size.height * 0.55))
                        .padding(.horizontal, 12)
                    VStack(alignment: .leading, spacing: 10) {
                        statusLine
                        palette
                        buttons
                    }
                    .padding(12)
                    Spacer(minLength: 0)
                }
            }
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private func gridArea(_ area: CGSize) -> some View {
        let cell = WorkshopGrid.cellSize(for: area)
        return ScrollView([.horizontal, .vertical], showsIndicators: false) {
            VStack(spacing: 0) {
                ForEach(Array((0..<WorkshopGrid.rows).reversed()), id: \.self) { r in
                    HStack(spacing: 0) {
                        ForEach(0..<WorkshopGrid.cols, id: \.self) { c in
                            cellButton(c: c, r: r, size: cell)
                        }
                    }
                }
                // The Footing: always there, never built on.
                HStack(spacing: 0) {
                    ForEach(0..<WorkshopGrid.cols, id: \.self) { _ in
                        Rectangle().fill(Color(hex: 0x5A4A42))
                            .overlay(Rectangle().stroke(Theme.ink.opacity(0.4), lineWidth: 1))
                            .frame(width: cell, height: cell * 0.5)
                    }
                }
                .accessibilityHidden(true)
            }
            .padding(4)
            .frame(minWidth: area.width, minHeight: min(area.height, cell * CGFloat(WorkshopGrid.rows + 1) + 8))
        }
        .frame(maxWidth: area.width, maxHeight: area.height)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Fort grid")
    }

    private func cellButton(c: Int, r: Int, size: CGFloat) -> some View {
        let cell = workshop.grid.cell(c, r)
        let marked = workshop.check.marked.contains(r * WorkshopGrid.cols + c)
        return Button {
            workshop.tap(c: c, r: r)
            model.sound.play("ui_tap")
        } label: {
            ZStack {
                Rectangle().fill(Self.fill(cell))
                switch cell {
                case .nook(let n):
                    Text("\(n)").font(Theme.title(size * 0.45)).foregroundStyle(Theme.ink)
                case .kettle:
                    Image(systemName: "flame.fill").font(.system(size: size * 0.4)).foregroundStyle(Theme.ink)
                default:
                    EmptyView()
                }
                Rectangle().stroke(marked ? Color(hex: 0xE5484D) : Theme.ink.opacity(cell == .empty ? 0.15 : 0.5),
                                   lineWidth: marked ? 3 : 1)
            }
            .frame(width: size, height: size)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Column \(c + 1), row \(r + 1), \(Self.words(cell))\(marked ? ", needs a fix" : "")")
        .accessibilityIdentifier("cell-\(c)-\(r)")
    }

    static func fill(_ cell: WorkshopCell) -> Color {
        switch cell {
        case .empty: return Theme.sky.opacity(0.25)
        case .block("w"): return Color(hex: 0xE3B565)
        case .block("c"): return Color(hex: 0xA9A39A)
        case .block: return Color(hex: 0xB9733A)
        case .nook: return Theme.cream
        case .kettle: return Color(hex: 0xD9773A).opacity(0.6)
        }
    }

    static func words(_ cell: WorkshopCell) -> String {
        switch cell {
        case .empty: return "empty"
        case .block("w"): return "Wicker"
        case .block("c"): return "Cobble"
        case .block: return "Timber"
        case .nook(let n): return "Nook \(n)"
        case .kettle: return "Kettle Room"
        }
    }

    private var statusLine: some View {
        Text(workshop.saved ? "Saved. \(workshop.check.status)" : workshop.check.status)
            .font(Theme.label(15))
            .foregroundStyle(workshop.check.ok ? Theme.ink : Color(hex: 0xB3261E))
            .fixedSize(horizontal: false, vertical: true)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .panel(corner: 12, fill: Theme.cream)
            .accessibilityIdentifier("workshopStatus")
    }

    private var palette: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 8)], spacing: 8) {
            ForEach(WorkshopTool.allCases) { t in
                Button {
                    workshop.tool = t
                } label: {
                    HStack(spacing: 6) {
                        if t != .erase && t != .nook && t != .kettle {
                            RoundedRectangle(cornerRadius: 3).fill(Self.fill(.block(t.glyph ?? "t")))
                                .frame(width: 16, height: 16)
                        } else {
                            Image(systemName: t == .erase ? "eraser.fill" : (t == .kettle ? "flame.fill" : "person.fill"))
                                .font(.system(size: 13))
                        }
                        Text(t.label).font(Theme.label(14))
                    }
                    .foregroundStyle(Theme.ink)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(workshop.tool == t ? Theme.gold : Theme.paper)
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.ink, lineWidth: 2))
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t.label)
                .accessibilityAddTraits(workshop.tool == t ? .isSelected : [])
            }
        }
    }

    private var buttons: some View {
        HStack(spacing: 10) {
            Button("Undo") { workshop.undo() }
                .buttonStyle(PaperButtonStyle(height: 44))
                .disabled(!workshop.canUndo)
            Button("Revert") { workshop.revert() }
                .buttonStyle(PaperButtonStyle(height: 44))
            Spacer(minLength: 0)
            Button("Save") {
                if let rows = workshop.rowsToSave() { model.saveWorkshopFort(rows) }
            }
            .buttonStyle(GoldButtonStyle(height: 48, minWidth: 110))
            .disabled(!workshop.check.ok)
            .opacity(workshop.check.ok ? 1 : 0.5)
            .accessibilityIdentifier("saveFort")
        }
    }
}
