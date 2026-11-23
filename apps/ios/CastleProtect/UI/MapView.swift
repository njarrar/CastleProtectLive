import SwiftUI

// MARK: S3, Brickabrac Storybook Campaign Map (Region 1, Puddingstone Downs — Part 2 Plate 5)

struct MapView: View {
    @EnvironmentObject private var model: AppModel

    private var playTargetLevel: LevelInfo? {
        let levels = model.campaign.levels
        if let next = levels.first(where: { $0.state == "next" }) { return next }
        if let open = levels.last(where: { !$0.isLocked }) { return open }
        return levels.first
    }

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width >= geo.size.height * 1.2
            VStack(spacing: 0) {
                topBar
                ZStack {
                    PuddingstoneBackdrop()
                    if wide {
                        ScrollView(.horizontal, showsIndicators: false) {
                            road(wide: true, length: CGFloat(max(1, model.campaign.levels.count)) * 136 + 120,
                                 cross: max(220, geo.size.height - 170))
                        }
                    } else {
                        ScrollView(.vertical, showsIndicators: false) {
                            road(wide: false, length: CGFloat(max(1, model.campaign.levels.count)) * 124 + 120,
                                 cross: geo.size.width)
                        }
                    }
                }
                dock(wide: wide)
            }
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private var topBar: some View {
        let levels = model.campaign.levels
        let done = levels.filter { $0.state == "done" }.count
        return HStack(spacing: 10) {
            Button {
                model.showSettings = true
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.ink)
                    .frame(width: 48, height: 48)
                    .hudTier3Pill(corner: 12)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(tx("common.settings"))
            .accessibilityIdentifier("settings")

            VStack(alignment: .leading, spacing: 1) {
                Text(model.campaign.region)
                    .font(Theme.title(19))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(tx("map.cleared", ["done": done, "total": levels.count]))
                    .font(Theme.label(13))
                    .foregroundStyle(Theme.inkSoft)
            }
            .accessibilityElement(children: .combine)

            Spacer(minLength: 4)

            HStack(spacing: 5) {
                PennantRibbonIcon(earned: true, size: 16)
                Text("\(model.save.progress.totalPennants)/\(levels.count * 3)")
                    .font(Theme.number(14))
                    .foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .hudTier3Pill(corner: 12)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(tx("map.pennants_count", ["n": model.save.progress.totalPennants, "total": levels.count * 3]))

            HStack(spacing: 5) {
                Image(systemName: "circle.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.brassLo)
                Text("\(model.save.progress.buttons)")
                    .font(Theme.number(14))
                    .foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .hudTier3Pill(corner: 12)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(tx("map.buttons_count", ["n": model.save.progress.buttons]))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Theme.parchmentCard
                .overlay(alignment: .bottom) { Rectangle().fill(Theme.sepiaBorder).frame(height: 1.5) }
        )
    }

    private func dock(wide: Bool) -> some View {
        let colours = model.save.settings.colourSet
        return VStack(spacing: 8) {
            if wide {
                HStack(spacing: 8) {
                    playButton
                    Button(tx("modes.workshop.name")) { model.openWorkshop() }
                        .buttonStyle(PaperButtonStyle(height: 48))
                        .accessibilityHint(tx("modes.workshop.line"))
                        .accessibilityIdentifier("workshop")
                    twoPlayersButton(colours: colours)
                    Button(tx("modes.skirmish.name")) {
                        model.sound.play("ui_tap")
                        model.screen = .skirmish
                    }
                    .buttonStyle(PaperButtonStyle(height: 48))
                    .accessibilityHint(tx("modes.skirmish.line"))
                    Spacer(minLength: 4)
                    dailyButton
                    testYardButton
                }
            } else {
                HStack(spacing: 8) {
                    playButton
                    Button(tx("modes.workshop.name")) { model.openWorkshop() }
                        .buttonStyle(PaperButtonStyle(height: 48))
                        .accessibilityHint(tx("modes.workshop.line"))
                        .accessibilityIdentifier("workshop")
                    twoPlayersButton(colours: colours)
                }
                HStack(spacing: 8) {
                    Button(tx("modes.skirmish.name")) {
                        model.sound.play("ui_tap")
                        model.screen = .skirmish
                    }
                    .buttonStyle(PaperButtonStyle(height: 48))
                    .accessibilityHint(tx("modes.skirmish.line"))
                    dailyButton
                    testYardButton
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            Theme.parchmentCard
                .overlay(alignment: .top) { Rectangle().fill(Theme.sepiaBorder).frame(height: 1.5) }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var playButton: some View {
        Button {
            if let level = playTargetLevel {
                model.sound.play("ui_tap")
                model.openLevel(level)
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "play.fill").font(.system(size: 13, weight: .heavy))
                Text(tx("home.play"))
            }
        }
        .buttonStyle(GoldButtonStyle(height: 48, minWidth: 96))
        .accessibilityLabel(playTargetLevel.map { tx("home.play_next_hint", ["id": $0.id, "name": $0.name]) } ?? tx("home.play"))
        .accessibilityIdentifier("mapPlay")
    }

    private func twoPlayersButton(colours: ColourSet) -> some View {
        Button {
            model.openDuelSetup()
        } label: {
            HStack(spacing: 5) {
                Circle().fill(Theme.side(0, colours)).frame(width: 12, height: 12)
                    .overlay(Circle().stroke(Theme.ink, lineWidth: 1))
                Diamond().fill(Theme.side(1, colours)).frame(width: 12, height: 12)
                    .overlay(Diamond().stroke(Theme.ink, lineWidth: 1))
                Text(tx("modes.duel.button")).lineLimit(1)
            }
        }
        .buttonStyle(PaperButtonStyle(height: 48))
        .accessibilityLabel(tx("modes.duel.name") + ". " + tx("modes.duel.line"))
        .accessibilityIdentifier("twoPlayers")
    }

    private var dailyButton: some View {
        Button {
            model.startDaily()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: model.dailyDoneToday ? "checkmark.seal.fill" : "calendar")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(model.dailyDoneToday ? Theme.goodBg : Theme.ink)
                Text(tx("modes.daily.short")).lineLimit(1)
            }
        }
        .buttonStyle(PaperButtonStyle(height: 48))
        .accessibilityLabel(model.dailyDoneToday ? tx("modes.daily.done_hint") : tx("modes.daily.name"))
        .accessibilityIdentifier("daily")
    }

    private var testYardButton: some View {
        Button {
            model.startTestYard()
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "target")
                    .font(.system(size: 14, weight: .bold))
                Text(tx("modes.yard.name")).lineLimit(1)
            }
        }
        .buttonStyle(PaperButtonStyle(height: 48))
        .accessibilityHint(tx("modes.yard.long"))
        .accessibilityIdentifier("testYard")
    }

    private func nodePoint(_ i: Int, wide: Bool, cross: CGFloat) -> CGPoint {
        let wave: CGFloat = sin(CGFloat(i) * 1.15)
        if wide {
            return CGPoint(x: 92 + CGFloat(i) * 136, y: cross * 0.54 + wave * min(68, cross * 0.20))
        }
        return CGPoint(x: cross * 0.5 + wave * min(96, cross * 0.25), y: 84 + CGFloat(i) * 124)
    }

    private func curvedRoadPath(points: [CGPoint], wide: Bool) -> Path {
        var p = Path()
        guard let first = points.first else { return p }
        p.move(to: first)
        for i in 1..<points.count {
            let prev = points[i - 1]
            let curr = points[i]
            if wide {
                let midX = (prev.x + curr.x) * 0.5
                p.addCurve(to: curr,
                           control1: CGPoint(x: midX, y: prev.y),
                           control2: CGPoint(x: midX, y: curr.y))
            } else {
                let midY = (prev.y + curr.y) * 0.5
                p.addCurve(to: curr,
                           control1: CGPoint(x: prev.x, y: midY),
                           control2: CGPoint(x: curr.x, y: midY))
            }
        }
        return p
    }

    private func road(wide: Bool, length: CGFloat, cross: CGFloat) -> some View {
        let levels = model.campaign.levels
        let points = levels.indices.map { nodePoint($0, wide: wide, cross: cross) }
        let roadPath = curvedRoadPath(points: points, wide: wide)
        return ZStack(alignment: .topLeading) {
            // Curved storybook cobbled lane: sepia kerb -> warm cream path -> stone dashes
            roadPath
                .stroke(Theme.sepiaBorder, style: StrokeStyle(lineWidth: 14, lineCap: .round, lineJoin: .round))
            roadPath
                .stroke(Theme.cream, style: StrokeStyle(lineWidth: 9, lineCap: .round, lineJoin: .round))
            roadPath
                .stroke(Theme.sepiaBorder.opacity(0.45), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [6, 8]))

            ForEach(Array(levels.enumerated()), id: \.element.id) { i, level in
                LevelNode(level: level) { model.openLevel(level) }
                    .position(points[i])
            }
        }
        .frame(width: wide ? length : cross, height: wide ? max(cross, 240) : length)
    }
}

/// Painted Puddingstone Downs rolling hills storybook sky & meadow backdrop (Plate 5).
private struct PuddingstoneBackdrop: View {
    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            // Sky gradient (cool sky zenith -> warm buttercream horizon)
            ctx.fill(
                Path(CGRect(origin: .zero, size: sz)),
                with: .linearGradient(
                    Gradient(colors: [Color(hex: 0x86C6E5), Color(hex: 0xB3E2F2), Color(hex: 0xF7EFD6)]),
                    startPoint: .zero,
                    endPoint: CGPoint(x: 0, y: h * 0.58)
                )
            )
            // Soft storybook clouds
            let clouds: [(CGFloat, CGFloat, CGFloat)] = [(0.16, 0.13, 36), (0.52, 0.09, 44), (0.84, 0.16, 32)]
            for (cx, cy, r) in clouds {
                let px = w * cx, py = h * cy
                let c1 = Path(ellipseIn: CGRect(x: px - r, y: py - r * 0.45, width: r * 2, height: r * 0.9))
                let c2 = Path(ellipseIn: CGRect(x: px - r * 0.65, y: py - r * 0.72, width: r * 1.1, height: r * 0.85))
                let c3 = Path(ellipseIn: CGRect(x: px + r * 0.05, y: py - r * 0.65, width: r * 0.95, height: r * 0.80))
                let col = Color.white.opacity(0.75)
                ctx.fill(c1, with: .color(col)); ctx.fill(c2, with: .color(col)); ctx.fill(c3, with: .color(col))
            }

