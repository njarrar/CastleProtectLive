import SwiftUI

// MARK: S9 Results and S25 Duel results

struct ResultsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var stamped = 0
    @State private var stampTimes: [Date?] = [nil, nil, nil]
    @State private var coinStart: Date?

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
                    if let why = info.explainer {
                        // "Double Pop!" says how the winner was picked (QA playtest 2, n5).
                        Text(why)
                            .font(Theme.label(15)).foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 420)
                            .accessibilityIdentifier("resultExplainer")
                    }
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
            .onAppear { model.resultsShown() }
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
                        Group {
                            if goal.done && i < stamped {
                                AnimSprite(clip: "ui_pennant_earn", size: 48, start: stampTimes[i],
                                           reduceMotion: model.save.settings.reduceMotion, fallback: "flag.fill")
                            } else {
                                SpriteIcon(name: "ui_pennant_empty", fallback: "flag", size: 48)
                                    .scaleEffect(0.85)
                            }
                        }
                        if i < info.result.pennantsNew.count && info.result.pennantsNew[i] && i < stamped {
                            Text("New!").font(Theme.label(12)).foregroundStyle(Theme.goldDark)
                        }
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
            HStack(spacing: 8) {
                AnimSprite(clip: "ui_button_coin_spin", size: 28, start: coinStart,
                           reduceMotion: model.save.settings.reduceMotion, fallback: "circle.circle.fill")
                Text("Buttons +\(info.result.buttons)").font(Theme.title(20)).foregroundStyle(Theme.ink)
            }
            .accessibilityElement(children: .combine)
        }
        if info.result.score.count >= 2 {
            Text("Siege Score \(info.result.score[0]) to \(info.result.score[1])")
                .font(Theme.label(15)).foregroundStyle(Theme.inkSoft)
        }
        if !info.won {
            if let broke = info.result.broke, broke.side == 0 {
                BrokeView(broke: broke)
            }
            Text("Wobbly, but standing. Try again?").font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
        }
        if let mine = info.result.stats.first {
            StatsRow(stats: mine)
        }
        // "Best shot" is always the side's own (rules 3 `stats[i].best_shot`), never the Rival's.
        if let best = info.result.bestShot(of: 0) {
            BestShotLine(label: "Your best shot", shot: best)
        }
        if !info.won, info.result.winner == 1, let theirs = info.result.bestShot {
            BestShotLine(label: "Their best shot", shot: theirs)
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
        if info.result.winner >= 0, info.result.winner < info.names.count, let best = info.result.bestShot {
            BestShotLine(label: "Best shot, \(info.names[info.result.winner])", shot: best)
        }
        let loser = 1 - info.result.winner
        if loser >= 0, loser < info.names.count, let theirs = info.result.bestShot(of: loser) {
            BestShotLine(label: "Best shot, \(info.names[loser])", shot: theirs)
        }
        if let broke = info.result.broke, broke.side >= 0, broke.side < info.names.count {
            BrokeView(broke: broke, who: info.names[broke.side])
        }
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
        stampTimes = [nil, nil, nil]
        coinStart = info.result.buttons > 0 ? Date() : nil
        guard !info.isDuel else { return }
        let earned = info.result.goals.isEmpty ? info.result.pennants : info.result.goals.prefix(3).count
        for i in 0..<earned {
            try? await Task.sleep(nanoseconds: i == 0 ? 400_000_000 : 500_000_000)
            if Task.isCancelled { return }
            if i < stampTimes.count { stampTimes[i] = Date() }
            stamped = i + 1
            if info.result.goals.isEmpty || info.result.goals[i].done {
                // The stamp lands on the animation's ding frame.
                try? await Task.sleep(nanoseconds: 110_000_000)
                model.sound.play("meta_pennant_stamp")
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
                    Picker(options.winBy == .volley ? "Shots each" : "Round cap", selection: $options.rounds) {
                        ForEach(options.winBy == .volley ? BattleSetup.volleyChoices : [12, 15, 18], id: \.self) { r in Text("\(r)").tag(r) }
                    }
                    .pickerStyle(.segmented)
                    Picker("Help", selection: $options.help) {
                        ForEach(HelpLevel.allCases) { h in Text(h.label).tag(h) }
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
            Button("Start") {
                var o = options
                let allowed = o.winBy == .volley ? BattleSetup.volleyChoices : [12, 15, 18]
                if !allowed.contains(o.rounds) { o.rounds = o.winBy == .volley ? 10 : 15 }
                model.startSkirmish(o)
            }
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

/// "What broke you": the last blow, the three that hurt most, and what was lost (core `result.broke`).
struct BrokeView: View {
    let broke: CoreBroke
    var who: String = "You"

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(who == "You" ? "What broke you" : "What broke \(who)")
                .font(Theme.title(18)).foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            if let last = broke.last, let line = Self.lastLine(last) {
                Text(line)
                    .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
            }
            ForEach(Array(broke.top.prefix(3).enumerated()), id: \.offset) { _, blow in
                let names = Self.names(blow)
                HStack {
                    Text(names.main)
                    if !names.detail.isEmpty { Text(names.detail).foregroundStyle(Theme.inkSoft) }
                    Spacer()
                    Text("\(blow.dmg)").font(Theme.number(15))
                }
                .font(Theme.label(14)).foregroundStyle(Theme.ink)
            }
            Text("Lost: \(broke.blocksLost) blocks, \(broke.kettleLost) kettle HP, \(broke.hobsBonked) Hobs Bonked")
                .font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
        }
        .padding(14)
        .frame(maxWidth: 420, alignment: .leading)
        .panel()
        .accessibilityElement(children: .combine)
    }
}

extension BrokeView {
    /// The shot's own name, or its id in words.
    nonisolated static func shotWords(_ blow: CoreBlow) -> String {
        blow.shotName.isEmpty ? blow.shot.replacingOccurrences(of: "_", with: " ").capitalized : blow.shotName
    }

    /// A blow's names, read from `by` (rules 4): a Hob's shot is "Grand Dumpling", "Marge
    /// Dumpling"; a field blow is the core's own name for it ("The Squall", "A fall", "Fatigue").
    nonisolated static func names(_ blow: CoreBlow) -> (main: String, detail: String) {
        if blow.byHob { return (shotWords(blow), blow.hobName) }
        let field = blow.hobName.isEmpty ? shotWords(blow) : blow.hobName
        return (field, "")
    }

    /// "Last blow: Grand Dumpling from Marge Dumpling, round 9", or "Last blow: The Squall, round 12".
    nonisolated static func lastLine(_ blow: CoreBlow) -> String? {
        let n = names(blow)
        guard !n.main.isEmpty else { return nil }
        let from = n.detail.isEmpty ? "" : " from \(n.detail)"
        return "Last blow: \(n.main)\(from), round \(blow.round)"
    }
}

/// One side's best shot: the shot, who fired it, the aim and the damage.
struct BestShotLine: View {
    let label: String
    let shot: CoreBestShot

    static func text(_ shot: CoreBestShot) -> String {
        let name = shot.shotName.isEmpty ? shot.shot.replacingOccurrences(of: "_", with: " ").capitalized : shot.shotName
        let who = shot.hobName.isEmpty ? "" : " by \(shot.hobName)"
        let aim = String(format: "%.1f\u{00B0}, power %d", Double(shot.angle) / 10, shot.power)
        return "\(name)\(who), round \(shot.round): \(shot.dmg) damage (\(aim))"
    }

    var body: some View {
        VStack(spacing: 2) {
            Text(label).font(Theme.title(16)).foregroundStyle(Theme.ink)
            Text(Self.text(shot)).font(Theme.label(14)).foregroundStyle(Theme.inkSoft).multilineTextAlignment(.center)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .panel(corner: 14)
        .accessibilityElement(children: .combine)
    }
}

/// The player's battle stats in one line.
struct StatsRow: View {
    let stats: CoreStats

    var body: some View {
        Text("Shots \(stats.shots)  Hits \(stats.hits)  Bonks \(stats.bonks)  Blocks dropped \(stats.blocksDropped)  Best streak \(stats.bestStreak)")
            .font(Theme.label(13))
            .foregroundStyle(Theme.inkSoft)
            .multilineTextAlignment(.center)
    }
}
