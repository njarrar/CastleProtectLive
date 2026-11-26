import SwiftUI
import UIKit

/// Kettle HP gauge: Tier-3 frosted parchment pill with brass pressure dial and bold % readout.
struct KettleGauge: View {
    let percent: Int
    let side: Int
    var compact = false
    var colours: ColourSet = .brickabrac
    var label: String? = nil

    private var isCritical: Bool { percent > 0 && percent <= 25 }

    var body: some View {
        HStack(spacing: compact ? 4 : 5) {
            BrassKettleDialIcon(percent: percent, side: side, colours: colours, size: compact ? 22 : 26)
            Text("\(percent)%")
                .font(Theme.number(compact ? 14 : 16))
                .foregroundStyle(isCritical ? Theme.badInk : Theme.ink)
                .lineLimit(1)
        }
        .padding(.horizontal, compact ? 7 : 9)
        .frame(minWidth: compact ? 60 : 68, minHeight: compact ? 30 : 34)
        .hudTier3Pill(corner: 12, fill: isCritical ? Theme.badBg : Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(isCritical ? Theme.badBorder : Color.clear, lineWidth: 1.5)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(tx("hud.kettle_spoken", ["name": label ?? colours.sideName(side), "n": percent]))
    }
}

/// Crew pips: round for side 0, diamond for side 1, filled by HP; grey and hollow only when
/// Bonked. A squashed Hob keeps its live HP fill with a dashed ring (QA playtest 2, N2).
struct PipRow: View {
    let crew: [HobView]
    let side: Int
    var colours: ColourSet = .brickabrac
    var size: CGFloat = 20

    var body: some View {
        HStack(spacing: 4) {
            ForEach(crew) { hob in
                pip(hob)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spokenLabel)
    }

    /// "3 of 4 Hobs up", with the squashed count when there is one.
    private var spokenLabel: String {
        let up = crew.filter { !$0.isOut }.count
        let squashed = crew.filter { $0.isCrushed }.count
        let line = tx("hud.hobs_up", ["n": up, "total": crew.count])
        return squashed > 0 ? line + ". " + tx("hud.hobs_squashed", ["n": squashed]) : line
    }

    /// How much of a pip is filled: hollow (0) when Bonked, live HP sliver when standing/squashed (iOS-M9).
    static func fill(_ hob: HobView) -> Double {
        if hob.isOut { return 0 }
        return max(0.08, hob.hpFraction)
    }

    @ViewBuilder
    private func pip(_ hob: HobView) -> some View {
        let down = hob.isOut
        let colour = down ? Theme.slate : Theme.side(side, colours)
        ZStack(alignment: .bottom) {
            pipShape.fill(Theme.paper)
            if !down {
                pipShape.fill(colour)
                    .mask(alignment: .bottom) {
                        Rectangle().frame(height: size * CGFloat(Self.fill(hob)))
                    }
            }
            if hob.isCrushed {
                pipShape.stroke(Theme.ink, style: StrokeStyle(lineWidth: 2, dash: [3, 2]))
            } else {
                pipShape.stroke(down ? Theme.slate : Theme.ink, lineWidth: 2)
            }
        }
        .frame(width: size, height: size)
    }

    private var pipShape: AnyShape {
        side == 0 ? AnyShape(Circle()) : AnyShape(Diamond())
    }
}

struct Diamond: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        p.closeSubpath()
        return p
    }
}

/// Tier-3 frosted round telemetry pill: `R10/18 · Ph1` + explicit amber `Fatigue` badge
/// (Plate 1 & 2) so players never misread Phase as Player 1 and always spot Fatigue immediately.
struct RoundLabel: View {
    let hud: HudState
    var compact = false

    private var primaryRoundText: String {
        if hud.isYard { return tx("hud.test_yard") }
        if compact { return tx("hud.round_short", ["n": hud.round, "cap": hud.roundCap]) }
        return hud.roundText
    }

    var body: some View {
        HStack(spacing: compact ? 4 : 6) {
            if hud.isVolley {
                Text(hud.volleyText)
            } else if hud.squallRound > 0 {
                SpriteIcon(name: "ui_squall", fallback: "cloud.bolt.fill", size: compact ? 16 : 18)
                Text(tx("hud.squall.count", ["n": hud.squallRound]))
            } else {
                Text(primaryRoundText)
                if let phase = hud.bossPhase {
                    Text("\u{00B7} " + tx("hud.boss.phase", ["n": phase]))
                        .foregroundStyle(Theme.orangeInk)
                }
                if let fatigue = hud.fatigueText {
                    HStack(spacing: 2) {
                        FatigueFlameIcon(active: hud.fatigue, size: compact ? 12 : 14)
                        Text(fatigue)
                    }
                    .font(Theme.label(12))
                    .foregroundStyle(hud.fatigue ? Theme.ink : Theme.orangeInk)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(hud.fatigue ? Theme.brassHi : Theme.cream)
                            .overlay(Capsule().stroke(hud.fatigue ? Theme.orangeInk : Theme.sepiaBorder, lineWidth: 1))
                    )
                }
                if hud.squallIn > 0 && hud.squallIn <= 3 {
                    SpriteIcon(name: "ui_squall", fallback: "cloud.fill", size: (compact ? 12 : 14) + CGFloat(4 - hud.squallIn) * 2)
                    Text(tx("hud.squall.in", ["n": hud.squallIn]))
                        .foregroundStyle(Theme.inkSoft)
                }
            }
            if hud.bossJam > 0 {
                Text(tx("hud.boss.jammed", ["n": hud.bossJam])).foregroundStyle(Theme.inkSoft)
            }
        }
        .font(Theme.label(compact ? 12 : 14))
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .foregroundStyle(hud.squallRound > 0 ? Color.white : Theme.ink)
        .padding(.horizontal, compact ? 7 : 10)
        .frame(minHeight: compact ? 30 : 34)
        .hudTier3Pill(corner: 12, fill: hud.squallRound > 0 ? Theme.flattenerSlate : Theme.paper)
        .accessibilityElement(children: .combine)
    }
}

