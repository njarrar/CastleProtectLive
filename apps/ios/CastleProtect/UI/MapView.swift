import SwiftUI

// MARK: S3, Brickabrac Map (Region 1, Puddingstone Downs)

struct MapView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= geo.size.height * 1.2
            VStack(spacing: 0) {
                topBar
                ZStack {
                    LinearGradient(colors: [Theme.sky, Theme.sky.opacity(0.6), Theme.grass.opacity(0.55)],
                                   startPoint: .top, endPoint: .bottom)
                    if wide {
                        ScrollView(.horizontal, showsIndicators: false) {
                            road(wide: true, length: CGFloat(model.campaign.levels.count) * 120 + 80,
                                 cross: geo.size.height - 180)
                        }
                    } else {
                        ScrollView(.vertical, showsIndicators: false) {
                            road(wide: false, length: CGFloat(model.campaign.levels.count) * 104 + 80,
                                 cross: geo.size.width)
                        }
                    }
                }
                dock
            }
        }
    }

    private var topBar: some View {
        let levels = model.campaign.levels
        let done = levels.filter { $0.state == "done" }.count
        return HStack(spacing: 12) {
            Button {
                model.showSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Theme.ink)
                    .frame(width: 48, height: 48)
            }
            .accessibilityLabel("Settings")
            .accessibilityIdentifier("settings")
            VStack(alignment: .leading, spacing: 0) {
                Text(model.campaign.region).font(Theme.title(18)).foregroundStyle(Theme.ink)
                Text("\(done)/\(levels.count) levels").font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
            }
            .accessibilityElement(children: .combine)
            Spacer()
            Label("\(model.save.progress.totalPennants)/\(levels.count * 3)", systemImage: "flag.fill")
                .font(Theme.label(15))
                .foregroundStyle(Theme.ink)
                .accessibilityLabel("\(model.save.progress.totalPennants) of \(levels.count * 3) Pennants")
            Label("\(model.save.progress.buttons)", systemImage: "circle.circle.fill")
                .font(Theme.label(15))
                .foregroundStyle(Theme.ink)
                .accessibilityLabel("\(model.save.progress.buttons) Buttons")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
        .background(Theme.cream)
    }

    private var dock: some View {
        HStack(spacing: 12) {
            Button("Skirmish") {
                model.sound.play("ui_tap")
                model.screen = .skirmish
            }
            .buttonStyle(PaperButtonStyle(height: 52))
            .accessibilityHint("Play one battle against the AI")
            Spacer()
            Button {
                model.openDuelSetup()
            } label: {
                HStack(spacing: 6) {
                    Circle().fill(Theme.side(0)).frame(width: 16, height: 16)
                    Diamond().fill(Theme.side(1)).frame(width: 16, height: 16)
                    Text("2 Players")
                }
            }
            .buttonStyle(PaperButtonStyle(height: 52))
            .accessibilityLabel("2 Players, Couch Duel")
            .accessibilityIdentifier("twoPlayers")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Theme.cream.ignoresSafeArea(edges: .bottom))
    }

    private func nodePoint(_ i: Int, wide: Bool, cross: CGFloat) -> CGPoint {
        let zig: CGFloat = i % 2 == 0 ? -1 : 1
        if wide {
            return CGPoint(x: 80 + CGFloat(i) * 120, y: cross / 2 + zig * min(70, cross * 0.22))
        }
        return CGPoint(x: cross / 2 + zig * min(90, cross * 0.24), y: 70 + CGFloat(i) * 104)
    }

    private func road(wide: Bool, length: CGFloat, cross: CGFloat) -> some View {
        let levels = model.campaign.levels
        return ZStack(alignment: .topLeading) {
            Path { p in
                for i in levels.indices {
                    let pt = nodePoint(i, wide: wide, cross: cross)
                    if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
                }
            }
            .stroke(Theme.ink.opacity(0.5), style: StrokeStyle(lineWidth: 4, lineCap: .round, dash: [8, 8]))
            ForEach(Array(levels.enumerated()), id: \.element.id) { i, level in
                LevelNode(level: level) { model.openLevel(level) }
                    .position(nodePoint(i, wide: wide, cross: cross))
            }
        }
        .frame(width: wide ? length : cross, height: wide ? max(cross, 200) : length)
    }
}

struct LevelNode: View {
    let level: LevelInfo
    let action: () -> Void

