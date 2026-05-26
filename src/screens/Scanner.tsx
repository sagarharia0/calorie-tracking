import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { todayKey, formatShortDate } from '../lib/dateKey'
import { lookupBarcode, parseQuantity, type OffProduct } from '../lib/openfoodfacts'

// Minimal type for the BarcodeDetector API. Available in Chromium-based
// browsers (Chrome on Android being the primary target). lib.dom.d.ts
// doesn't include it yet so we declare what we use.
type DetectedBarcode = { rawValue: string; format: string }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(image: HTMLVideoElement): Promise<DetectedBarcode[]>
}
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

type ScannedItem = {
  barcode: string
  status: 'pending' | 'ok' | 'failed'
  product?: OffProduct
  error?: string
}

type CameraState =
  | { phase: 'starting' }
  | { phase: 'streaming' }
  | { phase: 'unsupported' }
  | { phase: 'permissionDenied' }
  | { phase: 'error'; message: string }

export default function Scanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { dateKey: stateDate } = (location.state ?? {}) as { dateKey?: string }
  const dateKey = stateDate ?? todayKey()
  const isToday = dateKey === todayKey()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // scanned mirrors React state but is read inside the RAF detection loop —
  // keeping a ref alongside avoids stale-closure dedupe failures.
  const scannedRef = useRef<ScannedItem[]>([])
  const [scanned, setScanned] = useState<ScannedItem[]>([])
  const [camera, setCamera] = useState<CameraState>({ phase: 'starting' })

  const updateScanned = (next: ScannedItem[]) => {
    scannedRef.current = next
    setScanned(next)
  }

  // Start camera + start detection loop. Continues running until unmount —
  // each successful barcode appends to scanned[]; user taps Done when finished.
  useEffect(() => {
    if (!window.BarcodeDetector) {
      setCamera({ phase: 'unsupported' })
      return
    }
    let cancelled = false
    let raf: number | undefined

    const stopCamera = () => {
      if (raf) cancelAnimationFrame(raf)
      const s = streamRef.current
      if (s) {
        s.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }

    const runLookup = async (barcode: string) => {
      // Add as pending (UI immediately shows the chip).
      const pendingItem: ScannedItem = { barcode, status: 'pending' }
      const next = [...scannedRef.current, pendingItem]
      updateScanned(next)
      try {
        const product = await lookupBarcode(barcode)
        if (cancelled) return
        updateScanned(
          scannedRef.current.map((s) =>
            s.barcode === barcode
              ? product
                ? { ...s, status: 'ok', product }
                : { ...s, status: 'failed', error: 'Not in Open Food Facts' }
              : s,
          ),
        )
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Lookup failed.'
        updateScanned(
          scannedRef.current.map((s) =>
            s.barcode === barcode ? { ...s, status: 'failed', error: message } : s,
          ),
        )
      }
    }

    const start = async () => {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch (err) {
        if (cancelled) return
        const name = err instanceof Error ? err.name : ''
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setCamera({ phase: 'permissionDenied' })
        } else {
          setCamera({
            phase: 'error',
            message: err instanceof Error ? err.message : 'Camera unavailable.',
          })
        }
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      const v = videoRef.current
      if (!v) return
      v.srcObject = stream
      try {
        await v.play()
      } catch {
        // Autoplay can fail without a user gesture; the Scanner is reached
        // via tap so this is rare. If it happens we still show the UI.
      }
      setCamera({ phase: 'streaming' })

      const Ctor = window.BarcodeDetector!
      const detector = new Ctor({ formats: FORMATS })

      const tick = async () => {
        if (cancelled) return
        if (v.readyState >= 2) {
          try {
            const codes = await detector.detect(v)
            if (codes.length > 0 && !cancelled) {
              const code = codes[0].rawValue
              // Dedupe: ignore barcodes already in the list (any status).
              // User can dismiss a failed scan to retry.
              const existing = scannedRef.current.find((s) => s.barcode === code)
              if (!existing) {
                runLookup(code)
              }
            }
          } catch {
            // detect() can throw mid-frame; ignore and keep looping.
          }
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [])

  const okItems = scanned.filter((s) => s.status === 'ok')
  const okCount = okItems.length

  const onDone = () => {
    const prefill = okItems
      .filter((s) => s.product)
      .map((s) => {
        const p = s.product!
        // Smart portion default: prefer the labelled serving size, fall back
        // to the full package quantity, then 100g if both are missing.
        // Scale macros by amount/100 since OFF's per-100 values are the
        // canonical source.
        const portion =
          parseQuantity(p.servingSize) ?? parseQuantity(p.quantity) ?? { amount: 100, unit: 'g' as const }
        const factor = portion.amount / 100
        return {
          name: p.brand ? `${p.brand} ${p.name}` : p.name,
          barcode: s.barcode,
          amount: portion.amount,
          unit: portion.unit,
          kcal: Math.round((p.per100g.kcal ?? 0) * factor),
          c_g: Math.round((p.per100g.c_g ?? 0) * factor),
          p_g: Math.round((p.per100g.p_g ?? 0) * factor),
          f_g: Math.round((p.per100g.f_g ?? 0) * factor),
        }
      })
    navigate(`/day/${dateKey}/add`, { state: { prefill } })
  }

  const onManualEntry = () => navigate(`/day/${dateKey}/add`)

  const onDismissScan = (barcode: string) => {
    updateScanned(scannedRef.current.filter((s) => s.barcode !== barcode))
  }

  const cameraIsStreaming = camera.phase === 'streaming'

  return (
    <Screen label="06 Scanner">
      <div style={{ position: 'relative', flex: 1, background: '#0b0d10', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            background: '#0b0d10',
          }}
        />

        {/* Top bar: close + count */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 3 }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Close scanner"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'rgba(0,0,0,.5)',
              backdropFilter: 'blur(8px)',
              border: 0,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Icon name="back" size={18} color="#fff" />
          </button>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', background: 'rgba(0,0,0,.5)', padding: '6px 12px', borderRadius: 999 }}>
            {isToday ? 'SCAN BARCODE' : `SCAN · ${formatShortDate(dateKey).toUpperCase()}`}
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* Reticle (only when streaming) */}
        {cameraIsStreaming && (
          <div style={{ position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)', width: 260, height: 150, borderRadius: 18, zIndex: 2 }}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => {
              const s: React.CSSProperties = { position: 'absolute', width: 26, height: 26, borderColor: '#fff', borderStyle: 'solid', borderWidth: 0 }
              if (c === 'tl') Object.assign(s, { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 })
              if (c === 'tr') Object.assign(s, { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 })
              if (c === 'bl') Object.assign(s, { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 })
              if (c === 'br') Object.assign(s, { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 })
              return <span key={c} style={s} />
            })}
            <div
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                top: '50%',
                height: 2,
                background: 'oklch(0.85 0.18 145)',
                boxShadow: '0 0 12px oklch(0.85 0.18 145)',
                borderRadius: 1,
              }}
            />
          </div>
        )}

        {/* Hint text — shown above the chip strip when streaming */}
        {cameraIsStreaming && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(38% + 90px)', textAlign: 'center', color: 'rgba(255,255,255,.85)', fontSize: 12.5, fontWeight: 600, zIndex: 2, textShadow: '0 1px 4px rgba(0,0,0,.6)', padding: '0 24px' }}>
            {scanned.length === 0
              ? 'Centre a barcode in the frame'
              : `${okCount} item${okCount === 1 ? '' : 's'} ready · keep scanning, or tap Done`}
          </div>
        )}

        {/* Scanned-items strip + action bar at the bottom */}
        {cameraIsStreaming && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              padding: '12px 12px max(16px, env(safe-area-inset-bottom)) 12px',
              background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.65) 60%, transparent 100%)',
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {scanned.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  paddingBottom: 4,
                  scrollbarWidth: 'none',
                }}
              >
                {scanned.map((s) => (
                  <ScannedChip key={s.barcode} item={s} onDismiss={() => onDismissScan(s.barcode)} />
                ))}
              </div>
            )}
            <div className="row gap-8" style={{ alignItems: 'stretch' }}>
              <button
                onClick={onManualEntry}
                style={{
                  flex: 1,
                  height: 48,
                  border: '1px solid rgba(255,255,255,.3)',
                  background: 'rgba(0,0,0,.5)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  borderRadius: 16,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Type manually
              </button>
              <button
                onClick={onDone}
                disabled={okCount === 0}
                style={{
                  flex: 1.4,
                  height: 48,
                  border: 0,
                  background: okCount > 0 ? '#fff' : 'rgba(255,255,255,.3)',
                  color: okCount > 0 ? '#0b0d10' : 'rgba(255,255,255,.6)',
                  borderRadius: 16,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: okCount > 0 ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Icon name="check" size={16} color={okCount > 0 ? '#0b0d10' : 'rgba(255,255,255,.6)'} />
                Done{okCount > 0 ? ` · ${okCount} item${okCount === 1 ? '' : 's'}` : ''}
              </button>
            </div>
          </div>
        )}

        {/* Camera not streaming — overlay with state + manual fallback */}
        {camera.phase !== 'streaming' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 32px',
              textAlign: 'center',
              color: '#fff',
              zIndex: 2,
              background: 'rgba(0,0,0,.55)',
            }}
          >
            <div className="col gap-12" style={{ alignItems: 'center', maxWidth: 320 }}>
              {camera.phase === 'starting' && <div style={{ fontSize: 14, fontWeight: 600 }}>Starting camera…</div>}
              {camera.phase === 'unsupported' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Barcode scanning unavailable</div>
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, lineHeight: 1.5 }}>
                    This browser doesn't support the BarcodeDetector API.
                    Use Chrome on Android for scanning, or log the meal manually.
                  </div>
                  <button onClick={onManualEntry} className="btn" style={{ background: '#fff', color: '#0b0d10', cursor: 'pointer' }}>
                    Log a meal manually
                  </button>
                </>
              )}
              {camera.phase === 'permissionDenied' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Camera access denied</div>
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, lineHeight: 1.5 }}>
                    Grant camera permission in your browser settings, then reload this page.
                  </div>
                  <button onClick={onManualEntry} className="btn" style={{ background: '#fff', color: '#0b0d10', cursor: 'pointer' }}>
                    Log a meal manually
                  </button>
                </>
              )}
              {camera.phase === 'error' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Camera error</div>
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, lineHeight: 1.5 }}>{camera.message}</div>
                  <button onClick={onManualEntry} className="btn" style={{ background: '#fff', color: '#0b0d10', cursor: 'pointer' }}>
                    Log a meal manually
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Screen>
  )
}