/// Wind pennant, arrow and number, with the next front's forecast (Tier-3 telemetry).
struct WindView: View {
    let wind: Int
    let forecast: Int

    private var spokenLabel: String {
        let now = wind == 0 ? tx("hud.wind.none") : tx(wind > 0 ? "hud.wind.right" : "hud.wind.left", ["n": abs(wind)])
        let next = forecast == 0 ? tx("hud.wind.next_none")
            : tx(forecast > 0 ? "hud.wind.next_right" : "hud.wind.next_left", ["n": abs(forecast)])
        return "\(now). \(next)."
    }

    var body: some View {
        HStack(spacing: 6) {
            WindPennantIcon(wind: wind, size: 20)
            arrow(wind, big: true)
            Text("\u{2192}")
                .font(Theme.label(12))
                .foregroundStyle(Theme.inkSoft.opacity(0.65))
            arrow(forecast, big: false).opacity(0.75)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spokenLabel)
    }

    private func arrow(_ value: Int, big: Bool) -> some View {
        HStack(spacing: 2) {
            if value == 0 {
                Image(systemName: "circle.fill").font(.system(size: big ? 7 : 5))
            } else {
                Image(systemName: value > 0 ? "arrow.right" : "arrow.left")
                    .font(.system(size: big ? (value.magnitude > 6 ? 16 : (value.magnitude > 3 ? 14 : 12)) : 10, weight: .heavy))
            }
            Text("\(abs(value))").font(Theme.number(big ? 15 : 12))
        }
        .foregroundStyle(Theme.ink)
    }
}

/// A Hob portrait medallion in the crew column or row: Tier-1 beveled brass selection glow,
/// HP ring, rest cog badge, `>= 48 pt` touch target floor, grey when Bonked.
struct HobPortrait: View {
    let hob: HobView
    let side: Int
    let selected: Bool
    var size: CGFloat = 48
    var colours: ColourSet = .brickabrac
    /// A Rival's Hob: the Rival portrait (`portrait_<name>_rival`). Couch Duel player 2 stays orange.
    var rivalLook = false
    let action: () -> Void