    var body: some View {
        let locked = level.isLocked
        let next = level.state == "next"
        Button(action: action) {
            VStack(spacing: 4) {
                ZStack {
                    if level.kind == "grand_fort" {
                        RoundedRectangle(cornerRadius: 12).fill(locked ? Theme.slate.opacity(0.6) : Theme.cream)
                    } else {
                        Circle().fill(locked ? Theme.slate.opacity(0.6) : (next ? Theme.gold : Theme.paper))
                    }
                    if locked {
                        Image(systemName: "lock.fill").foregroundStyle(Theme.paper)
                    } else {
                        Text(level.number).font(Theme.title(22)).foregroundStyle(Theme.ink)
                    }
                }
                .frame(width: 56, height: 56)
                .overlay(
                    Group {
                        if level.kind == "grand_fort" {
                            RoundedRectangle(cornerRadius: 12).stroke(Theme.ink, lineWidth: 3)
                        } else {
                            Circle().stroke(Theme.ink, lineWidth: 3)
                        }
                    }
                )
                .scaleEffect(next ? 1.08 : 1)
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { i in
                        Image(systemName: i < level.pennants ? "flag.fill" : "flag")
                            .font(.system(size: 11))
                            .foregroundStyle(i < level.pennants ? Theme.goldDark : Theme.inkSoft.opacity(0.6))
                    }
                }
                Text(level.name)
                    .font(Theme.label(12))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .frame(maxWidth: 110)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Level \(level.number), \(level.name). \(level.pennants) of 3 Pennants\(locked ? ". Locked" : "")")
        .accessibilityIdentifier("level-\(level.id)")
    }
}

// MARK: S4, the pre-battle screen with the draft strip (the Rummage)

struct PreBattleView: View {
    @EnvironmentObject private var model: AppModel
    let level: LevelInfo
    @State private var focused: String?

    init(level: LevelInfo) {
        self.level = level
    }

    var body: some View {
        if let session = model.session {
            PreBattleContent(level: level, session: session, focused: $focused)
        } else {
            Text("Getting the field ready").font(Theme.label(18)).padding()
        }
    }
}

private struct PreBattleContent: View {
    @EnvironmentObject private var model: AppModel
    let level: LevelInfo
    @ObservedObject var session: BattleSession
    @Binding var focused: String?

