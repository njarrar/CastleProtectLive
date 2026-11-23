import SwiftUI
import UIKit

// MARK: S17, Settings. Every change applies at once; there is no Apply button.

struct SettingsView: View {
    enum Tab: String, CaseIterable, Identifiable {
        case sound, controls, assists, access, save, about
        var id: String { rawValue }
        /// The tab's title from `settings.<group>.title`.
        var title: String {
            switch self {
            case .sound: return tx("settings.sound.title")
            case .controls: return tx("settings.controls.title")
            case .assists: return tx("settings.help.title")
            case .access: return tx("settings.comfort.title")
            case .save: return tx("settings.save.title")
            case .about: return tx("settings.about.title")
            }
        }
    }

    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var tab = Tab.sound
    @State private var resetWord = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker(tx("settings.title"), selection: $tab) {
                    ForEach(Tab.allCases) { t in Text(t.title).tag(t) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                Form {
                    switch tab {
                    case .sound: soundTab
                    case .controls: controlsTab
                    case .assists: assistsTab
                    case .access: accessTab
                    case .save: saveTab
                    case .about: aboutTab
                    }
                }
            }
            .navigationTitle(tx("settings.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(tx("common.done")) { dismiss() }
                        .accessibilityIdentifier("settingsDone")
                }
            }
        }
    }

    @ViewBuilder
    private var soundTab: some View {
        Section {
            percentRow(tx("settings.sound.music"), \.music)
            percentRow(tx("settings.sound.sound"), \.sound)
            percentRow(tx("settings.sound.voices"), \.voices)
            Toggle(tx("settings.sound.subtitles"), isOn: toggleSetting(\.subtitles))
            Toggle(tx("settings.sound.mute"), isOn: toggleSetting(\.muteAll))
        }
    }

    @ViewBuilder
    private var controlsTab: some View {
        Section {
            // An iPad that allows Split View cannot lock its orientation, so the setting shows on iPhone only (M10).
            if UIDevice.current.userInterfaceIdiom != .pad {
                Picker(tx("settings.controls.rotation"), selection: model.setting(\.rotation)) {
                    ForEach(RotationSetting.allCases) { r in Text(r.label).tag(r) }
                }
            }
            Picker(tx("settings.controls.drag_mode"), selection: model.setting(\.dragMode)) {
                ForEach(DragMode.allCases) { d in Text(d.label).tag(d) }
            }
            Toggle(tx("settings.controls.quick_fire"), isOn: toggleSetting(\.quickFire))
            Toggle(tx("settings.controls.rival_fast"), isOn: toggleSetting(\.rivalTurnsFast))
            Toggle(tx("settings.controls.left_hand"), isOn: toggleSetting(\.leftHand))
            Toggle(tx("settings.controls.taps_only"), isOn: toggleSetting(\.tapOnly))
        }
    }

    @ViewBuilder
    private var assistsTab: some View {
        Section {
            Picker(tx("settings.help.difficulty"), selection: model.setting(\.preset)) {
                ForEach(Preset.allCases) { p in Text(p.label).tag(p) }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var accessTab: some View {
        Section {
            Picker(tx("settings.comfort.colour_set"), selection: model.setting(\.colourSet)) {
                ForEach(ColourSet.allCases) { c in Text(c.label).tag(c) }
            }
            Toggle(tx("settings.comfort.large_text"), isOn: toggleSetting(\.largeText))
            Toggle(tx("settings.comfort.reduce_motion"), isOn: toggleSetting(\.reduceMotion))
            Picker(tx("settings.comfort.screen_shake"), selection: model.setting(\.shake)) {
                Text("100%").tag(100)
                Text("50%").tag(50)
                Text(tx("common.off")).tag(0)
            }
            .pickerStyle(.segmented)
            Picker(tx("settings.comfort.haptics"), selection: model.setting(\.haptics)) {
                ForEach(HapticsLevel.allCases) { h in Text(h.label).tag(h) }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var saveTab: some View {
        Section(footer: Text(tx("settings.save.note"))) {
            LabeledContent(tx("map.pennants"), value: "\(model.save.progress.totalPennants)")
            LabeledContent(tx("map.buttons"), value: "\(model.save.progress.buttons)")
            LabeledContent(tx("settings.save.fight_in_progress"),
                           value: model.save.battle == nil ? tx("settings.save.fight_none") : tx("settings.save.fight_saved"))
        }
        Section(header: Text(tx("settings.save.reset")), footer: Text(tx("settings.save.reset_confirm"))) {
            TextField(tx("settings.save.reset_field"), text: $resetWord)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
            Button(tx("settings.save.reset"), role: .destructive) {
                model.resetProgress()
                resetWord = ""
                dismiss()
            }
            .disabled(resetWord != "RESET")
        }
    }

    @ViewBuilder
    private var aboutTab: some View {
        Section {
            Text(tx("settings.about.promise")).font(Theme.label(16))
            Text(tx("settings.about.privacy"))
            Text(tx("settings.about.version", ["version": Self.version, "rules": model.game.rulesVersion]))
        }
    }

    private func toggleSetting(_ keyPath: WritableKeyPath<GameSettings, Bool>) -> Binding<Bool> {
        Binding(
            get: { model.save.settings[keyPath: keyPath] },
            set: { value in
                model.updateSettings { $0[keyPath: keyPath] = value }
                model.sound.play("ui_toggle_on")
            }
        )
    }

    private func percentRow(_ title: String, _ keyPath: WritableKeyPath<GameSettings, Int>) -> some View {
        let binding = model.percentSetting(keyPath)
        return HStack {
            Text(title).frame(width: 70, alignment: .leading)
            Slider(value: binding, in: 0...100, step: 1)
                .accessibilityLabel(title)
                .accessibilityValue(tx("common.percent", ["n": Int(binding.wrappedValue)]))
            Text("\(Int(binding.wrappedValue))").monospacedDigit().frame(width: 36)
        }
    }

    static var version: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "0.1"
        let b = info?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }
}
