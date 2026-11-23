import SwiftUI

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            Theme.paper.ignoresSafeArea()
            switch model.screen {
            case .title:
                TitleView()
            case .map:
                MapView()
            case .battle:
                if let session = model.session {
                    BattleView(session: session)
                } else {
                    MapView()
                }
            case .results:
                ResultsView()
            case .skirmish:
                SkirmishSetupView()
            case .duelSetup:
                DuelSetupView()
            case .workshop:
                WorkshopView(model: model)
            }
            if model.showResume, model.screen == .map, let battle = model.save.battle {
                ResumeCard(battle: battle)
            }
            if model.resuming {
                // The saved fight replays off the main thread: block the map until it is ready (review 2, M1).
                LoadingCard()
            }
        }
        // Text follows the system size (Theme.scaled), capped so the HUD still fits (M4).
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .sheet(item: $model.preBattle) { level in
            PreBattleView(level: level)
                .environmentObject(model)
                .interactiveDismissDisabled()
        }
        .sheet(isPresented: $model.showSettings) {
            SettingsView()
                .environmentObject(model)
        }
        .alert(tx("app.title"), isPresented: Binding(
            get: { model.notice != nil },
            set: { if !$0 { model.notice = nil } }
        )) {
            Button(tx("common.close"), role: .cancel) {}
        } message: {
            Text(model.notice ?? "")
        }
    }
}

extension AppModel {
    /// A binding to one setting; every change applies at once and is saved at once.
    func setting<T: Equatable>(_ keyPath: WritableKeyPath<GameSettings, T>) -> Binding<T> {
        Binding(
            get: { self.save.settings[keyPath: keyPath] },
            set: { value in self.updateSettings { $0[keyPath: keyPath] = value } }
        )
    }

    /// A 0 to 100 setting as a slider value.
    func percentSetting(_ keyPath: WritableKeyPath<GameSettings, Int>) -> Binding<Double> {
        Binding(
            get: { Double(self.save.settings[keyPath: keyPath]) },
            set: { value in self.updateSettings { $0[keyPath: keyPath] = Int(value.rounded()) } }
        )
    }
}

// MARK: S1, First Run

struct TitleView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        GeometryReader { geo in
            let wide = geo.size.width > geo.size.height * 1.2
            ScrollView {
                VStack(spacing: 18) {
                    Spacer(minLength: wide ? 8 : 40)
                    if let icon = SpriteImages.image("app_icon-512") ?? SpriteImages.image("app_icon-1024") {
                        Image(uiImage: icon)
                            .resizable()
                            .scaledToFit()
                            .frame(width: wide ? 110 : 160, height: wide ? 110 : 160)
                            .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).stroke(Theme.ink, lineWidth: 3))
                            .accessibilityHidden(true)
                    }
                    Text(tx("app.title"))
                        .font(Theme.title(wide ? 38 : 44))
                        .foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text(tx("app.subtitle"))
                        .font(Theme.label(18))
                        .foregroundStyle(Theme.inkSoft)
                    VStack(spacing: 10) {
                        slider(tx("home.music"), model.percentSetting(\.music))
                        slider(tx("home.sound"), model.percentSetting(\.sound))
                        slider(tx("home.voices"), model.percentSetting(\.voices))
                    }
                    .padding(16)
                    .frame(maxWidth: 420)
                    .panel()
                    Text(tx("app.tagline"))
                        .font(Theme.label(17))
                        .foregroundStyle(Theme.ink)
                    Button(tx("home.play")) { model.play() }
                        .buttonStyle(GoldButtonStyle(height: 64, minWidth: 220))
                        .accessibilityIdentifier("play")
                        .accessibilityHint(tx("home.play_hint"))
                    Text(tx("app.promise"))
                        .font(Theme.label(15))
                        .foregroundStyle(Theme.inkSoft)
                    Spacer(minLength: 20)
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
                .frame(minHeight: geo.size.height)
            }
        }
        .background(Theme.sky.opacity(0.35).ignoresSafeArea())
    }

    private func slider(_ title: String, _ value: Binding<Double>) -> some View {
        HStack {
            Text(title).font(Theme.label(17)).foregroundStyle(Theme.ink).frame(width: 70, alignment: .leading)
            Slider(value: value, in: 0...100, step: 1)
                .tint(Theme.goldDark)
                .accessibilityLabel(title)
                .accessibilityValue(tx("common.percent", ["n": Int(value.wrappedValue)]))
            Text("\(Int(value.wrappedValue))").font(Theme.number(15)).frame(width: 36)
        }
    }
}

// MARK: S18, Carry on?

/// Covers the screen while a saved fight replays, so nothing else can start meanwhile.
struct LoadingCard: View {
    var body: some View {
        ZStack {
            Theme.ink.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView().tint(Theme.ink)
                Text(tx("common.loading_fight")).font(Theme.label(18)).foregroundStyle(Theme.ink)
            }
            .padding(24)
            .panel(corner: 24)
        }
        .contentShape(Rectangle())
        .onTapGesture {}
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isModal)
        .accessibilityIdentifier("loadingFight")
    }
}

struct ResumeCard: View {
    @EnvironmentObject private var model: AppModel
    let battle: BattleSave

    init(battle: BattleSave) {
        self.battle = battle
    }

    var body: some View {
        ZStack {
            Theme.ink.opacity(0.45).ignoresSafeArea()
            VStack(spacing: 14) {
                Text(tx("home.carry_on.title")).font(Theme.title(30)).foregroundStyle(Theme.ink).accessibilityAddTraits(.isHeader)
                Text(battle.title).font(Theme.label(18)).foregroundStyle(Theme.ink)
                Text(battle.turnName == tx("common.you") || battle.turnName == "You"
                     ? tx("home.carry_on.where_you", ["n": battle.round])
                     : tx("home.carry_on.where", ["n": battle.round, "name": battle.turnName]))
                    .font(Theme.label(16)).foregroundStyle(Theme.inkSoft)
                Button(tx("home.carry_on.yes")) { model.carryOn() }
                    .buttonStyle(GoldButtonStyle())
                    .accessibilityIdentifier("carryOn")
                Button(tx("home.carry_on.no")) { model.leaveIt() }
                    .buttonStyle(PaperButtonStyle())
            }
            .padding(24)
            .frame(maxWidth: 400)
            .panel(corner: 24)
            .padding(24)
        }
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
    }
}
