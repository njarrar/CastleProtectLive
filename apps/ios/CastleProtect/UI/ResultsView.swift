import SwiftUI

// MARK: S9 Results and S25 Duel results

struct ResultsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var stamped = 0

    var body: some View {
        if let info = model.lastResult {
            ScrollView {
                VStack(spacing: 18) {
                    Spacer(minLength: 24)
                    Text(info.headline)
                        .font(Theme.title(40))
                        .foregroundStyle(info.isDuel ? Theme.side(max(0, info.result.winner)) : Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("resultTitle")
                    Text("Round \(info.result.round)").font(Theme.label(17)).foregroundStyle(Theme.inkSoft)
                    if info.isDuel {
                        duelBody(info)
                    } else {
                        campaignBody(info)
                    }
                    Spacer(minLength: 24)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
            }
            .background(Theme.paper.ignoresSafeArea())
            .task(id: info.title) { await stampPennants(info) }
        } else {
            MapView()
        }
    }

    @ViewBuilder
    private func campaignBody(_ info: ResultInfo) -> some View {
        let goals = info.result.goals.isEmpty
            ? info.goals.enumerated().map { GoalView(label: $0.element, done: info.won && $0.offset < info.result.pennants) }
            : info.result.goals
        if !goals.isEmpty {
            HStack(spacing: 16) {
                ForEach(Array(goals.prefix(3).enumerated()), id: \.offset) { i, goal in
                    VStack(spacing: 6) {
                        SpriteIcon(name: goal.done && i < stamped ? "ui_pennant" : "ui_pennant_empty",
                                   fallback: goal.done && i < stamped ? "flag.fill" : "flag", size: 48)
                            .scaleEffect(goal.done && i < stamped ? 1 : 0.85)
                        Text(goal.label).font(Theme.label(13)).foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.center).frame(width: 100)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(goal.label), \(goal.done ? "earned" : "missed")")
                }
            }
            .padding(16)
            .panel()
        }
        if info.result.buttons > 0 {
            Text("Buttons +\(info.result.buttons)").font(Theme.title(20)).foregroundStyle(Theme.ink)
        }
        if !info.won {
            Text("Wobbly, but standing. Try again?").font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
        }
        HStack(spacing: 12) {
            Button("Map") { model.screen = .map }.buttonStyle(PaperButtonStyle())
            if info.won {
                Button("Retry") { model.retry() }.buttonStyle(PaperButtonStyle())
                if info.setup.mode == .campaign {
                    Button("Next") { model.nextLevel() }
                        .buttonStyle(GoldButtonStyle(minWidth: 120))
                        .accessibilityIdentifier("next")
                } else {
                    Button("Rematch") { model.retry() }.buttonStyle(GoldButtonStyle(minWidth: 120))
                }
            } else {
                Button("Retry") { model.retry() }
                    .buttonStyle(GoldButtonStyle(minWidth: 120))
                    .accessibilityIdentifier("retry")
            }
        }
    }

    @ViewBuilder
    private func duelBody(_ info: ResultInfo) -> some View {
        HStack(spacing: 24) {
            score(info.names[0], model.tonight[0], side: 0, help: info.setup.help.first ?? .none)
            Text("Tonight").font(Theme.label(15)).foregroundStyle(Theme.inkSoft)
            score(info.names[1], model.tonight[1], side: 1, help: info.setup.help.count > 1 ? info.setup.help[1] : .none)
        }
        .padding(16)
        .panel()
        Text("Good game, both of you.").font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
        VStack(spacing: 10) {
            Button("Rematch") { model.rematch(swapSides: false) }
                .buttonStyle(GoldButtonStyle())
                .accessibilityIdentifier("rematch")
            HStack(spacing: 10) {
                Button("Swap sides") { model.rematch(swapSides: true) }.buttonStyle(PaperButtonStyle())
                Button("Change setup") { model.screen = .duelSetup }.buttonStyle(PaperButtonStyle())
                Button("Map") { model.leaveDuel() }.buttonStyle(PaperButtonStyle())
            }
        }
    }

    private func score(_ name: String, _ wins: Int, side: Int, help: HelpLevel) -> some View {
        VStack(spacing: 4) {
            Text("\(name) \(help.marks)").font(Theme.title(18)).foregroundStyle(Theme.side(side))
            Text("\(wins)").font(Theme.number(36)).foregroundStyle(Theme.ink)
        }
        .accessibilityElement(children: .combine)
    }

    private func stampPennants(_ info: ResultInfo) async {
        stamped = 0
        guard !info.isDuel else { return }
        let earned = info.result.goals.isEmpty ? info.result.pennants : info.result.goals.prefix(3).count
        for i in 0..<earned {
            try? await Task.sleep(nanoseconds: i == 0 ? 400_000_000 : 500_000_000)
            if Task.isCancelled { return }
            stamped = i + 1
            if info.result.goals.isEmpty || info.result.goals[i].done {
                model.sound.play("pennant_stamp")
                model.haptics.play(.pennant)
            }
        }
    }
}

// MARK: S16, Skirmish setup

struct SkirmishSetupView: View {
    @EnvironmentObject private var model: AppModel
    @State private var options = SkirmishOptions()
    @State private var loaded = false

    var body: some View {
        VStack(spacing: 0) {
            ScreenHeader(title: "Skirmish") { model.screen = .map }
            Form {
                Section("Field") {
                    Picker("Map", selection: $options.map) {
                        ForEach(model.catalog.maps) { m in Text(m.name).tag(m.id) }
                    }
                    Picker("Rival", selection: $options.preset) {
                        ForEach(Preset.allCases) { p in Text(p.label).tag(p) }
                    }
                    .pickerStyle(.segmented)
                }
                Section("Rules") {
                    Picker("Win by", selection: $options.winBy) {
                        ForEach(WinBy.allCases) { w in Text(w.label).tag(w) }
                    }
                    Picker("Round cap", selection: $options.rounds) {
                        ForEach([12, 15, 18], id: \.self) { r in Text("\(r)").tag(r) }
                    }
                    .pickerStyle(.segmented)
                    Picker("Wind", selection: $options.wind) {
                        ForEach(WindSetting.allCases) { w in Text(w.label).tag(w) }
                    }
                    .pickerStyle(.segmented)
                    Picker("Shells", selection: $options.shells) {
                        ForEach(ShellRule.allCases) { s in Text(s.label).tag(s) }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            Button("Start") { model.startSkirmish(options) }
                .buttonStyle(GoldButtonStyle())
                .accessibilityIdentifier("startSkirmish")
                .padding(16)
        }
        .background(Theme.paper.ignoresSafeArea())
        .onAppear {
            if !loaded {
                options = model.save.skirmish
                loaded = true
            }
        }
    }
}

/// Back button and title, shared by the full-screen setup screens.
struct ScreenHeader: View {
    let title: String
    let back: () -> Void

    var body: some View {
        HStack {
            Button(action: back) {
                Image(systemName: "chevron.left").font(.system(size: 20, weight: .bold)).foregroundStyle(Theme.ink)
                    .frame(width: 48, height: 48)
            }
            .accessibilityLabel("Back")
            Text(title).font(Theme.title(26)).foregroundStyle(Theme.ink).accessibilityAddTraits(.isHeader)
            Spacer()
        }
        .padding(.horizontal, 8)
        .background(Theme.cream)
    }
}
