import SwiftUI

// MARK: S23, Couch Duel setup: one screen, two player cards, a rules row

struct DuelSetupView: View {
    @EnvironmentObject private var model: AppModel
    @State private var options = DuelOptions()
    @State private var loaded = false

    static let sillyNames = [
        "Mabel", "Otis", "Captain Crumb", "Dot", "Sir Wobble", "Pip", "Granny Gale", "Biscuit", "Nell", "Tumble",
        "Moss", "Juniper", "Wilf", "Bramble", "Lady Lumpkin", "Fig", "Rolo", "Hattie", "Pudding", "Sprout",
        "Clem", "Marmalade", "Basil", "Tilly", "Gus", "Pickle", "Ada", "Bertie", "Noodle", "Winnie",
        "Muffin", "Ozzie", "Rosie", "Crumpet", "Iggy", "Primrose", "Bosco", "Lettie", "Scone", "Duke Dumpling",
    ]

    var body: some View {
        GeometryReader { geo in
            let m = Self.metrics(size: geo.size)
            let wide = m.wide
            VStack(spacing: 0) {
                HStack {
                    ScreenHeader(title: "Couch Duel") { model.leaveDuel() }
                    if m.compact {
                        Text("2 players, 1 device.")
                            .font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Button("Swap sides") { swapSides() }
                        .buttonStyle(PaperButtonStyle(height: 44))
                        .padding(.trailing, 12)
                }
                .background(Theme.cream)
                if !m.compact {
                    Text("2 players, 1 device. Free forever, no ads.")
                        .font(Theme.label(14)).foregroundStyle(Theme.inkSoft).padding(.top, 6)
                }
                ScrollView {
                    VStack(spacing: 12) {
                        if wide {
                            HStack(alignment: .top, spacing: 12) {
                                playerCard(0)
                                playerCard(1)
                            }
                        } else {
                            playerCard(0)
                            playerCard(1)
                        }
                        rulesCard
                    }
                    .padding(12)
                    .padding(.bottom, 12)
                }
                // A fade over the rows under the pinned buttons, so they read as scrolled (QA playtest 1, M8).
                .overlay(alignment: .bottom) {
                    LinearGradient(colors: [Theme.paper.opacity(0), Theme.paper], startPoint: .top, endPoint: .bottom)
                        .frame(height: 18)
                        .allowsHitTesting(false)
                }
                HStack {
                    Button("Quick start") { model.startDuel(DuelOptions.quickStart(names: options.names)) }
                        .buttonStyle(PaperButtonStyle(height: m.button))
                    Spacer()
                    Button("FIGHT") { model.startDuel(cleaned()) }
                        .buttonStyle(GoldButtonStyle(height: m.button))
                        .accessibilityIdentifier("duelFight")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, m.barPadding)
                .background(Theme.cream)
            }
        }
        .background(Theme.paper.ignoresSafeArea())
        .onAppear {
            if !loaded {
                options = model.save.duel
                loaded = true
            }
        }
    }

    struct Metrics: Equatable {
        /// Player cards side by side.
        var wide: Bool
        /// A short screen (phone landscape): the tagline moves into the header and the
        /// pinned buttons shrink, so the cards keep their room.
        var compact: Bool
        var button: CGFloat
        var barPadding: CGFloat

        /// Height left for the scrolling cards under the header and over the buttons.
        func cardRoom(height: CGFloat) -> CGFloat {
            height - 48 - (compact ? 0 : 26) - (button + barPadding * 2)
        }
    }

    static func metrics(size: CGSize) -> Metrics {
        let wide = size.width >= size.height * 1.2
        let compact = size.height < 500
        return Metrics(wide: wide, compact: compact, button: compact ? 44 : 56, barPadding: compact ? 6 : 16)
    }

    private func playerCard(_ side: Int) -> some View {
        let colour = Theme.side(side, model.save.settings.colourSet)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Group {
                    if side == 0 { Circle().fill(colour) } else { Diamond().fill(colour) }
                }
                .frame(width: 24, height: 24)
                Text("PLAYER \(side + 1)").font(Theme.title(16)).foregroundStyle(colour)
                    .lineLimit(1).fixedSize()
                TextField("Player \(side + 1)", text: nameBinding(side))
                    .font(Theme.label(18))
                    .frame(minWidth: 60)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Player \(side + 1) name")
                Button {
                    options.names[side] = Self.sillyNames.randomElement() ?? "Player \(side + 1)"
                } label: {
                    Image(systemName: "dice.fill").font(.system(size: 20)).foregroundStyle(Theme.ink).frame(width: 44, height: 44)
                }
                .accessibilityLabel("Silly name for player \(side + 1)")
            }
            Picker("Fort", selection: Binding(get: { options.forts[side] }, set: { options.forts[side] = $0 })) {
                Text("Box 1").tag("box_1")
                Text("Box 2").tag("box_2")
                Text("Box 3").tag("box_3")
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Fort for player \(side + 1)")
            HStack {
                Text("Help").font(Theme.label(15)).foregroundStyle(Theme.ink)
                Picker("Help", selection: Binding(get: { options.help[side] }, set: { options.help[side] = $0 })) {
                    ForEach(HelpLevel.allCases) { h in Text(h.label).tag(h) }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("Help for player \(side + 1)")
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Theme.paper)
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(colour, lineWidth: 4))
        )
    }

