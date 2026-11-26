import Foundation
import AVFoundation
import CoreGraphics
import CoreText
import ImageIO
import AppKit

struct Slide {
    let imagePath: String?
    let badge: String
    let title: String
    let subtitle: String
    let caption: String
    let durationSec: Double
    let isWebView: Bool
}

let args = CommandLine.arguments
let framesDir = args.count > 1 ? args[1] : "release/sim_frames"
let outPath = args.count > 2 ? args[2] : "release/triage-g2-demo.mp4"

let slides: [Slide] = [
    Slide(
        imagePath: nil,
        badge: "HEADS UP: EVEN REALITIES HACKATHON · TRACK 04 AI ASSISTANTS & WORK",
        title: "TriageG2",
        subtitle: "30-Second Hands-Free Calendar, Gmail, Notion & AI Executive HUD for Even G2",
        caption: "Pre-Meeting Briefs · 1-Tap AI Drafts · Default-NO Safety Gate · 1-Tap Undo · Voice-to-Notion",
        durationSec: 4.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/01_radar_overview.png",
        badge: "01 · EXECUTIVE FOCUS RADAR (576×288 EVENHUB SIMULATOR)",
        title: "Calendar, Gmail & Notion Unified in One Glanceable Stream",
        subtitle: "Live 4-bit micro-LED Inbox-Zero progress ring + workload bars via updateImageRawData",
        caption: "Phone stays in pocket · Swipe R1 Ring to scan, tap for 3-bullet AI brief & instant actions",
        durationSec: 6.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/02_meeting_brief.png",
        badge: "02 · PRE-MEETING 3-BULLET EXECUTIVE BRIEF",
        title: "Walk Into Your Next Meeting Fully Prepped in 3 Seconds",
        subtitle: "Distills goal, open blocker, last Notion doc & ready AI ETA message on one G2 screen",
        caption: "1-tap action rail: Move Meeting +30m, Ping Running 5m Late, Capture Notion Task",
        durationSec: 6.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/03_confirm_move_meeting.png",
        badge: "03 · DEFAULT-NO HARDWARE SAFETY GATE (GOOGLE CALENDAR)",
        title: "Move Q4 API Sync +30m? Explicit Two-Step Confirmation",
        subtitle: "Option 0 is ALWAYS [ NO ] Cancel safely — shows exact slot diff (15:00 -> 15:30) before commit",
        caption: "45-second expiring single-use confirmation ticket prevents accidental temple taps",
        durationSec: 6.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/04_receipt_meeting_moved.png",
        badge: "04 · COMMITTED RECEIPT WITH 1-TAP HARDWARE UNDO",
        title: "Instant Before -> After Proof + Reversible Undo Stack",
        subtitle: "Meeting shifted 15:00-15:30 -> 15:30-16:00; swipe down anytime to revert cleanly",
        caption: "Supports live Google Workspace OAuth & Notion API via zero-dependency companion server",
        durationSec: 6.0,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/06_gmail_elena_brief.png",
        badge: "05 · 30-SECOND GMAIL TRIAGE & AI SMART DRAFT",
        title: "Clear Urgent Emails Hands-Free with AI Drafts",
        subtitle: "AI condenses long legal/ops threads into 3 bullets + a crisp 1-sentence reply draft",
        caption: "Safe-by-default: Save as Gmail Draft (never sends blindly) or Send AI Reply via Safety Gate",
        durationSec: 6.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/07_confirm_gmail_draft.png",
        badge: "06 · SAFE GMAIL DRAFT CONFIRMATION GATE",
        title: "Review Exact Draft Copy Before Writing to Gmail",
        subtitle: "Shows recipient, subject, draft text and unread counter delta before committing",
        caption: "Optional OpenRouter / Claude / ChatGPT upgrade runs strictly server-side (no frontend keys)",
        durationSec: 6.0,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/08_receipt_gmail_draft.png",
        badge: "07 · GMAIL DRAFT SAVED · INBOX COUNTER DECREMENTED",
        title: "Thread Cleared From Active Focus Queue",
        subtitle: "Draft saved safely in Gmail; Inbox-Zero ring updates live on return to Radar",
        caption: "Built-in Undo stack lets you restore any archived, snoozed, or drafted thread in 1 tap",
        durationSec: 5.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/09_voice_hud_mic.png",
        badge: "08 · LONG-PRESS TEMPLE -> PUSH-TO-TALK VOICE CAPTURE",
        title: "Real G2 16kHz PCM Microphone Stream + Live 24-Bar Waveform",
        subtitle: "Uses SDK LONG_PRESS_EVENT + audioControl(true, Glasses) + natural work intent router",
        caption: "Say: \"Add Notion task ship SDK docs by Friday\" or \"Move next meeting by 30 minutes\"",
        durationSec: 6.5,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/10_confirm_notion_voice.png",
        badge: "09 · VOICE-TO-NOTION STRUCTURED TASK CONFIRMATION",
        title: "Extracts Task Title & Due Date Into Notion Safety Gate",
        subtitle: "Parses \"ship SDK docs\" + \"Due: Friday\" automatically and confirms before DB write",
        caption: "Every voice-triggered write respects Default-NO hardware safety confirmation",
        durationSec: 6.0,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/11_receipt_notion_created.png",
        badge: "10 · NOTION TASK CREATED & VERIFIED",
        title: "Promise Captured to Notion Without Touching Your Phone",
        subtitle: "Task logged to Sprint Tasks DB with before/after task count proof and Undo support",
        caption: "Verified end-to-end in official @evenrealities/evenhub-simulator@0.9.5 (0 console errors)",
        durationSec: 6.0,
        isWebView: false
    ),
    Slide(
        imagePath: "\(framesDir)/00_companion_webview.png",
        badge: "11 · DUAL-MODE COMPANION WEBVIEW & INTERACTIVE BROWSER EMULATOR",
        title: "Zero-Setup Live Judge Demo + Optional Server Bridge",
        subtitle: "Interactive 576×288 G2 preview, voice tester, and OpenRouter / Notion / Google Workspace bridge",
        caption: "GitHub: z121245017-ai/triage-g2  |  Live Demo: z121245017-ai.github.io/triage-g2",
        durationSec: 7.0,
        isWebView: true
    ),
    Slide(
        imagePath: nil,
        badge: "TRIAGE G2 · BUILT WITH @EVENREALITIES/EVEN_HUB_SDK 0.0.16",
        title: "Brief. Speak. Clear Safely.",
        subtitle: "Open-Source MIT · 0 Console Errors in Official Simulator · Packaged .ehpk Included",
        caption: "GitHub: z121245017-ai/triage-g2  |  Live: z121245017-ai.github.io/triage-g2",
        durationSec: 4.5,
        isWebView: false
    )
]