    var body: some View {
        let down = hob.isOut
        let d = max(48, size)
        Button(action: action) {
            ZStack {
                if selected {
                    Circle()
                        .fill(
                            LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                           startPoint: .top, endPoint: .bottom)
                        )
                        .shadow(color: Theme.brassDeep.opacity(0.55), radius: 0, x: 0, y: 2.5)
                } else {
                    Circle().fill(Theme.parchmentCard)
                }
                Circle().fill(Theme.paper).padding(selected ? 4 : 2)
                if let img = SpriteImages.portrait(id: hob.def, name: hob.name, side: side, rival: rivalLook) {
                    Image(uiImage: img).resizable().scaledToFit().padding(selected ? 6 : 4)
                        .saturation(down ? 0 : 1)
                } else {
                    Text(String(hob.shortName.prefix(1))).font(Theme.title(d * 0.38)).foregroundStyle(Theme.ink)
                }
                Circle()
                    .trim(from: 0, to: CGFloat(down ? 0 : hob.hpFraction))
                    .stroke(Theme.side(side, colours), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(selected ? 4 : 2.5)
                Circle().stroke(Theme.ink, lineWidth: selected ? 2.5 : 1.8)
                if hob.rest > 0 {
                    HStack(spacing: 1) {
                        RestCogIcon(size: 9)
                        Text("\(hob.rest)")
                            .font(Theme.number(12))
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 4)
                    .frame(minWidth: 22, minHeight: 18)
                    .background(Capsule().fill(Theme.ink))
                    .offset(x: d * 0.34, y: d * 0.34)
                }
                if hob.isCrushed {
                    // Squashed: a star badge, the portrait stays live (QA playtest 2, N2).
                    Image(systemName: "star.fill")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(Theme.brassHi)
                        .frame(width: 18, height: 18)
                        .background(Circle().fill(Theme.ink))
                        .offset(x: -d * 0.36, y: -d * 0.36)
                        .accessibilityHidden(true)
                }
            }
            .frame(width: d, height: d)
            .overlay(alignment: .top) {
                if selected {
                    Image(systemName: "arrowtriangle.down.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.brassMid)
                        .shadow(color: Theme.ink, radius: 0.5, x: 0, y: 1)
                        .offset(y: -8)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(down)
        .accessibilityLabel(Self.spoken(hob) + (selected ? ". " + tx("hud.hob_selected") : ""))
    }
}

extension HobPortrait {
    /// "Marge, Lobber, 120 of 120 HP" (`hud.hob_chip`), with the state when there is one.
    static func spoken(_ hob: HobView) -> String {
        let vars: [String: any CustomStringConvertible] = [
            "hob": hob.shortName, "class": ContentCatalog.shared.className(hob.cls), "hp": max(0, hob.hp), "max": hob.hpMax,
        ]
        if hob.stateWords.isEmpty { return tx("hud.hob_chip", vars) }
        var all = vars
        all["state"] = hob.stateWords
        return tx("hud.hob_chip_state", all)
    }
}

/// One shot chip in the tray: custom sprite or bespoke `KnackFallbackIcon` (zero blank squares!),
/// `>= 48 pt` tap target, zero badge-over-text overlap, Tier-1 beveled brass selection, and long-press inspect.
struct ShotChipView: View {
    let chip: ShotChip
    let selected: Bool
    var size: CGFloat = 54
    var onInspect: (() -> Void)? = nil
    let action: () -> Void

    var body: some View {
        let tileW = max(56, size + 6)
        let tileH = max(50, size)
        let iconKey = chip.art.isEmpty ? chip.id : chip.art
        Button(action: action) {
            VStack(spacing: 1) {
                // Dedicated icon zone keeps top-left Rest Cogs & top-right uses badge completely clear of the label!
                ZStack {
                    if let img = SpriteImages.shotIcon(chip) {
                        Image(uiImage: img)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFit()
                            .frame(width: tileH * 0.52, height: tileH * 0.52)
                    } else {
                        KnackFallbackIcon(shotId: iconKey, kind: chip.kind, size: tileH * 0.52)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: tileH * 0.56)

                Text(chip.name)
                    .font(Theme.label(12))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.68)
                    .padding(.horizontal, 4)
                    .padding(.bottom, 2)
            }
            .frame(width: tileW, height: tileH)
            .background(
                Group {
                    if selected {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .fill(LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                                 startPoint: .top, endPoint: .bottom))
                            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .stroke(Color.white.opacity(0.45), lineWidth: 1.1).padding(2))
                            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .stroke(Theme.ink, lineWidth: 2.5))
                            .shadow(color: Theme.brassDeep.opacity(0.45), radius: 0, x: 0, y: 2)
                    } else {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .fill(chip.ready ? Theme.parchmentCard : Theme.cream.opacity(0.75))
                            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .stroke(Theme.sepiaBorder.opacity(0.30), style: StrokeStyle(lineWidth: 1, dash: [3, 2])).padding(2))
                            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous)
                                .stroke(Theme.sepiaBorder, lineWidth: 1.5))
                    }
                }
            )
            .overlay(alignment: .topTrailing) {
                if chip.uses >= 0 {
                    Text("\(chip.uses)")
                        .font(Theme.number(12))
                        .foregroundStyle(.white)
                        .frame(minWidth: 18, minHeight: 18)
                        .padding(.horizontal, 2)
                        .background(Capsule().fill(Theme.ink))
                        .offset(x: 4, y: -4)
                }
            }
            .overlay(alignment: .topLeading) {
                if chip.weight > 0 {
                    HStack(spacing: 1) {
                        ForEach(0..<chip.weight, id: \.self) { _ in
                            RestCogIcon(size: 10)
                        }
                    }
                    .padding(.leading, 3)
                    .padding(.top, 2)
                }
            }
            .overlay(alignment: .topTrailing) {
                // Match Class bonus star sits cleanly below the uses pill on the right edge, NEVER over the first letter!
                if chip.best && chip.ready {
                    Image(systemName: "star.fill")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Theme.brassHi)
                        .frame(width: 15, height: 15)
                        .background(Circle().fill(Theme.ink))
                        .offset(x: 4, y: chip.uses >= 0 ? 15 : -4)
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: .bottom) {
                if !chip.ready {
                    Text(ShotChip.shortReason(why: chip.why))
                        .font(Theme.label(12))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4)
                        .background(Capsule().fill(Theme.inkSoft))
                        .offset(y: 7)
                        .accessibilityHidden(true)
                }
            }
            .opacity(chip.ready ? 1 : 0.65)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.35).onEnded { _ in onInspect?() }
        )
        .accessibilityLabel(Self.spoken(chip) + (selected ? ". " + tx("hud.hob_selected") : ""))
        .accessibilityValue(chip.ready ? "" : (chip.text ?? ShotChip.shortReason(why: chip.why)))
        .accessibilityHint(onInspect != nil ? tx("shell_card.a11y_open", ["shot": chip.name]) : "")
    }
}

extension ShotChipView {
    /// "Clodpot, Light" or "Clodpot, Light, 1 left" (`hud.shot_chip`, `hud.doodad_chip`).
    static func spoken(_ chip: ShotChip) -> String {
        if chip.kind == "doodad" {
            let card = ContentCatalog.shared.doodads[chip.id]?.line ?? ""
            return tx("hud.doodad_chip", ["doodad": chip.name, "card": card])
        }
        let weight = tx(chip.weight >= 2 ? "shell_card.weight.heavy" : (chip.weight == 1 ? "shell_card.weight.medium" : "shell_card.weight.light"))
        if chip.uses >= 0 { return tx("hud.shot_chip_left", ["shot": chip.name, "weight": weight, "n": chip.uses]) }
        return tx("hud.shot_chip", ["shot": chip.name, "weight": weight])
    }
}

