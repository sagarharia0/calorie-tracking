import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui/Icon'
import { Screen } from '../components/ui/Screen'
import { TabBar } from '../components/ui/TabBar'
import { useActiveGoal } from '../hooks/useActiveGoal'
import { todayKey, formatShortDate } from '../lib/dateKey'
import { gramsFromGoal } from '../lib/macros'
import type { Goal } from '../types/firestore'

export default function Goals() {
  const navigate = useNavigate()
  const today = todayKey()
  const { goal: activeGoal, goals, loading } = useActiveGoal(today)

  return (
    <Screen label="Goals">
      <div className="appbar">
        <button
          className="pill"
          onClick={() => navigate('/settings')}
          style={{ border: 0, height: 32, padding: '0 8px', background: 'transparent', cursor: 'pointer' }}
        >
          <Icon name="back" size={18} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Daily goals</div>
        <button
          onClick={() => navigate('/goals/edit')}
          className="pill"
          style={{
            border: 0,
            height: 32,
            padding: '0 12px',
            background: 'transparent',
            color: 'var(--accent)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 18px 90px' }}>
        {!loading && !activeGoal && (
          <div className="card" style={{ padding: 18, textAlign: 'center', marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              No goal set yet.<br />
              Tap <strong style={{ color: 'var(--accent)' }}>Edit</strong> to create one.
            </div>
          </div>
        )}

        {activeGoal && <ActiveGoalCard goal={activeGoal} />}

        <div className="section-title" style={{ padding: '20px 4px 8px' }}>History</div>
        {goals.length === 0 ? (
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>No goals saved yet.</div>
          </div>
        ) : (
          <div className="col gap-8">
            {goals.map((g) => (
              <GoalRow key={g.id} g={g} active={g.id === activeGoal?.id} />
            ))}
          </div>
        )}
      </div>

      <TabBar />
    </Screen>
  )
}

function ActiveGoalCard({ goal }: { goal: Goal }) {
  const grams = gramsFromGoal(goal.kcal, goal.carbsPct, goal.proteinPct, goal.fatPct)
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row spread aic" style={{ marginBottom: 12 }}>
        <div className="section-title">Active goal</div>
        <span
          className="pill"
          style={{
            background: 'var(--accent-2)',
            color: 'var(--accent)',
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            padding: '0 8px',
          }}
        >
          From {formatShortDate(goal.effectiveFrom)}
        </span>
      </div>

      <div className="row spread aib" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {goal.kcal.toLocaleString()}
        </div>
        <div className="muted" style={{ fontSize: 13, fontWeight: 600 }}>kcal / day</div>
      </div>

      <div className="stackbar" style={{ height: 12, marginBottom: 14 }}>
        <span style={{ width: `${goal.carbsPct}%`, background: 'var(--carbs)' }} />
        <span style={{ width: `${goal.proteinPct}%`, background: 'var(--protein)' }} />
        <span style={{ width: `${goal.fatPct}%`, background: 'var(--fat)' }} />
      </div>

      <div className="col gap-10">
        <MacroLine name="Carbs" varName="carbs" pct={goal.carbsPct} grams={grams.c_g} kcal={grams.c_g * 4} />
        <MacroLine name="Protein" varName="protein" pct={goal.proteinPct} grams={grams.p_g} kcal={grams.p_g * 4} />
        <MacroLine name="Fat" varName="fat" pct={goal.fatPct} grams={grams.f_g} kcal={grams.f_g * 9} />
      </div>
    </div>
  )
}

function MacroLine({
  name,
  varName,
  pct,
  grams,
  kcal,
}: {
  name: string
  varName: 'carbs' | 'protein' | 'fat'
  pct: number
  grams: number
  kcal: number
}) {
  return (
    <div className="row spread aic">
      <div className="row gap-8 aic">
        <span className="swatch" style={{ background: `var(--${varName})` }} />
        <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink-2)' }}>{name}</span>
      </div>
      <div className="tnum" style={{ fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>{grams}g</span>
        <span className="muted" style={{ fontWeight: 600 }}> · {pct}% · {kcal} kcal</span>
      </div>
    </div>
  )
}

function GoalRow({ g, active }: { g: Goal; active: boolean }) {
  return (
    <div
      className="card"
      style={{
        padding: 14,
        border: active ? '1px solid var(--accent)' : '1px solid transparent',
      }}
    >
      <div className="row spread aic" style={{ marginBottom: 6 }}>
        <div className="row gap-8 aic">
          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.kcal.toLocaleString()} kcal</div>
          {active && (
            <span
              className="pill"
              style={{
                background: 'var(--accent-2)',
                color: 'var(--accent)',
                height: 20,
                fontSize: 10.5,
                fontWeight: 700,
                padding: '0 7px',
              }}
            >
              Active
            </span>
          )}
        </div>
        <div className="muted tnum" style={{ fontSize: 11.5, fontWeight: 600 }}>
          From {formatShortDate(g.effectiveFrom)}
        </div>
      </div>
      <div className="row gap-6" style={{ fontSize: 11, fontWeight: 700 }}>
        <span className="pill chip-carbs" style={{ height: 20, fontSize: 10.5 }}>{g.carbsPct}% C</span>
        <span className="pill chip-protein" style={{ height: 20, fontSize: 10.5 }}>{g.proteinPct}% P</span>
        <span className="pill chip-fat" style={{ height: 20, fontSize: 10.5 }}>{g.fatPct}% F</span>
      </div>
    </div>
  )
}