            // Distant hazy hill ridge (sky-tinted atmospheric depth)
            var far = Path()
            far.move(to: CGPoint(x: 0, y: h))
            far.addLine(to: CGPoint(x: 0, y: h * 0.36))
            far.addCurve(to: CGPoint(x: w * 0.52, y: h * 0.28),
                         control1: CGPoint(x: w * 0.18, y: h * 0.22),
                         control2: CGPoint(x: w * 0.36, y: h * 0.38))
            far.addCurve(to: CGPoint(x: w, y: h * 0.34),
                         control1: CGPoint(x: w * 0.72, y: h * 0.18),
                         control2: CGPoint(x: w * 0.88, y: h * 0.36))
            far.addLine(to: CGPoint(x: w, y: h))
            far.closeSubpath()
            ctx.fill(far, with: .color(Color(hex: 0x9BC3B5)))

            // Mid-ground sunlit rolling Puddingstone hills
            var mid = Path()
            mid.move(to: CGPoint(x: 0, y: h))
            mid.addLine(to: CGPoint(x: 0, y: h * 0.48))
            mid.addCurve(to: CGPoint(x: w * 0.48, y: h * 0.40),
                         control1: CGPoint(x: w * 0.18, y: h * 0.56),
                         control2: CGPoint(x: w * 0.30, y: h * 0.30))
            mid.addCurve(to: CGPoint(x: w, y: h * 0.46),
                         control1: CGPoint(x: w * 0.70, y: h * 0.52),
                         control2: CGPoint(x: w * 0.85, y: h * 0.32))
            mid.addLine(to: CGPoint(x: w, y: h))
            mid.closeSubpath()
            ctx.fill(mid, with: .color(Color(hex: 0x89C156)))

