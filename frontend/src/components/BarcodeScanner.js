import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Barcode } from "@phosphor-icons/react";

// Registered at module load time — before CRA overlay attaches its own listeners.
// Silences the benign "play() interrupted" DOMException from Html5Qrcode.
const _isPlayError = (msg) =>
  typeof msg === "string" &&
  (msg.includes("play()") || msg.includes("goo.gl/LdLk22") ||
    (msg.includes("interrupted") && msg.includes("media")));

const _origConsoleError = console.error;
console.error = (...args) => {
  if (_isPlayError(args.join(" "))) return;
  _origConsoleError(...args);
};

window.addEventListener("unhandledrejection", (e) => {
  if (_isPlayError(e?.reason?.message) || e?.reason?.name === "AbortError") {
    e.preventDefault();
  }
}, true);

window.addEventListener("error", (e) => {
  if (_isPlayError(e?.message)) e.stopImmediatePropagation();
}, true);

async function tapToFocus(videoEl, x, y) {
  try {
    const track = videoEl?.srcObject?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.();
    // Use pointsOfInterest if supported (Android Chrome)
    if (caps?.pointsOfInterest) {
      const settings = track.getSettings();
      const px = x / videoEl.clientWidth;
      const py = y / videoEl.clientHeight;
      await track.applyConstraints({ advanced: [{ pointsOfInterest: [{ x: px, y: py }], focusMode: "manual" }] });
      // Revert to continuous after 2s
      setTimeout(() => {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
      }, 2000);
    }
  } catch (e) { /* focus not supported — silently ignore */ }
}

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [focusRipple, setFocusRipple] = useState(null);
  const mountedRef = useRef(true);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const scannerId = "barcode-reader-" + Date.now();
    const el = document.getElementById("barcode-reader-container");
    if (el) {
      el.innerHTML = "";
      const div = document.createElement("div");
      div.id = scannerId;
      div.style.width = "100%";
      el.appendChild(div);
    }

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        // Pre-check: Verify secure context and camera permissions first
        if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          setError(
            `HTTPS Required\n\n` +
            `Current: ${window.location.protocol}//${window.location.host}\n\n` +
            `Camera access requires a secure HTTPS connection.\n\n` +
            `Please:\n` +
            `1. Use the HTTPS URL (https://...)\n` +
            `2. Accept any certificate warnings\n` +
            `3. On mobile: ensure you're on the same WiFi as the server`
          );
          return;
        }
        
        // Try to get camera permission explicitly first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop()); // Release immediately
        } catch (permErr) {
          console.error("Camera permission check failed:", permErr);
          const permMsg = permErr?.message || "";
          
          if (permErr.name === "NotAllowedError") {
            if (permMsg.includes("denied by system") || permMsg.includes("system")) {
              // OS-level block (common on iOS Safari)
              setError(
                `Camera blocked by device settings.\n\n` +
                `iOS Safari:\n` +
                `Settings → Safari → Camera → Allow\n\n` +
                `Android Chrome:\n` +
                `Settings → Apps → Chrome → Permissions → Camera → Allow\n\n` +
                `Or check if your device has camera restrictions enabled.`
              );
            } else {
              setError("Camera permission denied. Please allow camera access in your browser settings and refresh the page.");
            }
          } else if (permErr.name === "NotFoundError") {
            setError("No camera found on this device.");
          } else {
            throw permErr; // Let main error handler deal with it
          }
          return;
        }
        
        await scanner.start(
          {
            facingMode: "environment",
            advanced: [{ focusMode: "continuous" }],
          },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.5,
            videoConstraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
              focusMode: "continuous",
              advanced: [{ focusMode: "continuous" }],
            },
          },
          (decodedText) => {
            if (!cancelled && mountedRef.current) {
              onScan(decodedText);
              stopAndClose();
            }
          },
          () => {}
        );
        if (cancelled) {
          try { await scanner.stop(); } catch (e) { /* ignore */ }
          return;
        }
        runningRef.current = true;
      } catch (err) {
        // Log full error details for debugging
        console.error("Barcode scanner error:", {
          name: err?.name,
          message: err?.message,
          stack: err?.stack,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          isSecureContext: window.isSecureContext
        });
        
        // Suppress "play() interrupted" — happens when modal closes before camera starts
        if (err?.name === "AbortError" || err?.message?.includes("play()")) return;
        if (!cancelled && mountedRef.current) {
          const errorMsg = (err?.message || "").toLowerCase();
          const errorName = err?.name || "";
          
          // Check for HTTPS/secure context issues (multiple patterns)
          const isNotHttps = window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
          const isNotSecureContext = typeof window.isSecureContext !== "undefined" ? !window.isSecureContext : isNotHttps;
          const isHttpsError = 
            errorMsg.includes("secure origin") || 
            errorMsg.includes("only supported") ||
            errorMsg.includes("https") ||
            errorMsg.includes("insecure") ||
            isNotSecureContext ||
            isNotHttps;
          
          // Permission issues
          const isPermissionDenied = 
            errorName === "NotAllowedError" || 
            errorMsg.includes("permission") ||
            errorMsg.includes("denied") ||
            errorMsg.includes("not allowed");
          
          // Camera not found
          const isNotFound = 
            errorName === "NotFoundError" || 
            errorMsg.includes("not found") ||
            errorMsg.includes("no camera") ||
            errorMsg.includes("requested device not found");
          
          // Overconstrained (camera in use or bad constraints)
          const isOverconstrained = 
            errorName === "OverconstrainedError" ||
            errorMsg.includes("overconstrained") ||
            errorMsg.includes("constraints");
          
          if (isHttpsError) {
            const currentUrl = window.location.href;
            setError(
              `Camera requires secure HTTPS connection.\n\n` +
              `Current URL: ${currentUrl}\n\n` +
              `On mobile:\n` +
              `1. Make sure you're using HTTPS (not HTTP)\n` +
              `2. Accept the self-signed certificate warning\n` +
              `3. Grant camera permission when prompted\n\n` +
              `Protocol: ${window.location.protocol}\n` +
              `Secure context: ${window.isSecureContext ? 'Yes' : 'No'}`
            );
          } else if (isPermissionDenied) {
            setError("Camera permission denied. Please:\n1. Check browser settings > Site settings > Camera\n2. Allow camera access for this site\n3. Refresh and try again");
          } else if (isNotFound) {
            setError("No camera found on this device. Please connect a camera and try again.");
          } else if (isOverconstrained) {
            setError("Camera is in use by another app or doesn't support required settings. Please close other camera apps and try again.");
          } else {
            setError(
              `Camera error: ${errorName || "Unknown error"}\n` +
              `${err?.message || ""}\n\n` +
              `Please check:\n` +
              `• HTTPS connection (required)\n` +
              `• Camera permissions granted\n` +
              `• No other app using camera`
            );
          }
        }
      }
    };

    // Small delay ensures modal DOM is fully painted before scanner binds to video element
    const startTimer = setTimeout(startScanner, 150);

    // Touch-to-focus handler — attached after scanner starts
    const focusTimer = setTimeout(() => {
      const container = document.getElementById("barcode-reader-container");
      const video = container?.querySelector("video");
      if (!video) return;
      const onTap = (e) => {
        const rect = video.getBoundingClientRect();
        const touch = e.touches?.[0] ?? e;
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        setFocusRipple({ x: touch.clientX, y: touch.clientY, id: Date.now() });
        setTimeout(() => setFocusRipple(null), 700);
        tapToFocus(video, x, y);
      };
      video.addEventListener("touchstart", onTap, { passive: true });
      video.addEventListener("click", onTap);
      video._focusHandler = onTap;
    }, 500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(focusTimer);
      cancelled = true;
      mountedRef.current = false;
      const stop = async () => {
        if (runningRef.current && scannerRef.current) {
          try { await scannerRef.current.stop(); } catch (e) { /* ignore */ }
          runningRef.current = false;
        }
        // Kill any lingering camera tracks in case stop() wasn't reached
        try {
          document.querySelectorAll("video").forEach(v => {
            if (v._focusHandler) {
              v.removeEventListener("touchstart", v._focusHandler);
              v.removeEventListener("click", v._focusHandler);
            }
            v.srcObject?.getTracks?.().forEach(t => t.stop());
          });
        } catch (e) { /* ignore */ }
      };
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndClose = () => {
    if (runningRef.current && scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => { runningRef.current = false; onClose(); }).catch(() => { onClose(); });
      } catch (e) { onClose(); }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" data-testid="barcode-scanner-modal">
      <div className="bg-[var(--surface)] rounded-sm max-w-md w-full overflow-hidden flex flex-col landscape:max-w-xl landscape:flex-row">
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Barcode size={20} weight="duotone" className="text-[var(--brand)]" />
              <h3 className="font-heading text-base font-medium">Scan Barcode</h3>
            </div>
            <button data-testid="close-scanner-btn" onClick={stopAndClose} className="p-1.5 hover:bg-[var(--bg)] rounded-sm landscape:hidden" aria-label="Close scanner">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="p-4">
            {error ? (
              <div className="text-center py-8 px-4">
                <Camera size={40} weight="thin" className="mx-auto text-[var(--error)] mb-4" />
                <p className="text-sm text-[var(--error)] font-medium mb-3 whitespace-pre-line">{error}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-2">Close and reopen scanner to retry</p>
              </div>
            ) : (
              <>
                <div id="barcode-reader-container" className="w-full rounded-sm overflow-hidden bg-black flex items-center justify-center" style={{ minHeight: 250 }} />
                <p className="text-xs text-[var(--text-secondary)] text-center mt-3 landscape:hidden">Point camera at barcode · Tap to focus</p>
                {focusRipple && (
                  <div
                    key={focusRipple.id}
                    className="pointer-events-none fixed z-[60] w-12 h-12 rounded-full border-2 border-white/80 animate-ping"
                    style={{ left: focusRipple.x - 24, top: focusRipple.y - 24 }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Landscape controls */}
        <div className="hidden landscape:flex flex-col items-center justify-center p-6 border-l border-[var(--border-subtle)] gap-6">
          <button onClick={stopAndClose} className="p-3 hover:bg-[var(--bg)] rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="flex flex-col items-center text-center gap-1">
            <div className="p-3 rounded-full bg-[var(--brand)]/10 text-[var(--brand)]">
              <Barcode size={24} weight="duotone" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Align Barcode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
