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
                        .foregroundStyle(info.isDuel ? Theme.sideInk(max(0, info.result.winner), model.save.settings.colourSet) : Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityIdentifier("resultTitle")
                    Text(tx("results.round", ["n": info.result.round])).font(Theme.label(17)).foregroundStyle(Theme.inkSoft)
                    if let why = info.explainer {
                        // How it was won or lost (text.md, Results); Double Pop says how the winner was picked.
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
                            Text(tx("pennants.new")).font(Theme.label(12)).foregroundStyle(Theme.orangeInk)
                        }
                        Text(goal.label).font(Theme.label(13)).foregroundStyle(Theme.ink)
                            .multilineTextAlignment(.center).frame(width: 100)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(tx(goal.done ? "pennants.got" : "pennants.not_got", ["goal": goal.label]))
                }
            }
            .padding(16)
            .panel()
        }
        if info.result.buttons > 0 {
            HStack(spacing: 8) {
                AnimSprite(clip: "ui_button_coin_spin", size: 28, start: coinStart,
                           reduceMotion: model.save.settings.reduceMotion, fallback: "circle.circle.fill")
                Text(tx("results.buttons", ["n": info.result.buttons])).font(Theme.title(20)).foregroundStyle(Theme.ink)
                    .accessibilityLabel(tx("results.buttons_spoken", ["n": info.result.buttons]))
            }
            .accessibilityElement(children: .combine)
            if !info.won {
                Text(tx("results.buttons_loss_note")).font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
            }
        }
        if info.result.score.count >= 2 {
            Text(tx("results.score", ["a": info.result.score[0], "b": info.result.score[1]]))
                .font(Theme.label(15)).foregroundStyle(Theme.inkSoft)
        }
        if info.won, let signOff = info.signOff {
            // A campaign win: the Rival signs off (text.md, Results).
            Text(signOff)
                .font(Theme.label(16)).italic().foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
        }
        if !info.won {
            if let broke = info.result.broke, broke.side == 0 {
                BrokeView(broke: broke)
            }
            if let verdict = info.verdict {
                // A loss: one line from Hetty, named once she has been met (1-7).
                VStack(spacing: 2) {
                    if info.verdictNamed {
                        Text(tx("results.loss.verdict_by")).font(Theme.label(13)).foregroundStyle(Theme.inkSoft)
                    }
                    Text(verdict).font(Theme.label(16)).foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: 420)
                .accessibilityElement(children: .combine)
            }
        }
        if let mine = info.result.stats.first {
            StatsRow(stats: mine)
        }
        // "Best shot" is always the side's own (rules 3 `stats[i].best_shot`), never the Rival's.
        if let best = info.result.bestShot(of: 0) {
            BestShotLine(label: tx("results.best_shot_yours"), shot: best)
        }
        if !info.won, info.result.winner == 1, let theirs = info.result.bestShot {
            BestShotLine(label: tx("results.best_shot_theirs"), shot: theirs)
        }
        HStack(spacing: 12) {
            Button(tx("results.map")) { model.screen = .map }.buttonStyle(PaperButtonStyle())
            if info.won {
                Button(tx("results.again")) { model.retry() }.buttonStyle(PaperButtonStyle())
                if info.setup.mode == .campaign {
                    Button(tx("results.next")) { model.nextLevel() }
                        .buttonStyle(GoldButtonStyle(minWidth: 120))
                        .accessibilityIdentifier("next")
                } else {
                    Button(tx("results.rematch")) { model.retry() }.buttonStyle(GoldButtonStyle(minWidth: 120))
                }
            } else {
                Button(tx("results.again")) { model.retry() }
                    .buttonStyle(GoldButtonStyle(minWidth: 120))
                    .accessibilityIdentifier("retry")
            }
        }
    }

    @ViewBuilder
    private func duelBody(_ info: ResultInfo) -> some View {
        HStack(spacing: 24) {
            score(info.names[0], model.tonight[0], side: 0, help: info.setup.help.first ?? .none)
            Text(tx("results.duel.tonight")).font(Theme.label(15)).foregroundStyle(Theme.inkSoft)
            score(info.names[1], model.tonight[1], side: 1, help: info.setup.help.count > 1 ? info.setup.help[1] : .none)
        }
        .padding(16)
        .panel()
        if info.result.winner >= 0, info.result.winner < info.names.count, let best = info.result.bestShot {
            BestShotLine(label: info.names[info.result.winner], shot: best)
        }
        let loser = 1 - info.result.winner
        if loser >= 0, loser < info.names.count, let theirs = info.result.bestShot(of: loser) {
            BestShotLine(label: info.names[loser], shot: theirs)
        }
        if let broke = info.result.broke, broke.side >= 0, broke.side < info.names.count {
            BrokeView(broke: broke, who: info.names[broke.side])
        }
        Text(tx("results.duel.good_game")).font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
        VStack(spacing: 10) {
            Button(tx("results.rematch")) { model.rematch(swapSides: false) }
                .buttonStyle(GoldButtonStyle())
                .accessibilityIdentifier("rematch")
            HStack(spacing: 10) {
                Button(tx("results.swap_sides")) { model.rematch(swapSides: true) }.buttonStyle(PaperButtonStyle())
                Button(tx("results.change_setup")) { model.screen = .duelSetup }.buttonStyle(PaperButtonStyle())
                Button(tx("results.map")) { model.leaveDuel() }.buttonStyle(PaperButtonStyle())
            }
        }
    }

    private func score(_ name: String, _ wins: Int, side: Int, help: HelpLevel) -> some View {
        VStack(spacing: 4) {
            Text("\(name) \(help.marks)").font(Theme.title(18)).foregroundStyle(Theme.sideInk(side, model.save.settings.colourSet))
            Text("\(wins)").font(Theme.number(36)).foregroundStyle(Theme.ink)
        }
        .accessibilityElement(children: .combine)
    }

    private func stampPennants(_ info: ResultInfo) async {
        stamped = 0
        stampTimes = [nil, nil, nil]
        coinStart = info.result.buttons > 0 ? Date() : nil
        if info.result.buttons > 0 { model.sound.play("ui_buttons_tick") }
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
                if Task.isCancelled { return }
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
            ScreenHeader(title: tx("setup.skirmish_title")) { model.screen = .map }
            Form {
                Section(tx("setup.map")) {
                    Picker(tx("setup.map"), selection: $options.map) {
                        ForEach(model.catalog.maps) { m in Text(m.name).tag(m.id) }
                    }
                    Picker(tx("setup.difficulty.label"), selection: $options.preset) {
                        ForEach(Preset.allCases) { p in Text(p.label).tag(p) }
                    }
                    .pickerStyle(.segmented)
                }
                Section(tx("setup.win_by.label")) {
                    Picker(tx("setup.win_by.label"), selection: $options.winBy) {
                        ForEach(WinBy.allCases) { w in Text(w.label).tag(w) }
                    }
                    Picker(options.winBy == .volley ? tx("setup.shots_each") : tx("setup.rounds"), selection: $options.rounds) {
                        ForEach(options.winBy == .volley ? BattleSetup.volleyChoices : [12, 15, 18], id: \.self) { r in Text("\(r)").tag(r) }
                    }
                    .pickerStyle(.segmented)
                    Picker(tx("setup.help.label"), selection: $options.help) {
                        ForEach(HelpLevel.allCases) { h in Text(h.label).tag(h) }
                    }
                    .pickerStyle(.segmented)
                    Picker(tx("setup.wind.label"), selection: $options.wind) {
                        ForEach(WindSetting.allCases) { w in Text(w.label).tag(w) }
                    }
                    .pickerStyle(.segmented)
                    Picker(tx("setup.shells.label"), selection: $options.shells) {
                        ForEach(ShellRule.allCases) { s in Text(s.label).tag(s) }
                    }
                }
                Section(tx("map.modes")) {
                    Button {
                        model.startDaily()
                    } label: {
                        HStack {
                            Label(tx("modes.daily.name"), systemImage: model.dailyDoneToday ? "checkmark.seal.fill" : "calendar")
                            Spacer()
                            Text(model.dailyDoneToday ? tx("modes.daily.done") : tx("common.play"))
                                .foregroundStyle(Theme.inkSoft)
                        }
                    }
                    Button {
                        model.startTestYard()
                    } label: {
                        HStack {
                            Label(tx("modes.yard.name"), systemImage: "target")
                            Spacer()
                            Text(tx("modes.yard.line")).foregroundStyle(Theme.inkSoft)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            if model.workshopFortRows(minSeats: 4) != nil {
                Label(tx("level_card.fort_yours"), systemImage: "hammer.fill")
                    .font(Theme.label(13))
                    .foregroundStyle(Theme.inkSoft)
                    .padding(.top, 4)
            }
            Button(tx("common.fight")) {
                var o = options
                let allowed = o.winBy == .volley ? BattleSetup.volleyChoices : [12, 15, 18]
                if !allowed.contains(o.rounds) { o.rounds = o.winBy == .volley ? 10 : 15 }
                model.sound.play("ui_confirm")
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
        .onChange(of: options.winBy) { next in
            let allowed = next == .volley ? BattleSetup.volleyChoices : [12, 15, 18]
            if !allowed.contains(options.rounds) {
                options.rounds = next == .volley ? 10 : 15
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
            .accessibilityLabel(tx("common.back"))
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
    /// The side's name in a Couch Duel; nil for the player.
    var who: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(who.map { tx("results.duel.what_broke", ["name": $0]) } ?? tx("results.what_broke_you"))
                .font(Theme.title(18)).foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            if let last = broke.last, let line = Self.lastLine(last) {
                Text(line)
                    .font(Theme.label(14)).foregroundStyle(Theme.inkSoft)
            }
            ForEach(Array(broke.top.prefix(3).enumerated()), id: \.offset) { i, blow in
                Text(tx("results.top_blows", ["rank": i + 1, "blow": Self.blowWords(blow), "n": blow.dmg]))
                    .font(Theme.label(14)).foregroundStyle(Theme.ink)
            }
            Text(Self.tally(broke))
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

    /// A blow in words from `by` (`results.blow.<by>`): a Hob's shot is "Marge's Grand Dumpling"
    /// (short name, never cut at a space); a field blow is the string table's word for it
    /// ("the Squall", "a fall", "the Creaks"), not the core's.
    nonisolated static func blowWords(_ blow: CoreBlow) -> String {
        let text = GameText.shared
        if blow.byHob {
            let shot = shotWords(blow)
            guard !blow.hobName.isEmpty else { return text.t("results.blow.shot_only", ["shot": shot]) }
            let who = ContentCatalog.shared.hobShort(named: blow.hobName)
            return text.t("results.blow.hob", ["who": who, "shot": shot])
        }
        let by = blow.by.isEmpty ? "prop" : blow.by
        return text.byId("results.blow", by, ["shot": shotWords(blow)], or: shotWords(blow))
    }

    /// A blow's names for older callers: the main words and the Hob, if any.
    nonisolated static func names(_ blow: CoreBlow) -> (main: String, detail: String) {
        if blow.byHob { return (shotWords(blow), ContentCatalog.shared.hobShort(named: blow.hobName)) }
        return (blowWords(blow), "")
    }

    /// "Last blow: Marge's Grand Dumpling, Round 9" (`results.last_blow`).
    nonisolated static func lastLine(_ blow: CoreBlow) -> String? {
        let words = blowWords(blow)
        guard !words.isEmpty else { return nil }
        return GameText.shared.t("results.last_blow", ["blow": words, "n": blow.round])
    }

    /// "Kettle 120. Blocks 9. Bonked: 2." (`results.tally`).
    nonisolated static func tally(_ broke: CoreBroke) -> String {
        if broke.hobsBonked == 0 {
            return GameText.shared.t("results.tally_nobody", ["kettle": broke.kettleLost, "blocks": broke.blocksLost])
        }
        return GameText.shared.t("results.tally", ["kettle": broke.kettleLost, "blocks": broke.blocksLost, "hobs": broke.hobsBonked])
    }
}

/// One side's best shot: the shot, who fired it, the aim and the damage.
struct BestShotLine: View {
    let label: String
    let shot: CoreBestShot

    /// "Best shot: Marge, 48. Angle 45.0, power 62." (`results.best_shot_long`), naming the Hob
    /// by its short name, then the shot.
    static func text(_ shot: CoreBestShot) -> String {
        let name = shot.shotName.isEmpty ? shot.shot.replacingOccurrences(of: "_", with: " ").capitalized : shot.shotName
        let hob = shot.hobName.isEmpty ? name : ContentCatalog.shared.hobShort(named: shot.hobName)
        let angle = String(format: "%.1f", Double(shot.angle) / 10)
        let line = tx("results.best_shot_long", ["hob": hob, "n": shot.dmg, "angle": angle, "power": shot.power])
        return shot.hobName.isEmpty ? line : "\(line) \(name)."
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
        Text(tx("results.stats", ["shots": stats.shots, "hits": stats.hits, "bonks": stats.bonks,
                                  "blocks": stats.blocksDropped, "streak": stats.bestStreak]))
            .font(Theme.label(13))
            .foregroundStyle(Theme.inkSoft)
            .multilineTextAlignment(.center)
    }
}