            // Foreground lush meadow turf
            var near = Path()
            near.move(to: CGPoint(x: 0, y: h))
            near.addLine(to: CGPoint(x: 0, y: h * 0.64))
            near.addCurve(to: CGPoint(x: w * 0.55, y: h * 0.60),
                          control1: CGPoint(x: w * 0.22, y: h * 0.54),
                          control2: CGPoint(x: w * 0.38, y: h * 0.70))
            near.addCurve(to: CGPoint(x: w, y: h * 0.62),
                          control1: CGPoint(x: w * 0.74, y: h * 0.50),
                          control2: CGPoint(x: w * 0.88, y: h * 0.66))
            near.addLine(to: CGPoint(x: w, y: h))
            near.closeSubpath()
            ctx.fill(near, with: .linearGradient(
                Gradient(colors: [Color(hex: 0x79B640), Color(hex: 0x5E9A32)]),
                startPoint: CGPoint(x: 0, y: h * 0.56),
                endPoint: CGPoint(x: 0, y: h)
            ))
        }
        .accessibilityHidden(true)
    }
}

/// Sculpted Topiary Peacock landmark crest perched atop Boss 1-10 on the Campaign Map (Plate 5).
private struct TopiaryPeacockMapCrest: View {
    var body: some View {
        Canvas { ctx, sz in
            let w = sz.width, h = sz.height
            let cx = w * 0.5, cy = h * 0.88
            let ink = Theme.ink
            // 5 fanned sculpted hedge plumes with gold eye-spots
            for i in -2...2 {
                let a = CGFloat(i) * 0.38 - .pi / 2
                var plume = Path()
                plume.move(to: CGPoint(x: cx, y: cy))
                let ca: CGFloat = cos(a), sa: CGFloat = sin(a)
                let aLo: CGFloat = a - 0.15, aHi: CGFloat = a + 0.15
                let reach: CGFloat = h * 0.80, bend: CGFloat = h * 0.55
                let tip = CGPoint(x: cx + ca * reach, y: cy + sa * reach)
                let ctrl = CGPoint(x: cx + cos(aLo) * bend, y: cy + sin(aLo) * bend)
                let ctrl2 = CGPoint(x: cx + cos(aHi) * bend, y: cy + sin(aHi) * bend)
                plume.addQuadCurve(to: tip, control: ctrl)
                plume.addQuadCurve(to: CGPoint(x: cx, y: cy), control: ctrl2)
                plume.closeSubpath()
                ctx.fill(plume, with: .color(i % 2 == 0 ? Color(hex: 0x2F7E36) : Color(hex: 0x3D9642)))
                ctx.stroke(plume, with: .color(ink), lineWidth: 1.5)
                let eyeReach: CGFloat = h * 0.56
                let ex: CGFloat = cx + ca * eyeReach, ey: CGFloat = cy + sa * eyeReach
                let eye = Path(ellipseIn: CGRect(x: ex - 3.5, y: ey - 3.5, width: 7, height: 7))
                ctx.fill(eye, with: .color(Theme.brassMid))
                ctx.stroke(eye, with: .color(ink), lineWidth: 1)
            }
            // Sculpted bird head
            let head = Path(ellipseIn: CGRect(x: cx - 6, y: h * 0.38, width: 12, height: 12))
            ctx.fill(head, with: .color(Color(hex: 0x266B2C)))
            ctx.stroke(head, with: .color(ink), lineWidth: 1.5)
        }
        .frame(width: 68, height: 34)
        .accessibilityHidden(true)
    }
}

