import { MacroRing } from './MacroRing'

// One cell of the 7-day strip on Home. Macros (c/p/f) are in grams.
export type WeekDay = {
  dow: string
  num: number
  date: string
  kcal: number
  c: number
  p: number
  f: number
}

type Props = {
  days: WeekDay[]
  todayIdx: number
  goal?: number
  onPick?: (day: WeekDay) => void
}

export function DayStrip({ days, todayIdx, goal = 2200, onPick }: Props) {
  return (
    <div className="day-strip">
      {days.map((day, i) => {
        const isToday = i === todayIdx
        const future = i > todayIdx
        const within = !future && day.kcal > 0 && day.kcal <= goal
        const over = !future && day.kcal > goal
        const interactive = !!onPick && !future
        return (
          <button
            key={i}
            type="button"
            className={`day-cell-ring${isToday ? ' is-today' : ''}`}
            onClick={interactive ? () => onPick!(day) : undefined}
            disabled={!interactive}
            aria-label={`View ${day.dow} ${day.num}`}
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              cursor: interactive ? 'pointer' : 'default',
              font: 'inherit',
              color: 'inherit',
            }}
          >
            <div
              className="dow"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isToday ? 'var(--ink)' : future ? 'var(--ink-4)' : 'var(--ink-3)',
                letterSpacing: '0.04em',
              }}
            >
              {day.dow}
            </div>
            <div
              style={{
                position: 'relative',
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MacroRing
                size={38}
                stroke={4}
                c={day.c || 0}
                p={day.p || 0}
                f={day.f || 0}
                kcal={day.kcal || 0}
                goal={goal}
                future={future}
                active={isToday}
              />
              <div
                className="tnum"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: isToday ? 'var(--ink)' : future ? 'var(--ink-4)' : 'var(--ink-2)',
                }}
              >
                {day.num}
              </div>
              {(within || over) && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: over
                      ? 'var(--danger)'
                      : 'color-mix(in oklch, var(--protein), black 10%)',
                  }}
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