/// Decision-grade Shell Inspect Card (Plate 5): custom artwork, Weight & Rest Cogs pill,
/// visual Damage bar + Blast/Dig/Tunnel/Split/Bounce stats, the "Good at" line from content/text.json,
/// golden "Best with a <Class>" strip with Hob portrait, and the content card line.
struct ShellInspectCard: View {
    let chip: ShotChip
    let catalog: ContentCatalog
    /// Content id of the Hob the card is for (the Knack line names it).
    var selectedHob: String? = nil
    var onDismiss: (() -> Void)? = nil

    private var info: ContentCatalog.Shot? {
        catalog.shots[chip.art] ?? catalog.shots[chip.id]
    }

    private var iconKey: String { chip.art.isEmpty ? chip.id : chip.art }

    /// The Hob whose Knack this is, by short name.
    private var knackHob: String {
        if let def = selectedHob, !def.isEmpty { return catalog.hobShort(def) }
        return tx("common.you")
    }

    private var weightLabel: String {
        if let info { return info.weightLabel }
        return tx(chip.weight >= 2 ? "shell_card.weight.heavy" : (chip.weight == 1 ? "shell_card.weight.medium" : "shell_card.weight.light"))
    }

    private var restCogs: Int { info?.restCogs ?? chip.weight }

    private var damageValue: Int { info?.damage ?? 0 }

    /// True when the card has a damage bar or any stat pill to show.
    private var hasStats: Bool {
        if damageValue > 0 { return true }
        let cells: Int = info?.maxCells ?? 0
        let splits: Int = info?.splitCount ?? 0
        let hops: Int = info?.bounces ?? 0
        return cells > 0 || splits > 1 || hops > 0
    }

    private var damageFillFraction: CGFloat {
        CGFloat(min(1.0, max(0.08, Double(damageValue) / 85.0)))
    }

    private var matchClassTitle: String? {
        if let t = info?.matchClassTitle { return t }
        if let m = chip.matchClass, !m.isEmpty { return m == "all" ? tx("shell_card.any_class") : catalog.className(m) }
        return nil
    }

    private var matchedHobArt: String? {
        if let art = info?.matchedHobArt { return art }
        switch (chip.matchClass ?? "").lowercased() {
        case "lobber": return "marge"
        case "zinger": return "quill"
        case "scatterjack": return "jax"
        case "delver": return "grub"
        case "boinker": return "bobbin"
        case "patcher": return "hetty"
        default: return nil
        }
    }