struct LevelNode: View {
    let level: LevelInfo
    let action: () -> Void

    var body: some View {
        let locked = level.isLocked
        let next = level.state == "next"
        let done = level.state == "done"
        let isBoss = level.kind == "grand_fort"
        Button(action: action) {
            VStack(spacing: 3) {
                if isBoss {
                    TopiaryPeacockMapCrest()
                        .offset(y: 6)
                }
                ZStack {
                    if isBoss {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(locked ? Theme.flattenerSlate.opacity(0.85) : (next ? Theme.brassMid : Theme.parchmentCard))
                            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(next ? Theme.ink : (done ? Theme.goodBg : Theme.ink), lineWidth: 3))
                    } else if next {
                        Circle()
                            .fill(LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                                 startPoint: .top, endPoint: .bottom))
                            .overlay(Circle().stroke(Color.white.opacity(0.5), lineWidth: 1.5).padding(3))
                            .overlay(Circle().stroke(Theme.ink, lineWidth: 2.8))
                            .shadow(color: Theme.brassDeep.opacity(0.55), radius: 0, x: 0, y: 3)
                    } else {
                        Circle()
                            .fill(locked ? Theme.flattenerSlate.opacity(0.85) : Theme.paper)
                            .overlay(Circle().stroke(done ? Theme.goodBg : Theme.ink, lineWidth: 2.8))
                            .shadow(color: Theme.ink.opacity(0.22), radius: 1, x: 0, y: 2)
                    }

                    if locked {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Theme.paper)
                    } else {
                        Text(level.number)
                            .font(Theme.title(22))
                            .foregroundStyle(Theme.ink)
                    }
                }
                .frame(width: 56, height: 56)
                .overlay(alignment: .topTrailing) {
                    if done {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.goodBg)
                            .background(Circle().fill(Theme.paper).padding(2))
                            .offset(x: 4, y: -4)
                    }
                }
                .scaleEffect(next ? 1.08 : 1)

                // Golden Pennant milestone row
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { i in
                        PennantRibbonIcon(earned: i < level.pennants, size: 15)
                    }
                }

                // 13.4:1 AAA Dark-Espresso Ink on Warm Parchment Ribbon (zero white-on-cream invisibility!)
                Text(level.name)
                    .font(Theme.label(12))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill(Theme.paper)
                            .overlay(Capsule().stroke(done ? Theme.goodBg : Theme.sepiaBorder, lineWidth: 1.3))
                            .shadow(color: Theme.ink.opacity(0.16), radius: 1, x: 0, y: 1)
                    )
                    .frame(maxWidth: 128)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(locked ? tx("map.node_locked", ["id": level.id, "name": level.name])
                            : tx("map.node_done", ["id": level.id, "name": level.name, "n": level.pennants]))
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
            Text(tx("common.loading_fight")).font(Theme.label(18)).foregroundStyle(Theme.ink).padding()
        }
    }
}

