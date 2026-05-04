import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { todayKey } from '../lib/dateKey'
import { lookupBarcode, type OffProduct } from '../lib/openfoodfacts'

// Minimal type for the BarcodeDetector API. It's available in Chromium-based
// browsers (Chrome on Android being the primary target here). lib.dom.d.ts
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

type LookupState =
  | { phase: 'idle' }
  | { phase: 'looking'; barcode: string }
  | { phase: 'found'; barcode: string; product: OffProduct }
  | { phase: 'notFound'; barcode: string }
  | { phase: 'error'; message: string }

type CameraState =
  | { phase: 'starting' }
  | { phase: 'streaming' }
  | { phase: 'unsupported' }
  | { phase: 'permissionDenied' }
  | { phase: 'error'; message: string }

export default function Scanner() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camera, setCamera] = useState<CameraState>({ phase: 'starting' })
  const [lookup, setLookup] = useState<LookupState>({ phase: 'idle' })

  // Start camera + detection loop on mount, tear down on unmount.
  useEffect(() => {
    if (!window.BarcodeDetector) {
      setCamera({ phase: 'unsupported' })
      return
    }
    let cancelled = false
    let raf: number | undefined

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
        // Autoplay can fail if the document hasn't seen a user gesture; the
        // Scanner is reached via tap so this is rare.
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
              stopCamera()
              await runLookup(code)
              return
            }
          } catch {
            // Detector can throw transiently (e.g. mid-frame). Ignore and keep looping.
          }
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    const stopCamera = () => {
      if (raf) cancelAnimationFrame(raf)
      const s = streamRef.current
      if (s) {
        s.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }

    const runLookup = async (barcode: string) => {
      setLookup({ phase: 'looking', barcode })
      try {
        const product = await lookupBarcode(barcode)
        if (cancelled) return
        if (!product) {
          setLookup({ phase: 'notFound', barcode })
        } else {
          setLookup({ phase: 'found', barcode, product })
        }
      } catch (err) {
        if (cancelled) return
        setLookup({
          phase: 'error',
          message: err instanceof Error ? err.message : 'Lookup failed.',
        })
      }
    }

    start()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [])

  const onAddToLog = () => {
    if (lookup.phase !== 'found') return
    const { product, barcode } = lookup
    // Prefill the first item in AddMeal via router state. Amount defaults to
    // 100g since per100g is what OFF gives us.
    navigate(`/day/${todayKey()}/add`, {
      state: {
        prefill: {
          name: product.brand ? `${product.brand} ${product.name}` : product.name,
          barcode,
          amount: 100,
          unit: 'g' as const,
          kcal: product.per100g.kcal ?? 0,
          c_g: product.per100g.c_g ?? 0,
          p_g: product.per100g.p_g ?? 0,
          f_g: product.per100g.f_g ?? 0,
        },
      },
    })
  }

  const onManualEntry = () => {
    navigate(`/day/${todayKey()}/add`)
  }

  return (
    <Screen label="06 Scanner">
      <div style={{ position: 'relative', flex: 1, background: '#0b0d10', overflow: 'hidden' }}>
        {/* Live camera feed */}
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

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <button
            onClick={() => navigate(-1)}
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
            SCAN BARCODE
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* Targeting reticle */}
        {camera.phase === 'streaming' && lookup.phase === 'idle' && (
          <div style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)', width: 260, height: 150, borderRadius: 18, zIndex: 2 }}>
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

        {/* Status overlay (when not streaming or after detection) */}
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
            <div className="col gap-12" style={{ alignItems: 'center' }}>
              {camera.phase === 'starting' && <div style={{ fontSize: 14, fontWeight: 600 }}>Starting camera…</div>}
              {camera.phase === 'unsupported' && (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Barcode scanning unavailable</div>
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, lineHeight: 1.5, maxWidth: 320 }}>
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
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, lineHeight: 1.5, maxWidth: 320 }}>
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
                  <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, lineHeight: 1.5, maxWidth: 320 }}>{camera.message}</div>
                  <button onClick={onManualEntry} className="btn" style={{ background: '#fff', color: '#0b0d10', cursor: 'pointer' }}>
                    Log a meal manually
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Result card */}
        {lookup.phase !== 'idle' && camera.phase !== 'streaming' && lookup.phase !== 'looking' && null}
        {(lookup.phase === 'looking' || lookup.phase === 'found' || lookup.phase === 'notFound' || lookup.phase === 'error') && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 24,
              background: '#fff',
              borderRadius: 22,
              padding: 16,
              boxShadow: '0 -10px 40px rgba(0,0,0,.4)',
              zIndex: 3,
            }}
          >
            {lookup.phase === 'looking' && (
              <div className="col gap-6">
                <div className="row gap-8 aic">
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid var(--hairline-2)',
                      borderTopColor: 'var(--accent)',
                      animation: 'spin 0.9s linear infinite',
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Looking up {lookup.barcode}…</span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.4 }}>Open Food Facts</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            {lookup.phase === 'found' && <FoundCard product={lookup.product} barcode={lookup.barcode} onAdd={onAddToLog} />}
            {lookup.phase === 'notFound' && (
              <div className="col gap-10">
                <div style={{ fontSize: 15, fontWeight: 700 }}>Not in Open Food Facts</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                  Barcode {lookup.barcode} isn't in the database. You can still log this item manually.
                </div>
                <div className="row gap-8">
                  <button onClick={() => setLookup({ phase: 'idle' })} className="btn ghost" style={{ flex: 1, cursor: 'pointer' }}>
                    Scan again
                  </button>
                  <button onClick={onManualEntry} className="btn" style={{ flex: 1.4, cursor: 'pointer' }}>
                    Log manually
                  </button>
                </div>
              </div>
            )}
            {lookup.phase === 'error' && (
              <div className="col gap-10">
                <div style={{ fontSize: 15, fontWeight: 700 }}>Lookup failed</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{lookup.message}</div>
                <div className="row gap-8">
                  <button onClick={() => setLookup({ phase: 'idle' })} className="btn ghost" style={{ flex: 1, cursor: 'pointer' }}>
                    Scan again
                  </button>
                  <button onClick={onManualEntry} className="btn" style={{ flex: 1.4, cursor: 'pointer' }}>
                    Log manually
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idle help text */}
        {camera.phase === 'streaming' && lookup.phase === 'idle' && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 36, textAlign: 'center', color: 'rgba(255,255,255,.85)', fontSize: 12.5, fontWeight: 600, zIndex: 2, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>
            Centre a barcode in the frame
          </div>
        )}
      </div>
    </Screen>
  )
}