    private var descriptionText: String {
        if let card = info?.card, !card.isEmpty { return card }
        if chip.kind == "doodad" {
            return catalog.doodads[chip.id]?.line ?? tx("shell_card.doodad")
        }
        return tx("shell_card.trick")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Custom artwork medallion + Title + Weight/Rest Cogs badge
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Theme.cream)
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.sepiaBorder, lineWidth: 1.5))
                    if let img = SpriteImages.shotIcon(chip) {
                        Image(uiImage: img).resizable().interpolation(.high).scaledToFit().padding(6)
                    } else {
                        KnackFallbackIcon(shotId: iconKey, kind: chip.kind, size: 46)
                    }
                }
                .frame(width: 60, height: 60)

                VStack(alignment: .leading, spacing: 4) {
                    Text(chip.name)
                        .font(Theme.title(20))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(2)
                    HStack(spacing: 6) {
                        HStack(spacing: 3) {
                            Text(weightLabel)
                            Text("\u{00B7}")
                            if restCogs == 0 {
                                Text(tx("shell_card.rest.none"))
                            } else {
                                ForEach(0..<restCogs, id: \.self) { _ in RestCogIcon(size: 11) }
                                Text(GameText.shared.plural("shell_card.rest", restCogs))
                            }
                        }
                        .font(Theme.label(12))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Theme.cream).overlay(Capsule().stroke(Theme.sepiaBorder, lineWidth: 1)))
                    }
                }
                Spacer(minLength: 4)
                if let onDismiss {
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.ink)
                            .frame(width: 48, height: 48)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(tx("shell_card.a11y_close"))
                }
            }

            // Visual Damage Bar + Secondary Stats (Blast / Tunnel / Splits / Bounces / Threads)
            if hasStats {
                VStack(alignment: .leading, spacing: 6) {
                    if damageValue > 0 {
                        HStack {
                            Text(info?.damageTypeId == "mend" ? tx("shell_card.stats.mend") : tx("shell_card.stats.damage"))
                                .font(Theme.label(13))
                                .foregroundStyle(Theme.inkSoft)
                            Spacer()
                            Text("\(damageValue) \(info?.damageTypeLabel ?? tx("shell_card.damage_types.blast"))")
                                .font(Theme.number(14))
                                .foregroundStyle(Theme.ink)
                        }
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Theme.cream)
                                Capsule()
                                    .fill(LinearGradient(
                                        colors: info?.damageTypeId == "mend"
                                            ? [Theme.kettleGlow, Theme.goodBg]
                                            : [Theme.brassMid, Theme.orange],
                                        startPoint: .leading, endPoint: .trailing
                                    ))
                                    .frame(width: max(12, g.size.width * damageFillFraction))
                                Capsule().stroke(Theme.ink.opacity(0.45), lineWidth: 1)
                            }
                        }
                        .frame(height: 10)
                    }

                    HStack(spacing: 6) {
                        if let band = info?.band, !band.isEmpty {
                            statPill(tx("shell_card.stats.blast", ["band": GameText.shared.complete("shell_card.bands.\(band)") ?? band.capitalized]))
                        }
                        if let maxCells = info?.maxCells, maxCells > 0 {
                            statPill(tx("shell_card.stats.tunnel", ["n": maxCells]))
                        }
                        if let splits = info?.splitCount, splits > 1 {
                            statPill(tx("shell_card.stats.splits", ["n": splits]))
                        }
                        if let bounces = info?.bounces, bounces > 0 {
                            statPill(GameText.shared.plural("shell_card.stats.bounces", bounces))
                        }
                        if info?.tags.contains("threads") == true {
                            statPill(tx("shell_card.stats.threads"))
                        }
                    }
                }
            }

            // The sentence-case "Good at" line from content (naming-decisions.md, Copy).
            if let goodAt = catalog.goodAt(iconKey) {
                Text(goodAt)
                    .font(Theme.label(13))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Highlighted golden "Best with a <Class>" strip with matching Hob portrait
            if let clsTitle = matchClassTitle {
                HStack(spacing: 8) {
                    if let art = matchedHobArt, let img = SpriteImages.portrait(id: art, name: art, side: 0) {
                        Image(uiImage: img)
                            .resizable().scaledToFit()
                            .frame(width: 28, height: 28)
                            .background(Circle().fill(Theme.paper))
                            .overlay(Circle().stroke(Theme.ink, lineWidth: 1.5))
                    } else {
                        Image(systemName: "star.fill")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(Theme.ink)
                    }
                    Text(chip.matchClass == "all" || info?.matchClass == "all"
                         ? clsTitle
                         : tx("shell_card.best_with", ["class": clsTitle, "pct": 10]))
                        .font(Theme.label(13))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(2)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .hudTier1(corner: 10)
            } else if chip.kind == "knack" {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.ink)
                    Text(tx("shell_card.knack", ["hob": knackHob]))
                        .font(Theme.label(13))
                        .foregroundStyle(Theme.ink)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .hudTier1(corner: 10)
            }

            // Plain-English tactical card line
            Text(descriptionText)
                .font(Theme.label(14))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Theme.paper)
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Theme.sepiaBorder.opacity(0.55), lineWidth: 1))
                )
        }
        .padding(16)
        .frame(maxWidth: 360)
        .panel(corner: 20, fill: Theme.parchmentCard)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("shellInspectCard")
    }

    private func statPill(_ label: String) -> some View {
        Text(label)
            .font(Theme.label(12))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Capsule().fill(Theme.paper).overlay(Capsule().stroke(Theme.sepiaBorder, lineWidth: 1)))
    }
}

/// The aim readout: angle to 0.1 degree and power. Tap opens Fine Tune; VoiceOver swipe adjusts angle.
struct ReadoutView: View {
    let hud: HudState
    var big = false
    var onAdjust: ((Int, Int) -> Void)? = nil
    let action: () -> Void

    private var spokenAim: String {
        guard hud.aim.set else { return tx("hud.no_aim") }
        let shown = HudState.displayAngleTenths(hud.aim.angle, side: hud.hudSide)
        let deg = String(format: "%.1f", Double(shown) / 10)
        return tx("hud.aim_readout", ["angle": deg, "power": hud.aim.power])
    }

    var body: some View {
        Button(action: action) {
            Text("\(hud.angleText) | \(hud.powerText)")
                .font(Theme.number(big ? 24 : 18))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 12)
                .frame(minWidth: 112, minHeight: 48)
                .hudTier2Panel(corner: 14)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spokenAim)
        .accessibilityHint(tx("hud.fine_tune"))
        .accessibilityAdjustableAction { direction in
            guard let onAdjust else { return }
            switch direction {
            case .increment: onAdjust(5, 0)
            case .decrement: onAdjust(-5, 0)
            @unknown default: break
            }
        }
        .accessibilityIdentifier("readout")
    }
}

/// Fine Tune: angle and power keys plus Recall. Tap steps 0.1 degree or 1 power; hold repeats.
struct FineTunePad: View {
    @ObservedObject var session: BattleSession
    var key: CGFloat = 48