private struct PreBattleContent: View {
    @EnvironmentObject private var model: AppModel
    let level: LevelInfo
    @ObservedObject var session: BattleSession
    @Binding var focused: String?

    private var rulesLine: String {
        let hud = session.hud
        let kind = GameText.shared.complete("map.types.\(level.kind)") ?? ""
        let lead = kind.isEmpty ? "" : kind + ". "
        if hud.isYard { return tx("modes.yard.rule") }
        if hud.isVolley { return lead + tx("level_card.rounds_volley", ["n": hud.volleyActions > 0 ? hud.volleyActions : level.roundCap]) }
        return lead + (session.snapshot.squall
            ? tx("level_card.rounds_squall", ["n": level.roundCap])
            : tx("level_card.rounds_count", ["n": level.roundCap]))
    }

    /// The Rival's name: during the fight the core's `hud.names[1]` (Skirmish picks by seed),
    /// else what the sheet was opened with. A Couch Duel shows both players.
    private var rivalName: String {
        let hud = session.hud
        if !hud.isDuel, hud.names.count > 1, !hud.names[1].isEmpty { return hud.names[1] }
        return level.rival
    }

    /// The Notice of Flattening for a campaign level (`levels.<id>.notice`), or nil.
    private var notice: (text: String, signature: String)? {
        let text = GameText.shared
        guard let line = text.complete("levels.\(level.id).notice") else { return nil }
        return (line, text.complete("levels.\(level.id).signature") ?? rivalName)
    }