    var body: some View {
        let hud = session.hud
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(level.id == "skirmish" || level.id == "duel" ? level.name : "\(level.id)  \(level.name)")
                        .font(Theme.title(24)).foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text(hud.isVolley
                         ? "\(level.kind.replacingOccurrences(of: "_", with: " ").capitalized). \(level.roundCap) shots each, most damage wins"
                         : "\(level.kind.replacingOccurrences(of: "_", with: " ").capitalized). Round cap \(level.roundCap), then the Squall")
                        .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                }
                Spacer()
                Button {
                    model.closePreBattle()
                } label: {
                    Image(systemName: "xmark").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.ink)
                        .frame(width: 48, height: 48)
                }
                .accessibilityLabel("Close")
            }
            .padding(16)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !level.rival.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Diamond().fill(Theme.side(1)).frame(width: 18, height: 18)
                                Text(level.rival).font(Theme.title(18)).foregroundStyle(Theme.ink)
                                if !hud.isDuel { Text("(AI)").font(Theme.label(14)).foregroundStyle(Theme.inkSoft) }
                            }
                            if !level.habit.isEmpty {
                                Text("\u{201C}\(level.habit)\u{201D}")
                                    .font(Theme.label(15)).foregroundStyle(Theme.ink)
                                    .padding(8)
                                    .panel(corner: 10, fill: Theme.cream)
                            }
                            HStack(spacing: 6) {
                                Text("Their crew:").font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                                ForEach(hud.crews[1]) { hob in
                                    SpriteIcon(name: "ui_class_\(hob.cls == "scatterjack" ? "scatter" : hob.cls)", fallback: "diamond.fill", size: 24)
                                        .accessibilityLabel(hob.cls)
                                }
                            }
                        }
                    }
                    if !level.goals.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Goals").font(Theme.title(16)).foregroundStyle(Theme.ink)
                            ForEach(Array(level.goals.enumerated()), id: \.offset) { i, goal in
                                Label(goal, systemImage: i < level.pennants ? "flag.fill" : "flag")
                                    .font(Theme.label(15)).foregroundStyle(Theme.ink)
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text(hud.isDuel ? "\(hud.names[0])'s crew" : "Crew").font(Theme.title(16)).foregroundStyle(Theme.ink)
                        HStack(spacing: 8) {
                            ForEach(hud.crews[0]) { hob in
                                HobPortrait(hob: hob, side: 0, selected: false, size: 48) {}
                                    .allowsHitTesting(false)
                            }
                        }
                    }
                    if let draft = hud.draft, !draft.pool.isEmpty {
                        draftStrip(draft, hud: hud)
                    }
                }
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 12) {
                if level.pennants > 0 {
                    Button("Same again") { model.fight() }
                        .buttonStyle(PaperButtonStyle(height: 56))
                }
                Spacer()
                Button("FIGHT") { model.fight() }
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("fight")
                    .accessibilityHint("Picks left are filled for you")
            }
            .padding(16)
            .background(Theme.cream)
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private func draftStrip(_ draft: DraftView, hud: HudState) -> some View {
        let picker = draft.turn
        let humanPick = session.snapshot.isHuman(picker) && !draft.done
        let focusedChip = draft.pool.first { $0.id == focused }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Draft").font(Theme.title(16)).foregroundStyle(Theme.ink)
                Text(draft.done ? "done" : (hud.isDuel ? "\(hud.names[picker]) picks" : (picker == 0 ? "your pick" : "\(hud.names[1]) picks")))
                    .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                Spacer()
                Button("Quick Pick") { session.quickPick() }
                    .buttonStyle(PaperButtonStyle(height: 40))
                    .disabled(draft.done)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(draft.pool) { chip in
                        draftChip(chip, draft: draft, enabled: humanPick)
                    }
                }
                .padding(.vertical, 6)
            }
            if let chip = focusedChip {
                Text(chip.dud ? "Dud. Does nothing." : "\(chip.hint)\(chip.bestWith.isEmpty ? "" : "  Best with \(chip.bestWith.capitalized).")")
                    .font(Theme.label(14)).foregroundStyle(Theme.ink)
            }
            HStack(spacing: 16) {
                hand(hud.isDuel ? hud.names[0] : "Yours", draft.hand(0), side: 0, each: draft.picksEach)
                hand(hud.isDuel ? hud.names[1] : "Theirs", draft.hand(1), side: 1, each: draft.picksEach)
            }
            if let wish = draft.wish, !hud.isDuel {
                Text("\(hud.names[1]) wants \(wish).").font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
            }
        }
        .padding(12)
        .panel(corner: 16, fill: Theme.cream)
    }

    private func draftChip(_ chip: DraftChip, draft: DraftView, enabled: Bool) -> some View {
        let taken = chip.takenBy >= 0
        let isFocused = focused == chip.id
        return Button {
            if isFocused {
                session.draftPick(chip.id)
                focused = nil
            } else {
                focused = chip.id
            }
        } label: {
            VStack(spacing: 3) {
                SpriteIcon(name: "icon_\(chip.id)", fallback: "shippingbox.fill", size: 32)
                Text(chip.dud ? "Dud" : chip.name)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                HStack(spacing: 1) {
                    ForEach(0..<chip.weight, id: \.self) { _ in Image(systemName: "gearshape.fill").font(.system(size: 8)) }
                }
            }
            .foregroundStyle(Theme.ink)
            .frame(width: 72, height: 80)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(taken ? Theme.side(chip.takenBy).opacity(0.35) : (isFocused ? Theme.gold : Theme.paper))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.ink, lineWidth: isFocused ? 3 : 2))
            )
            .overlay(alignment: .topTrailing) {
                if draft.wish == chip.name && !taken {
                    Image(systemName: "eye.fill").font(.system(size: 10)).foregroundStyle(Theme.side(1)).padding(4)
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(taken || !enabled)
        .accessibilityLabel("\(chip.dud ? "Dud, " : "")\(chip.name)\(taken ? ", taken" : "")")
        .accessibilityHint(isFocused ? "Tap again to take it" : "Shows what it does")
    }

    private func hand(_ title: String, _ ids: [String], side: Int, each: Int) -> some View {
        let names = ids.map { id in session.snapshot.draft?.pool.first { $0.id == id }?.name ?? id }
        return HStack(spacing: 6) {
            Text(title).font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
            ForEach(0..<max(each, names.count), id: \.self) { i in
                Text(i < names.count ? names[i] : " ")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .lineLimit(1)
                    .frame(width: 70, height: 30)
                    .background(RoundedRectangle(cornerRadius: 8).fill(i < names.count ? Theme.side(side).opacity(0.3) : Theme.paper))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.ink, style: StrokeStyle(lineWidth: 1.5, dash: i < names.count ? [] : [4, 3])))
            }
        }
    }
}