    var body: some View {
        let tapOnly = session.settings.tapOnly
        let k = max(48, key)
        HStack(spacing: 4) {
            VStack(spacing: 4) {
                tuneKey("minus", tx("hud.angle_down"), tapOnly, size: k) { session.nudge(angle: -1, power: 0) }
                tuneKey("chevron.down", tx("hud.power_down"), tapOnly, size: k) { session.nudge(angle: 0, power: -1) }
            }
            VStack(spacing: 2) {
                Text(session.hud.angleText)
                    .font(Theme.number(15))
                    .accessibilityLabel(tx("hud.angle") + " " + String(format: "%.1f", Double(HudState.displayAngleTenths(session.hud.aim.angle, side: session.hud.hudSide)) / 10))
                    .accessibilityAdjustableAction { dir in
                        _ = session.nudge(angle: dir == .increment ? 5 : -5, power: 0)
                    }
                Text(session.hud.powerText)
                    .font(Theme.number(15))
                    .accessibilityLabel(tx("hud.power") + " \(session.hud.aim.power)")
                    .accessibilityAdjustableAction { dir in
                        _ = session.nudge(angle: 0, power: dir == .increment ? 2 : -2)
                    }
                Button {
                    session.recall()
                } label: {
                    Text("R").font(Theme.title(15))
                        .frame(width: 48, height: 48)
                        .hudTier2Panel(corner: 10, fill: Theme.cream)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tx("hud.last_aim_hint"))
            }
            .foregroundStyle(Theme.ink)
            .frame(width: 64)
            VStack(spacing: 4) {
                tuneKey("plus", tx("hud.angle_up"), tapOnly, size: k) { session.nudge(angle: 1, power: 0) }
                tuneKey("chevron.up", tx("hud.power_up"), tapOnly, size: k) { session.nudge(angle: 0, power: 1) }
            }
        }
        .padding(6)
        .hudTier2Panel(corner: 16)
    }

    private func tuneKey(_ symbol: String, _ name: String, _ tapOnly: Bool, size: CGFloat, _ action: @escaping () -> Bool) -> some View {
        RepeatButton(tapOnly: tapOnly, accessibilityName: name, action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(Theme.ink)
                .frame(width: size, height: size)
                .hudTier2Panel(corner: 12, fill: Theme.cream)
        }
    }
}

/// Walk left and right (hold to walk), with the Steam gauge (Wide mode Tier-2 panel).
struct WalkPad: View {
    @ObservedObject var session: BattleSession
    var key: CGFloat = 48

    var body: some View {
        let hud = session.hud
        let k = max(48, key)
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                walkKey(-1, "ui_walk_left", "arrowtriangle.left.fill", tx("hud.walk_left"), size: k)
                walkKey(1, "ui_walk_right", "arrowtriangle.right.fill", tx("hud.walk_right"), size: k)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.paper)
                    Capsule().fill(Theme.kettleGlow)
                        .frame(width: g.size.width * CGFloat(max(0, min(1, Double(hud.steam) / Double(max(1, hud.steamMax))))))
                    Capsule().stroke(Theme.sepiaBorder, lineWidth: 1.5)
                    Text(tx("hud.steam", ["n": hud.steam])).font(Theme.number(12)).foregroundStyle(Theme.ink).padding(.leading, 6)
                        .minimumScaleFactor(0.75).lineLimit(1)
                }
            }
            .frame(height: 16)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(tx("hud.steam", ["n": hud.steam]))
        }
        .frame(width: k * 2 + 10)
    }

    private func walkKey(_ dx: Int, _ sprite: String, _ symbol: String, _ name: String, size: CGFloat) -> some View {
        RepeatButton(delay: 0.12, rate: 10, fastRate: 10, tapOnly: session.settings.tapOnly, accessibilityName: name,
                     action: { session.walk(dx) }) {
            SpriteIcon(name: sprite, fallback: symbol, size: size * 0.56)
                .frame(width: size, height: size)
                .hudTier2Panel(corner: 12, fill: Theme.cream)
        }
    }
}

/// Integrated horizontal Portrait Walk + Steam + Readout rail tucked inside the stitched bottom dock
/// (`layout.walkRail`), keeping the player's entire cutaway fort 100% unobstructed (Plate 2).
struct WalkRail: View {
    @ObservedObject var session: BattleSession

    var body: some View {
        let hud = session.hud
        let show = hud.humanTurn && !session.paused && !hud.inFlight
        let dragging = session.dragging
        let ratio = CGFloat(max(0, min(1, Double(hud.steam) / Double(max(1, hud.steamMax)))))
        HStack(spacing: 6) {
            // Steam pill + integrated [<] Walk [>] keys (all >= 48 pt height)
            HStack(spacing: 4) {
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.paper)
                    GeometryReader { g in
                        Capsule().fill(Theme.kettleGlow).frame(width: g.size.width * ratio)
                    }
                    Capsule().stroke(Theme.sepiaBorder, lineWidth: 1.2)
                    Text(tx("hud.steam", ["n": hud.steam]))
                        .font(Theme.number(12))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.horizontal, 8)
                }
                .frame(width: 78, height: 28)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(tx("hud.steam", ["n": hud.steam]))

                railWalkKey(-1, "ui_walk_left", "arrowtriangle.left.fill", tx("hud.walk_left"))
                railWalkKey(1, "ui_walk_right", "arrowtriangle.right.fill", tx("hud.walk_right"))
            }
            .opacity(show ? (dragging ? 0.25 : 1) : 0.45)
            .allowsHitTesting(show && !dragging)
            .disabled(!show)

            Spacer(minLength: 4)

            ReadoutView(hud: hud, onAdjust: { _ = session.nudge(angle: $0, power: $1) }) {
                session.toggleFineTune()
            }
            .opacity(show ? 1 : 0.45)
            .allowsHitTesting(show && !dragging)
            .disabled(!show)
        }
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            Rectangle()
                .fill(Theme.parchmentCard)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.sepiaBorder).frame(height: 1.5)
                }
        )
    }

    private func railWalkKey(_ dx: Int, _ sprite: String, _ symbol: String, _ name: String) -> some View {
        RepeatButton(delay: 0.12, rate: 10, fastRate: 10, tapOnly: session.settings.tapOnly, accessibilityName: name,
                     action: { session.walk(dx) }) {
            SpriteIcon(name: sprite, fallback: symbol, size: 22)
                .frame(width: 48, height: 44)
                .hudTier2Panel(corner: 10, fill: Theme.cream)
        }
    }
}

