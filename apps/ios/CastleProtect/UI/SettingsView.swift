import SwiftUI
import UIKit

// MARK: S17, Settings. Every change applies at once; there is no Apply button.

struct SettingsView: View {
    enum Tab: String, CaseIterable, Identifiable {
        case sound = "Sound", controls = "Controls", assists = "Assists", access = "Access", save = "Save", about = "About"
        var id: String { rawValue }
    }

    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var tab = Tab.sound
    @State private var resetWord = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Section", selection: $tab) {
                    ForEach(Tab.allCases) { t in Text(t.rawValue).tag(t) }
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
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("settingsDone")
                }
            }
        }
    }

    @ViewBuilder
    private var soundTab: some View {
        Section {
            // Music, Voices and Subtitles come back when the game has music and voices (M12).
            percentRow("Sound", \.sound)
            Toggle("Mute all", isOn: model.setting(\.muteAll))
        }
    }

    @ViewBuilder
    private var controlsTab: some View {
        Section {
            // An iPad that allows Split View cannot lock its orientation, so the setting shows on iPhone only (M10).
            if UIDevice.current.userInterfaceIdiom != .pad {
                Picker("Rotation", selection: model.setting(\.rotation)) {
                    ForEach(RotationSetting.allCases) { r in Text(r.label).tag(r) }
                }
            }
            Picker("Drag mode", selection: model.setting(\.dragMode)) {
                ForEach(DragMode.allCases) { d in Text(d.label).tag(d) }
            }
            Toggle("Quick Fire (finger up fires)", isOn: model.setting(\.quickFire))
            Toggle("Rival turns at 2x", isOn: model.setting(\.rivalTurnsFast))
            Toggle("Left-hand layout", isOn: model.setting(\.leftHand))
            Toggle("Tap only (no hold to repeat)", isOn: model.setting(\.tapOnly))
        }
    }

    @ViewBuilder
    private var assistsTab: some View {
        Section {
            Picker("Difficulty", selection: model.setting(\.preset)) {
                ForEach(Preset.allCases) { p in Text(p.label).tag(p) }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var accessTab: some View {
        Section {
            Picker("Colour set", selection: model.setting(\.colourSet)) {
                ForEach(ColourSet.allCases) { c in Text(c.label).tag(c) }
            }
            Toggle("Large text", isOn: model.setting(\.largeText))
            Toggle("Reduce motion", isOn: model.setting(\.reduceMotion))
            Picker("Haptics", selection: model.setting(\.haptics)) {
                ForEach(HapticsLevel.allCases) { h in Text(h.label).tag(h) }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var saveTab: some View {
        Section(footer: Text("The game saves by itself at the start of every turn.")) {
            LabeledContent("Pennants", value: "\(model.save.progress.totalPennants)")
            LabeledContent("Buttons", value: "\(model.save.progress.buttons)")
            LabeledContent("Battle in progress", value: model.save.battle == nil ? "None" : "Saved")
        }
        Section(header: Text("Reset progress"), footer: Text("Type RESET to confirm. Settings are kept.")) {
            TextField("Type RESET", text: $resetWord)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
            Button("Reset progress", role: .destructive) {
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
            Text("Free forever. No ads. Nothing to buy.").font(Theme.label(16))
            LabeledContent("Privacy", value: "Data Not Collected")
            LabeledContent("Version", value: Self.version)
            LabeledContent("Rules core", value: model.bridge.name)
            LabeledContent("Save counter", value: "\(model.save.counter)")
        }
    }

    private func percentRow(_ title: String, _ keyPath: WritableKeyPath<GameSettings, Int>) -> some View {
        let binding = model.percentSetting(keyPath)
        return HStack {
            Text(title).frame(width: 70, alignment: .leading)
            Slider(value: binding, in: 0...100, step: 1)
                .accessibilityLabel(title)
                .accessibilityValue("\(Int(binding.wrappedValue)) percent")
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