let width = 1280
let height = 720
let fps: Int32 = 30

func loadImage(_ path: String) -> CGImage? {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

func drawText(_ ctx: CGContext, text: String, rect: CGRect, fontSize: CGFloat, weight: NSFont.Weight, color: NSColor, align: NSTextAlignment = .center, mono: Bool = false) {
    let font: NSFont = mono
        ? NSFont.monospacedSystemFont(ofSize: fontSize, weight: weight)
        : NSFont.systemFont(ofSize: fontSize, weight: weight)
    let para = NSMutableParagraphStyle()
    para.alignment = align
    para.lineBreakMode = .byWordWrapping
    let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: para]
    let nsStr = NSAttributedString(string: text, attributes: attrs)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)
    nsStr.draw(in: rect)
    NSGraphicsContext.restoreGraphicsState()
}

func renderSlideBuffer(_ slide: Slide, pool: CVPixelBufferPool) -> CVPixelBuffer? {
    var pbOut: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pbOut) == kCVReturnSuccess, let pb = pbOut else { return nil }
    CVPixelBufferLockBaseAddress(pb, [])
    defer { CVPixelBufferUnlockBaseAddress(pb, []) }
    guard let base = CVPixelBufferGetBaseAddress(pb) else { return nil }
    let bpr = CVPixelBufferGetBytesPerRow(pb)
    guard let ctx = CGContext(
        data: base, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bpr,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { return nil }

    ctx.translateBy(x: 0, y: CGFloat(height))
    ctx.scaleBy(x: 1, y: -1)
    ctx.setFillColor(NSColor(red: 0.025, green: 0.048, blue: 0.035, alpha: 1.0).cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    ctx.setFillColor(NSColor(red: 0.25, green: 0.92, blue: 0.52, alpha: 0.85).cgColor)
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: 4))

    let greenBright = NSColor(red: 0.35, green: 0.98, blue: 0.58, alpha: 1.0)
    let whiteSoft = NSColor(red: 0.92, green: 0.97, blue: 0.94, alpha: 1.0)
    let muted = NSColor(red: 0.56, green: 0.72, blue: 0.62, alpha: 1.0)

    if let imgPath = slide.imagePath, let cgImg = loadImage(imgPath) {
        drawText(ctx, text: slide.badge, rect: CGRect(x: 60, y: 24, width: 1160, height: 24), fontSize: 14, weight: .bold, color: greenBright, mono: true)
        drawText(ctx, text: slide.title, rect: CGRect(x: 60, y: 50, width: 1160, height: 40), fontSize: 28, weight: .bold, color: whiteSoft)
        drawText(ctx, text: slide.subtitle, rect: CGRect(x: 80, y: 92, width: 1120, height: 30), fontSize: 16, weight: .regular, color: muted)

        let frameRect: CGRect
        if slide.isWebView {
            let aspect = CGFloat(cgImg.width) / CGFloat(max(1, cgImg.height))
            let maxH: CGFloat = 480, maxW: CGFloat = 960
            var drawW = maxH * aspect, drawH = maxH
            if drawW > maxW { drawW = maxW; drawH = maxW / aspect }
            frameRect = CGRect(x: (CGFloat(width) - drawW) / 2, y: 142 + (maxH - drawH) / 2, width: drawW, height: drawH)
        } else {
            frameRect = CGRect(x: (CGFloat(width) - 920) / 2, y: 142, width: 920, height: 460)
        }

        let bezel = frameRect.insetBy(dx: -12, dy: -12)
        ctx.setFillColor(NSColor(red: 0.01, green: 0.03, blue: 0.02, alpha: 1.0).cgColor)
        ctx.fill(bezel)
        ctx.setStrokeColor(NSColor(red: 0.25, green: 0.85, blue: 0.48, alpha: 0.55).cgColor)
        ctx.setLineWidth(2.0)
        ctx.stroke(bezel)

        ctx.saveGState()
        ctx.translateBy(x: frameRect.origin.x, y: frameRect.origin.y + frameRect.size.height)
        ctx.scaleBy(x: 1, y: -1)
        ctx.interpolationQuality = slide.isWebView ? .high : .none
        ctx.draw(cgImg, in: CGRect(origin: .zero, size: frameRect.size))
        ctx.restoreGState()

        ctx.setFillColor(NSColor(red: 0.05, green: 0.11, blue: 0.075, alpha: 1.0).cgColor)
        ctx.fill(CGRect(x: 60, y: 636, width: 1160, height: 52))
        ctx.setStrokeColor(NSColor(red: 0.18, green: 0.42, blue: 0.28, alpha: 0.8).cgColor)
        ctx.setLineWidth(1.0)
        ctx.stroke(CGRect(x: 60, y: 636, width: 1160, height: 52))
        drawText(ctx, text: slide.caption, rect: CGRect(x: 80, y: 650, width: 1120, height: 28), fontSize: 16, weight: .medium, color: greenBright, mono: true)
    } else {
        let box = CGRect(x: 110, y: 150, width: 1060, height: 420)
        ctx.setFillColor(NSColor(red: 0.04, green: 0.085, blue: 0.06, alpha: 1.0).cgColor)
        ctx.fill(box)
        ctx.setStrokeColor(NSColor(red: 0.30, green: 0.90, blue: 0.54, alpha: 0.65).cgColor)
        ctx.setLineWidth(2.0)
        ctx.stroke(box)
        drawText(ctx, text: slide.badge, rect: CGRect(x: 140, y: 210, width: 1000, height: 30), fontSize: 16, weight: .bold, color: greenBright, mono: true)
        drawText(ctx, text: slide.title, rect: CGRect(x: 140, y: 268, width: 1000, height: 76), fontSize: 58, weight: .bold, color: whiteSoft)
        drawText(ctx, text: slide.subtitle, rect: CGRect(x: 150, y: 364, width: 980, height: 64), fontSize: 22, weight: .medium, color: muted)
        drawText(ctx, text: slide.caption, rect: CGRect(x: 140, y: 472, width: 1000, height: 42), fontSize: 16, weight: .semibold, color: greenBright, mono: true)
    }
    return pb
}

let outURL = URL(fileURLWithPath: outPath)
try? FileManager.default.removeItem(at: outURL)
let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 2_800_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: 60
    ]
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
guard let pool = adaptor.pixelBufferPool else { fatalError("No pool") }

var currentFrame: Int64 = 0
for slide in slides {
    guard let pb = renderSlideBuffer(slide, pool: pool) else { fatalError("Render failed: \(slide.title)") }
    let count = Int64(slide.durationSec * Double(fps))
    var offset: Int64 = 0
    while offset < count {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
        adaptor.append(pb, withPresentationTime: CMTime(value: currentFrame + offset, timescale: fps))
        offset += 15
    }
    currentFrame += count
}
if let last = slides.last, let pb = renderSlideBuffer(last, pool: pool) {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    adaptor.append(pb, withPresentationTime: CMTime(value: currentFrame, timescale: fps))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status == .completed {
    let bytes = (try FileManager.default.attributesOfItem(atPath: outPath)[.size] as? Int64) ?? 0
    print(String(format: "Rendered demo video: %@ (%.1fs, %lld bytes)", outPath, Double(currentFrame) / Double(fps), bytes))
} else {
    fatalError("Writer failed: \(String(describing: writer.error))")
}