function FoundCard({ product, barcode, onAdd }: { product: OffProduct; barcode: string; onAdd: () => void }) {
  const { per100g } = product
  return (
    <div className="col">
      <div className="row gap-8 aic" style={{ marginBottom: 10 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'oklch(0.7 0.18 145)',
            boxShadow: '0 0 0 4px oklch(0.7 0.18 145 / .15)',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'oklch(0.45 0.15 145)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Found · {barcode}
        </span>
      </div>
      <div className="col" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {product.brand && <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{product.brand} </span>}
          {product.name}
        </div>
        <div className="muted" style={{ fontSize: 12, fontWeight: 500 }}>Per 100g</div>
      </div>
      <div className="row spread" style={{ marginBottom: 14 }}>
        <Stat label="kcal" v={per100g.kcal == null ? '—' : String(Math.round(per100g.kcal))} />
        <Stat label="C" v={per100g.c_g == null ? '—' : `${Math.round(per100g.c_g)}g`} tone="carbs" />
        <Stat label="P" v={per100g.p_g == null ? '—' : `${Math.round(per100g.p_g)}g`} tone="protein" />
        <Stat label="F" v={per100g.f_g == null ? '—' : `${Math.round(per100g.f_g)}g`} tone="fat" />
      </div>
      {(per100g.kcal == null || per100g.c_g == null || per100g.p_g == null || per100g.f_g == null) && (
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 10, lineHeight: 1.4 }}>
          Some macros missing in OFF. You can fill them in on the next screen.
        </div>
      )}
      <div className="row gap-8">
        <button
          onClick={onAdd}
          className="btn"
          style={{ flex: 1, background: 'var(--accent)', cursor: 'pointer' }}
        >
          <Icon name="plus" size={16} color="#fff" /> Add to log
        </button>
      </div>
    </div>
  )
}

function Stat({ label, v, tone }: { label: string; v: string; tone?: 'carbs' | 'protein' | 'fat' }) {
  const colors = {
    carbs: 'color-mix(in oklch, var(--carbs), black 30%)',
    protein: 'color-mix(in oklch, var(--protein), black 28%)',
    fat: 'color-mix(in oklch, var(--fat), black 30%)',
  }
  return (
    <div className="col aic" style={{ alignItems: 'center' }}>
      <div className="tnum" style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: tone ? colors[tone] : 'var(--ink)' }}>
        {v}
      </div>
      <div className="muted" style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}
