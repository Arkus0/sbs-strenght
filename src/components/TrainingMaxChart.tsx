import { useMemo } from 'react'
import type { TrainingMaxHistoryPoint } from '../types/domain'

interface TrainingMaxChartProps {
  history: TrainingMaxHistoryPoint[]
  liftName: string
  units: string
}

const WIDTH = 640
const HEIGHT = 250
const PADDING = { top: 18, right: 18, bottom: 42, left: 58 }

function formatValue(value: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)
}

export function TrainingMaxChart({ history, liftName, units }: TrainingMaxChartProps): JSX.Element {
  const chart = useMemo(() => {
    const pointsWithValues = history.filter((point) => point.trainingMax !== null)
    const values = pointsWithValues.map((point) => Number(point.trainingMax))
    const rawMin = Math.min(...values)
    const rawMax = Math.max(...values)
    const spread = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.08, 1)
    const min = rawMin - spread * 0.15
    const max = rawMax + spread * 0.15
    const innerWidth = WIDTH - PADDING.left - PADDING.right
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
    const x = (index: number): number => PADDING.left + (pointsWithValues.length === 1 ? innerWidth / 2 : index / (pointsWithValues.length - 1) * innerWidth)
    const y = (value: number): number => PADDING.top + (max - value) / (max - min) * innerHeight
    const points = pointsWithValues.map((point, index) => ({ ...point, x: x(index), y: y(Number(point.trainingMax)) }))
    const ticks = Array.from({ length: 4 }, (_, index) => {
      const value = min + (max - min) * index / 3
      return { value, y: y(value) }
    }).reverse()
    const labelStep = Math.max(1, Math.ceil(pointsWithValues.length / 6))
    return { points, ticks, labelStep }
  }, [history])

  return (
    <div className="tm-chart" role="img" aria-label={`Gráfica del histórico de TM de ${liftName}`}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
        {chart.ticks.map((tick) => (
          <g key={tick.value}>
            <line className="tm-chart-grid" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={tick.y} y2={tick.y} />
            <text className="tm-chart-axis-label" x={PADDING.left - 10} y={tick.y + 4} textAnchor="end">{formatValue(tick.value)}</text>
          </g>
        ))}
        <polyline className="tm-chart-line" points={chart.points.map((point) => `${point.x},${point.y}`).join(' ')} />
        {chart.points.map((point, index) => (
          <g key={point.sessionId}>
            <circle className="tm-chart-point" cx={point.x} cy={point.y} r="5">
              <title>{point.sessionId}: {formatValue(Number(point.trainingMax))} {units}</title>
            </circle>
            {(index % chart.labelStep === 0 || index === chart.points.length - 1) && (
              <text className="tm-chart-session-label" x={point.x} y={HEIGHT - 15} textAnchor="middle">{point.sessionId}</text>
            )}
          </g>
        ))}
      </svg>
      <ol className="sr-only">
        {history.map((point) => <li key={point.sessionId}>{point.sessionId}: {formatValue(Number(point.trainingMax))} {units}</li>)}
      </ol>
    </div>
  )
}