    var body: some View {
        let hud = session.hud
        let colours = model.save.settings.colourSet
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(level.id == "skirmish" || level.id == "duel" || level.id == "daily" ? level.name : "\(level.id)  \(level.name)")
                        .font(Theme.title(24)).foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text(rulesLine)
                        .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                }
                Spacer()
                Button {
                    model.closePreBattle()
                } label: {
                    Image(systemName: "xmark").font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.ink)
                        .frame(width: 48, height: 48)
                }
                .accessibilityLabel(tx("common.close"))
            }
            .padding(16)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if session.setup.fortRows != nil {
                        Label(tx("level_card.fort_yours"), systemImage: "hammer.fill")
                            .font(Theme.label(13))
                            .foregroundStyle(Theme.ink)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .hudTier2Panel(corner: 10, fill: Theme.cream)
                    }
                    if let notice {
                        // The Notice of Flattening (level_card.notice), signed by the Rival.
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(tx("level_card.notice.title")).font(Theme.title(16)).foregroundStyle(Theme.ink)
                                Spacer()
                                Text(tx("level_card.notice.ref", ["id": level.id])).font(Theme.label(12)).foregroundStyle(Theme.inkSoft)
                            }
                            Text(notice.text).font(Theme.label(15)).foregroundStyle(Theme.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(tx("level_card.notice.signed", ["signature": notice.signature]))
                                .font(Theme.label(13)).italic().foregroundStyle(Theme.inkSoft)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .hudTier2Panel(corner: 10, fill: Theme.cream)
                        .accessibilityElement(children: .combine)
                    }
                    if !rivalName.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Diamond().fill(Theme.side(1, colours)).frame(width: 18, height: 18)
                                Text(rivalName).font(Theme.title(18)).foregroundStyle(Theme.ink)
                            }
                            if !level.habit.isEmpty {
                                Text("\u{201C}\(level.habit)\u{201D}")
                                    .font(Theme.label(15)).foregroundStyle(Theme.ink)
                                    .padding(8)
                                    .hudTier2Panel(corner: 10, fill: Theme.cream)
                            }
                            HStack(spacing: 6) {
                                Text(tx("level_card.their_crew")).font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                                ForEach(hud.crews[1]) { hob in
                                    if !hud.isDuel, let fImg = SpriteImages.flattenerPortrait(def: hob.def, cls: hob.cls) {
                                        Image(uiImage: fImg)
                                            .resizable().scaledToFit()
                                            .frame(width: 28, height: 28)
                                            .background(RoundedRectangle(cornerRadius: 6).fill(Theme.flattenerSlate.opacity(0.25)))
                                            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 1.2))
                                            .accessibilityLabel(hob.shortName)
                                    } else {
                                        SpriteIcon(name: "ui_class_\(hob.cls == "scatterjack" ? "scatter" : hob.cls)", fallback: "diamond.fill", size: 24)
                                            .accessibilityLabel(hob.shortName)
                                    }
                                }
                            }
                        }
                    }
                    if !level.goals.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(tx("level_card.goals")).font(Theme.title(16)).foregroundStyle(Theme.ink)
                            ForEach(Array(level.goals.enumerated()), id: \.offset) { i, goal in
                                HStack(spacing: 6) {
                                    PennantRibbonIcon(earned: i < level.pennants, size: 16)
                                    Text(goal).font(Theme.label(15)).foregroundStyle(Theme.ink)
                                }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text(hud.isDuel ? hud.names[0] : tx("level_card.your_crew")).font(Theme.title(16)).foregroundStyle(Theme.ink)
                        HStack(spacing: 8) {
                            ForEach(hud.crews[0]) { hob in
                                HobPortrait(hob: hob, side: 0, selected: false, size: 48, colours: colours) {}
                                    .allowsHitTesting(false)
                            }
                        }
                    }
                    if let draft = hud.draft, !draft.pool.isEmpty {
                        draftStrip(draft, hud: hud, colours: colours)
                    }
                }
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 12) {
                Spacer()
                Button(tx("common.fight").uppercased()) {
                    model.sound.play("ui_confirm")
                    model.fight()
                }
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("fight")
                    .accessibilityHint(tx("rummage.picks_filled"))
            }
            .padding(16)
            .background(
                Theme.cream
                    .overlay(alignment: .top) { Rectangle().fill(Theme.sepiaBorder).frame(height: 1.5) }
            )
        }
        .background(Theme.paper.ignoresSafeArea())
    }

    private func draftStrip(_ draft: DraftView, hud: HudState, colours: ColourSet) -> some View {
        let picker = draft.turn
        let humanPick = session.snapshot.isHuman(picker) && !draft.done
        let focusedChip = draft.pool.first { $0.id == focused }
        let pickLine: String
        if draft.done {
            pickLine = tx("rummage.all_picked")
        } else if hud.isDuel || picker != 0 {
            let pickerName: String = picker < hud.names.count ? hud.names[picker] : ""
            pickLine = tx("rummage.their_pick", ["name": pickerName])
        } else {
            pickLine = tx("rummage.your_pick", ["n": draft.hand(0).count + 1, "total": draft.picksEach])
        }
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(tx("rummage.title")).font(Theme.title(16)).foregroundStyle(Theme.ink)
                Text(pickLine)
                    .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
                Spacer()
                Button(tx("rummage.quick_pick")) { session.quickPick() }
                    .buttonStyle(PaperButtonStyle(height: 48))
                    .disabled(draft.done)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(draft.pool) { chip in
                        draftChip(chip, draft: draft, enabled: humanPick, colours: colours)
                    }
                }
                .padding(.vertical, 6)
            }
            if let chip = focusedChip {
                let inspectChip = ShotChip(
                    id: chip.id,
                    name: chip.dud ? tx("rummage.dud") : chip.name,
                    kind: "shell",
                    art: chip.id,
                    uses: 1,
                    weight: chip.weight,
                    best: false,
                    matchClass: chip.dud ? nil : (chip.bestWith == "any class" ? "all" : chip.bestWith)
                )
                ShellInspectCard(chip: inspectChip, catalog: session.game.catalog, selectedHob: nil)
            }
            HStack(spacing: 16) {
                hand(hud.isDuel ? hud.names[0] : tx("rummage.yours"), draft.hand(0), side: 0, each: draft.picksEach, colours: colours)
                hand(hud.isDuel ? hud.names[1] : tx("rummage.theirs"), draft.hand(1), side: 1, each: draft.picksEach, colours: colours)
            }
            if let wish = draft.wish, !hud.isDuel {
                Text(tx("rummage.rival_wants_named", ["rival": GameText.shared.rivalShort(hud.names[1]), "shell": wish]))
                    .font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
            }
        }
        .padding(12)
        .hudTier2Panel(corner: 16, fill: Theme.cream)
    }

    private func draftChip(_ chip: DraftChip, draft: DraftView, enabled: Bool, colours: ColourSet) -> some View {
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
                if let img = SpriteImages.image("icon_\(chip.id)") {
                    Image(uiImage: img).resizable().interpolation(.high).scaledToFit().frame(width: 34, height: 34)
                } else {
                    KnackFallbackIcon(shotId: chip.id, kind: "shell", size: 34)
                }
                Text(chip.dud ? tx("rummage.dud") : chip.name)
                    .font(Theme.label(12))
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .multilineTextAlignment(.center)
                HStack(spacing: 2) {
                    ForEach(0..<chip.weight, id: \.self) { _ in RestCogIcon(size: 10) }
                }
            }
            .foregroundStyle(Theme.ink)
            .frame(width: 78, height: 86)
            .background(
                Group {
                    if isFocused {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                                 startPoint: .top, endPoint: .bottom))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.ink, lineWidth: 2.5))
                    } else {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(taken ? Theme.side(chip.takenBy, colours).opacity(0.28) : Theme.paper)
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.sepiaBorder, lineWidth: 1.5))
                    }
                }
            )
            .overlay(alignment: .topTrailing) {
                if draft.wish == chip.name && !taken {
                    Image(systemName: "eye.fill").font(.system(size: 11)).foregroundStyle(Theme.orangeInk).padding(4)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(taken || !enabled)
        .accessibilityLabel(Self.chipSpoken(chip))
        .accessibilityHint(isFocused ? tx("rummage.take") : tx("rummage.shows"))
    }

    /// "Clodpot" for a shell in the pool; "Clodpot, yours" or "Clodpot, theirs" once taken.
    private static func chipSpoken(_ chip: DraftChip) -> String {
        let name = chip.dud ? tx("rummage.dud") : chip.name
        if chip.takenBy == 0 { return tx("rummage.taken_yours", ["shell": name]) }
        if chip.takenBy == 1 { return tx("rummage.taken_theirs", ["shell": name]) }
        return name
    }

    private func hand(_ title: String, _ ids: [String], side: Int, each: Int, colours: ColourSet) -> some View {
        let names = ids.map { id in session.snapshot.draft?.pool.first { $0.id == id }?.name ?? id }
        return HStack(spacing: 6) {
            Text(title).font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
            ForEach(0..<max(each, names.count), id: \.self) { i in
                Text(i < names.count ? names[i] : " ")
                    .font(Theme.label(12))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .padding(.horizontal, 4)
                    .frame(width: 74, height: 32)
                    .background(RoundedRectangle(cornerRadius: 8).fill(i < names.count ? Theme.side(side, colours).opacity(0.25) : Theme.paper))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.sepiaBorder, style: StrokeStyle(lineWidth: 1.5, dash: i < names.count ? [] : [4, 3])))
            }
        }
    }
}
