import SwiftUI

// MARK: S23, Couch Duel setup: one screen, two player cards, a rules row

struct DuelSetupView: View {
    @EnvironmentObject private var model: AppModel
    @State private var options = DuelOptions()
    @State private var loaded = false

    /// The one Couch Duel name list (`names.duel` in content/text.json).
    static var sillyNames: [String] { GameText.shared.pool("names.duel") }

    var body: some View {
        GeometryReader { geo in
            let m = Self.metrics(size: geo.size)
            let wide = m.wide
            VStack(spacing: 0) {
                HStack {
                    ScreenHeader(title: tx("setup.duel_title")) { model.leaveDuel() }
                    if m.compact {
                        Text(tx("modes.duel.line"))
                            .font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
                            .lineLimit(1).minimumScaleFactor(0.8)
                    }
                    Button(tx("setup.swap_sides")) { swapSides() }
                        .buttonStyle(PaperButtonStyle(height: 48))
                        .padding(.trailing, 12)
                }
                .background(Theme.cream)
                if !m.compact {
                    Text(tx("modes.duel.line") + " " + tx("app.promise"))
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
                    Button(tx("setup.quick_start")) { model.startDuel(DuelOptions.quickStart(names: options.names)) }
                        .buttonStyle(PaperButtonStyle(height: m.button))
                    Spacer()
                    Button(tx("common.fight").uppercased()) {
                        model.sound.play("ui_confirm")
                        model.startDuel(cleaned())
                    }
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
                if model.workshopFortRows(minSeats: 4) == nil {
                    for i in 0..<options.forts.count where options.forts[i] == "workshop" {
                        options.forts[i] = i == 0 ? "box_2" : "box_1"
                    }
                }
                loaded = true
            }
        }
        .onChange(of: options.winBy) { next in
            let allowed = next == .volley ? BattleSetup.volleyChoices : [12, 15, 18]
            if !allowed.contains(options.rounds) {
                options.rounds = next == .volley ? 10 : 15
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
                Text(tx("setup.player_label", ["n": side + 1]).uppercased()).font(Theme.title(16)).foregroundStyle(Theme.sideInk(side, model.save.settings.colourSet))
                    .lineLimit(1).fixedSize()
                TextField(tx("setup.player_label", ["n": side + 1]), text: nameBinding(side))
                    .font(Theme.label(18))
                    .frame(minWidth: 60)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .accessibilityLabel(tx("setup.player_name", ["n": side + 1]))
                Button {
                    options.names[side] = Self.rollName(not: options.names)
                } label: {
                    Image(systemName: "dice.fill").font(.system(size: 20)).foregroundStyle(Theme.ink).frame(width: 48, height: 48)
                }
                .accessibilityLabel(tx("setup.silly_name_hint", ["n": side + 1]))
            }
            Picker(tx("setup.fort"), selection: Binding(get: { options.forts[side] }, set: { options.forts[side] = $0 })) {
                Text(model.catalog.kitName("box_1")).tag("box_1")
                Text(model.catalog.kitName("box_2")).tag("box_2")
                Text(model.catalog.kitName("box_3")).tag("box_3")
                if model.workshopFortRows(minSeats: 4) != nil {
                    Text(model.save.fort?.name ?? tx("workshop.my_fort")).tag("workshop")
                }
            }
            .pickerStyle(.segmented)
            .accessibilityLabel(tx("setup.fort") + ", " + tx("setup.player_label", ["n": side + 1]))
            HStack {
                Text(tx("setup.help.label")).font(Theme.label(15)).foregroundStyle(Theme.ink)
                Picker(tx("setup.help.label"), selection: Binding(get: { options.help[side] }, set: { options.help[side] = $0 })) {
                    ForEach(HelpLevel.allCases) { h in Text(h.label).tag(h) }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel(tx("setup.help.label") + ", " + tx("setup.player_label", ["n": side + 1]))
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
            Picker(tx("setup.map"), selection: $options.map) {
                ForEach(model.catalog.maps) { m in Text(m.name).tag(m.id) }
            }
            row(tx("setup.win_by.label")) {
                Picker(tx("setup.win_by.label"), selection: $options.winBy) {
                    ForEach(WinBy.allCases) { w in Text(w.label).tag(w) }
                }.pickerStyle(.segmented)
            }
            row(options.winBy == .volley ? tx("setup.shots_each") : tx("setup.rounds")) {
                Picker(tx("setup.rounds"), selection: $options.rounds) {
                    ForEach(options.winBy == .volley ? BattleSetup.volleyChoices : [12, 15, 18], id: \.self) { r in Text("\(r)").tag(r) }
                }.pickerStyle(.segmented)
            }
            row(tx("setup.wind.label")) {
                Picker(tx("setup.wind.label"), selection: $options.wind) {
                    ForEach(WindSetting.allCases) { w in Text(w.label).tag(w) }
                }.pickerStyle(.segmented)
            }
            row(tx("setup.shells.label")) {
                Picker(tx("setup.shells.label"), selection: $options.shells) {
                    ForEach(ShellRule.allCases) { s in Text(s.label).tag(s) }
                }.pickerStyle(.segmented)
            }
            row(tx("setup.seats.label")) {
                Picker(tx("setup.seats.label"), selection: $options.seats) {
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

    /// A name from the one list, never the one either player has now.
    static func rollName(not taken: [String]) -> String {
        let pool = sillyNames.filter { !taken.contains($0) }
        return pool.randomElement() ?? sillyNames.randomElement() ?? ""
    }

    private func swapSides() {
        options.names.reverse()
        options.help.reverse()
        options.forts.reverse()
    }

    private func cleaned() -> DuelOptions {
        var o = options
        for i in 0..<2 where o.names[i].trimmingCharacters(in: .whitespaces).isEmpty {
            o.names[i] = tx("setup.player_label", ["n": i + 1])
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
            o.names = names.enumerated().map { i, name in
                name.trimmingCharacters(in: .whitespaces).isEmpty ? tx("setup.player_label", ["n": i + 1]) : name
            }
        }
        o.shells = .quick
        return o
    }
}