    private var rulesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Map", selection: $options.map) {
                ForEach(model.catalog.maps) { m in Text(m.name).tag(m.id) }
            }
            row("Win by") {
                Picker("Win by", selection: $options.winBy) {
                    ForEach(WinBy.allCases) { w in Text(w.label).tag(w) }
                }.pickerStyle(.segmented)
            }
            row(options.winBy == .volley ? "Shots" : "Rounds") {
                Picker("Rounds", selection: $options.rounds) {
                    ForEach(options.winBy == .volley ? BattleSetup.volleyChoices : [12, 15, 18], id: \.self) { r in Text("\(r)").tag(r) }
                }.pickerStyle(.segmented)
            }
            row("Wind") {
                Picker("Wind", selection: $options.wind) {
                    ForEach(WindSetting.allCases) { w in Text(w.label).tag(w) }
                }.pickerStyle(.segmented)
            }
            row("Shells") {
                Picker("Shells", selection: $options.shells) {
                    ForEach(ShellRule.allCases) { s in Text(s.label).tag(s) }
                }.pickerStyle(.segmented)
            }
            row("Seats") {
                Picker("Seats", selection: $options.seats) {
                    ForEach(Seats.allCases) { s in Text(s.label).tag(s) }
                }.pickerStyle(.segmented)
            }
        }
        .padding(14)
        .panel()
    }

    private func row<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        HStack {
            Text(title).font(Theme.label(15)).foregroundStyle(Theme.ink).frame(width: 64, alignment: .leading)
            content()
        }
    }

    private func nameBinding(_ side: Int) -> Binding<String> {
        Binding(
            get: { options.names[side] },
            set: { options.names[side] = String($0.prefix(12)) }
        )
    }

    private func swapSides() {
        options.names.reverse()
        options.help.reverse()
        options.forts.reverse()
    }

    private func cleaned() -> DuelOptions {
        var o = options
        for i in 0..<2 where o.names[i].trimmingCharacters(in: .whitespaces).isEmpty {
            o.names[i] = "Player \(i + 1)"
        }
        if o.winBy == .knockout && ![12, 15, 18].contains(o.rounds) { o.rounds = 15 }
        if o.winBy == .volley && !BattleSetup.volleyChoices.contains(o.rounds) { o.rounds = 10 }
        return o
    }
}

extension DuelOptions {
    /// Fair picks for everything left, keeping the names.
    static func quickStart(names: [String]) -> DuelOptions {
        var o = DuelOptions()
        if names.count == 2 {
            o.names = names.map { $0.trimmingCharacters(in: .whitespaces).isEmpty ? "Player" : $0 }
        }
        o.shells = .quick
        return o
    }
}