/// Tier-1 beveled brass `FIRE` medallion: acts on finger up inside the button.
/// Locked until a Hob, a shot and an aim exist. With the Hob dug in it is Shove Off (15 Steam);
/// with a Doodad picked it is Use (H2).
struct FireButton: View {
    let hud: HudState
    var size: CGFloat = 76
    var armedDoodad: String? = nil
    let action: () -> Void

    private var mode: String {
        if armedDoodad != nil { return "use" }
        if hud.dugIn { return "shove" }
        return "fire"
    }

    private var live: Bool {
        guard hud.humanTurn else { return false }
        switch mode {
        case "fire": return hud.canFire
        case "shove": return hud.steam >= hud.shoveOffCost
        default: return true
        }
    }

    var body: some View {
        let d = max(56, size)
        Button(action: action) {
            ZStack {
                if live {
                    Circle()
                        .fill(
                            LinearGradient(colors: [Theme.brassHi, Theme.brassMid, Theme.brassLo],
                                           startPoint: .top, endPoint: .bottom)
                        )
                    // Inner brass highlight bevel & riveted rim
                    Circle()
                        .stroke(Color.white.opacity(0.55), lineWidth: 2)
                        .padding(3.5)
                    Circle()
                        .stroke(Theme.brassDeep.opacity(0.45), style: StrokeStyle(lineWidth: 1.2, dash: [2, 6]))
                        .padding(6.5)
                } else {
                    Circle().fill(Theme.cream)
                    Circle()
                        .stroke(Theme.sepiaBorder.opacity(0.45), style: StrokeStyle(lineWidth: 1.2, dash: [4, 3]))
                        .padding(4)
                }
                Circle().stroke(Theme.ink, lineWidth: 2.8)
                VStack(spacing: 0) {
                    switch mode {
                    case "shove":
                        Image(systemName: "mountain.2.fill").font(.system(size: d * 0.2))
                        Text(tx("hud.shove_off.button").uppercased()).font(.system(size: d * 0.15, weight: .heavy, design: .rounded))
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text("\(hud.shoveOffCost)").font(.system(size: d * 0.15, weight: .heavy, design: .rounded))
                    case "use":
                        Image(systemName: "bag.fill").font(.system(size: d * 0.2))
                        Text(tx("common.use").uppercased()).font(.system(size: d * 0.27, weight: .heavy, design: .rounded))
                            .lineLimit(1).minimumScaleFactor(0.6)
                    default:
                        Text(tx("hud.fire").uppercased()).font(.system(size: d * 0.27, weight: .heavy, design: .rounded))
                            .lineLimit(1).minimumScaleFactor(0.6)
                    }
                }
                .foregroundStyle(live ? Theme.ink : Theme.inkSoft.opacity(0.65))
            }
            .frame(width: d, height: d)
            .shadow(color: live ? Theme.brassDeep.opacity(0.60) : Theme.ink.opacity(0.18), radius: 0, x: 0, y: live ? 3.5 : 2)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!hud.humanTurn)
        .accessibilityLabel(mode == "shove" ? tx("hud.shove_off.hint", ["n": hud.shoveOffCost])
                            : (mode == "use" ? tx("hud.doodad.use", ["doodad": DoodadNames.name(armedDoodad ?? "")]) : tx("hud.fire")))
        .accessibilityValue(live ? "" : (hud.humanTurn
                                         ? (mode == "shove" ? tx("hud.shove_off.no_steam")
                                                            : tx("hud.fire_locked", ["why": hud.fireText ?? tx("hud.no_hob")]))
                                         : tx("hud.why.not_planning")))
        .accessibilityIdentifier("fire")
    }
}

/// Pass: spend the Action doing nothing, so a turn can always end (H2).
/// Requires a brief 350 ms hold (or tap confirmation in Tap-only / VoiceOver mode) so a stray tap never forfeits a turn.
struct PassButton: View {
    @ObservedObject var session: BattleSession
    var size: CGFloat = 48
    var compact: Bool = false
    @State private var holding = false
    @State private var holdProgress: CGFloat = 0
    @State private var holdTask: Task<Void, Never>? = nil
    @State private var confirmPass = false

    private var needsConfirm: Bool {
        session.settings.tapOnly || UIAccessibility.isVoiceOverRunning
    }