function ScannedChip({ item, onDismiss }: { item: ScannedItem; onDismiss: () => void }) {
  const isOk = item.status === 'ok'
  const isPending = item.status === 'pending'
  const isFailed = item.status === 'failed'
  const label = isOk
    ? truncate(item.product?.brand ? `${item.product.brand} ${item.product.name}` : item.product?.name ?? item.barcode, 24)
    : isPending
      ? `Looking up ${item.barcode.slice(-6)}…`
      : `Couldn't resolve ${item.barcode.slice(-6)}`
  const bg = isOk ? '#fff' : isFailed ? 'oklch(0.45 0.15 25)' : 'rgba(255,255,255,.85)'
  const fg = isOk ? '#0b0d10' : isFailed ? '#fff' : '#0b0d10'
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: bg,
        color: fg,
        borderRadius: 999,
        padding: '0 4px 0 10px',
        height: 30,
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {isOk && <Icon name="check" size={11} color={fg} />}
      {isPending && (
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            border: '2px solid rgba(0,0,0,.2)',
            borderTopColor: '#0b0d10',
            display: 'inline-block',
            animation: 'spin 0.9s linear infinite',
          }}
        />
      )}
      <span>{label}</span>
      {isOk && item.product?.per100g.kcal != null && (
        <span style={{ opacity: 0.55, fontWeight: 600 }}>· {Math.round(item.product.per100g.kcal)}kcal</span>
      )}
      <button
        onClick={onDismiss}
        aria-label="Remove this scan"
        style={{
          marginLeft: 2,
          width: 22,
          height: 22,
          borderRadius: 999,
          border: 0,
          background: 'rgba(0,0,0,.08)',
          color: fg,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <Icon name="minus" size={11} color={fg} />
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