    var body: some View {
        let enabled = session.hud.humanTurn
        Group {
            if needsConfirm {
                Button {
                    confirmPass = true
                } label: {
                    passFace
                }
                .buttonStyle(.plain)
            } else {
                passFace
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                guard enabled else { return }
                                if hypot(value.translation.width, value.translation.height) > 36 {
                                    cancelHold()
                                    return
                                }
                                guard !holding else { return }
                                startHold()
                            }
                            .onEnded { _ in cancelHold() }
                    )
                    .onDisappear { cancelHold() }
                    .accessibilityElement(children: .ignore)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction { confirmPass = true }
            }
        }
        .confirmationDialog(tx("hud.pass.confirm"), isPresented: $confirmPass, titleVisibility: .visible) {
            Button(tx("hud.pass.yes")) { _ = session.pass() }
            Button(tx("common.cancel"), role: .cancel) {}
        }
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.5)
        .accessibilityLabel(tx("hud.pass.hint"))
        .accessibilityIdentifier("pass")
    }

    private var passFace: some View {
        Text(tx("hud.pass.button"))
            .font(Theme.label(compact ? 12 : 13))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, compact ? 8 : 10)
            .frame(minWidth: max(size, 52), minHeight: compact ? 30 : max(size, 48))
            .background(alignment: .leading) {
                GeometryReader { g in
                    Theme.brassMid
                        .frame(width: g.size.width * holdProgress)
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .padding(2)
            }
            .hudTier3Pill(corner: compact ? 10 : 12, fill: Theme.cream)
            .frame(minWidth: max(size, 52), minHeight: compact ? 44 : max(size, 48))
            .contentShape(Rectangle())
    }

    private func startHold() {
        holding = true
        holdProgress = 0
        holdTask?.cancel()
        holdTask = Task { @MainActor in
            let steps = 14
            for i in 1...steps {
                try? await Task.sleep(nanoseconds: 25_000_000)
                guard !Task.isCancelled, holding else { return }
                holdProgress = CGFloat(i) / CGFloat(steps)
            }
            guard !Task.isCancelled, holding else { return }
            holding = false
            holdProgress = 0
            _ = session.pass()
        }
    }

    private func cancelHold() {
        holding = false
        holdTask?.cancel()
        holdTask = nil
        holdProgress = 0
    }
}

/// Doodad names for chips and the screen reader, from content/doodads.json.
enum DoodadNames {
    static func name(_ id: String) -> String { ContentCatalog.shared.doodadName(id) }
}

/// How a banner looks: the side colour, slate for the Squall, red for the Fatigue collapse and
/// dark gold for the Fatigue warning (QA playtest 2, N1).
enum BannerStyle: Equatable {
    case side, squall, fatigue, fatigueWarning

    static func of(_ text: String) -> BannerStyle {
        if text == BattleSession.fatigueStartText { return .fatigue }
        if text == BattleSession.fatigueWarnText { return .fatigueWarning }
        if text.contains("Squall") { return .squall }
        return .side
    }
}

/// Turn banner: slides in for 1.2 s and never blocks taps. Long lines wrap to the screen.
struct TurnBanner: View {
    let text: String
    let side: Int
    var colours: ColourSet = .brickabrac

    static let fatigueRed = Color(hex: 0xC9363E)

    private var fill: Color {
        switch BannerStyle.of(text) {
        case .fatigue: return Self.fatigueRed
        case .fatigueWarning: return Theme.orangeInk
        case .squall: return Theme.flattenerSlate
        case .side: return Theme.side(side, colours)
        }
    }

    var body: some View {
        Text(text)
            .font(Theme.title(21))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 26)
            .padding(.vertical, 5)
            .frame(minWidth: 240, minHeight: 44)
            .background(Capsule().fill(fill))
            .overlay(Capsule().stroke(Theme.ink, lineWidth: 2.5))
            .shadow(color: Theme.ink.opacity(0.25), radius: 2, x: 0, y: 2)
            .allowsHitTesting(false)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Plays a UI animation from animations.json (coin spin, Pennant stamp, hand-off flip,
/// Fire press) with SwiftUI. Reduce motion shows the held or first frame, and finite clips
/// pause their TimelineView once finished so they never spin at 30 Hz forever (iOS-M5).
struct AnimSprite: View {
    let clip: String
    var size: CGFloat = 32
    /// When the clip started; nil shows the hold frame.
    var start: Date?
    var reduceMotion = false
    var fallback = "circle.fill"
    @State private var finished = false

    var body: some View {
        if let anim = AnimationLibrary.shared.clip(clip) {
            let paused = start == nil || reduceMotion || (!anim.loop && finished)
            TimelineView(.animation(minimumInterval: 1.0 / 30, paused: paused)) { context in
                let t = start.map { context.date.timeIntervalSince($0) * 1000 } ?? anim.total + 1
                let name = reduceMotion ? (anim.hold ?? anim.frames[0]) : anim.frame(at: finished && !anim.loop ? anim.total + 1 : t)
                SpriteIcon(name: name, fallback: fallback, size: size)
            }
            .task(id: start) {
                finished = false
                guard !anim.loop, !reduceMotion, let s = start else { return }
                let remaining = max(0, anim.total - Date().timeIntervalSince(s) * 1000) + 50
                try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000))
                if !Task.isCancelled { finished = true }
            }
        } else {
            SpriteIcon(name: clip, fallback: fallback, size: size)
        }
    }
}

/// The bark's subtitle line, in the Hob's side colour.
struct SubtitleView: View {
    let text: String
    let side: Int
    var colours: ColourSet = .brickabrac

    var body: some View {
        Text(text)
            .font(Theme.label(15))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Capsule().fill(Theme.paper.opacity(0.94)))
            .overlay(Capsule().stroke(Theme.side(side, colours), lineWidth: 2))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
