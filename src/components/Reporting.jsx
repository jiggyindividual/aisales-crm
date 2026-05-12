import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'
import { useCRM } from '../context/CRMContext'
import {
  STAGES, SERVICES, INDUSTRIES,
  formatCurrency, calculateLTV,
} from '../utils/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Reporting() {
  const { leads, settings } = useCRM()
  const active = leads.filter(l => !l.archived)
  const closedWon = active.filter(l => l.stage === 'closed-won')

  /* Stage funnel */
  const funnelData = useMemo(() =>
    STAGES.map(s => ({
      name: s.label.replace('/', '/\n'),
      shortName: s.label.length > 12 ? s.label.slice(0, 12) + '…' : s.label,
      count: active.filter(l => l.stage === s.id).length,
      fill: s.color,
    })), [active])

  /* Service breakdown */
  const serviceData = useMemo(() =>
    Object.entries(SERVICES).map(([k, v]) => ({
      name: v.label,
      leads: active.filter(l => l.service === k).length,
      won:   active.filter(l => l.service === k && l.stage === 'closed-won').length,
      mrr:   active.filter(l => l.service === k && l.stage === 'closed-won')
                   .reduce((s, l) => s + (parseFloat(l.monthlyFee)||0), 0),
      fill: v.color,
    })), [active])

  /* Industry wins */
  const industryData = useMemo(() => {
    const counts = {}
    closedWon.forEach(l => { counts[l.industry] = (counts[l.industry] || 0) + 1 })
    return Object.entries(counts)
      .sort((a,b) => b[1]-a[1])
      .map(([name, count]) => ({ name, count }))
  }, [closedWon])

  /* Average deal size */
  const avgDeal = useMemo(() => {
    const byService = {}
    Object.keys(SERVICES).forEach(k => {
      const group = closedWon.filter(l => l.service === k)
      byService[k] = group.length > 0
        ? group.reduce((s, l) => s + calculateLTV(l.monthlyFee, l.setupFee), 0) / group.length
        : 0
    })
    return Object.entries(byService).map(([k, v]) => ({
      name: SERVICES[k].label,
      value: Math.round(v),
      fill: SERVICES[k].color,
    }))
  }, [closedWon])

  /* Win / loss */
  const winRate = useMemo(() => {
    const won  = active.filter(l => l.stage === 'closed-won').length
    const lost = active.filter(l => l.stage === 'closed-lost').length
    const total = won + lost
    return { won, lost, rate: total > 0 ? Math.round((won / total) * 100) : 0 }
  }, [active])

  /* Revenue by month (last 6) */
  const revenueByMonth = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const won = closedWon.filter(l => {
        const e = l.stageHistory?.find(s => s.stage === 'closed-won')
        if (!e) return false
        const ld = new Date(e.timestamp)
        return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear()
      })
      months.push({
        month: label,
        mrr:   won.reduce((s,l) => s + (parseFloat(l.monthlyFee)||0), 0),
        setup: won.reduce((s,l) => s + (parseFloat(l.setupFee)||0), 0),
      })
    }
    return months
  }, [closedWon])

  /* Total calls */
  const allActivities = active.flatMap(l => l.activities || [])
  const callsAll   = allActivities.filter(a => a.type === 'call').length
  const callsMonth = allActivities.filter(a => {
    const now = new Date()
    const d = new Date(a.date)
    return a.type === 'call' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const callsWeek = allActivities.filter(a => {
    const d = new Date(a.date)
    return a.type === 'call' && (Date.now() - d.getTime()) < 7 * 86400000
  }).length

  const convRate = active.length > 0
    ? Math.round((closedWon.length / active.length) * 100)
    : 0

  /* Goal history (same 6 months) */
  const goalProgress = revenueByMonth.map(m => ({
    ...m,
    goal: settings.monthlyGoal,
    pct: settings.monthlyGoal > 0 ? Math.round((m.mrr / settings.monthlyGoal) * 100) : 0,
  }))

  const SectionTitle = ({ children }) => (
    <h2 className="font-syne font-bold text-white text-base mb-4">{children}</h2>
  )

  return (
    <div className="p-5 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <h1 className="font-syne font-bold text-white text-2xl">Reporting</h1>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Conversion Rate', `${convRate}%`, 'cold → closed won'],
          ['Win / Loss', `${winRate.won}W / ${winRate.lost}L`, `${winRate.rate}% win rate`],
          ['Calls All Time', callsAll, `${callsMonth} this month`],
          ['Calls This Week', callsWeek, 'logged calls'],
        ].map(([label, value, sub]) => (
          <div key={label} className="glass rounded-2xl p-5">
            <p className="text-xs text-white/40 uppercase tracking-wide font-medium mb-2">{label}</p>
            <p className="font-syne font-bold text-white text-2xl">{value}</p>
            <p className="text-xs text-white/30 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue by month */}
      <div className="glass rounded-2xl p-5">
        <SectionTitle>Revenue Last 6 Months</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenueByMonth} barGap={4}>
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v > 0 ? `$${(v/1000).toFixed(0)}k` : '$0'} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="mrr"   name="MRR"   fill="#00FF88" radius={[4,4,0,0]} />
            <Bar dataKey="setup" name="Setup" fill="#0088FF" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Stage funnel */}
        <div className="glass rounded-2xl p-5">
          <SectionTitle>Pipeline Funnel</SectionTitle>
          <div className="space-y-2">
            {funnelData.map(s => {
              const maxCount = Math.max(...funnelData.map(x => x.count), 1)
              const pct = Math.round((s.count / maxCount) * 100)
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-[10px] text-white/40 w-32 flex-shrink-0 truncate">{s.shortName}</span>
                  <div className="flex-1 progress-bar">
                    <div className="progress-fill funnel-bar" style={{ width: `${pct}%`, background: s.fill }} />
                  </div>
                  <span className="text-[10px] text-white/50 w-6 text-right">{s.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Closed won by service */}
        <div className="glass rounded-2xl p-5">
          <SectionTitle>Closed Won by Service</SectionTitle>
          <div className="space-y-4">
            {serviceData.map(s => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.fill }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/60">{s.name}</span>
                    <span className="text-xs text-white/40">{s.won} won · {formatCurrency(s.mrr)}/mo</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${Math.max(...serviceData.map(x=>x.leads), 1) > 0
                        ? (s.leads / Math.max(...serviceData.map(x=>x.leads))) * 100 : 0}%`,
                      background: s.fill,
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Industry performance */}
        <div className="glass rounded-2xl p-5">
          <SectionTitle>Best Performing Industries</SectionTitle>
          {industryData.length === 0 ? (
            <p className="text-white/25 text-sm">No closed deals yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={industryData} layout="vertical">
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Wins" fill="#FFD700" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Average deal size */}
        <div className="glass rounded-2xl p-5">
          <SectionTitle>Avg Deal Size (LTV)</SectionTitle>
          <div className="space-y-4 mt-2">
            {avgDeal.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/60">{d.name}</span>
                  <span className="text-sm font-semibold" style={{ color: d.fill }}>{formatCurrency(d.value)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${Math.max(...avgDeal.map(x=>x.value), 1) > 0
                      ? (d.value / Math.max(...avgDeal.map(x=>x.value))) * 100 : 0}%`,
                    background: d.fill,
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Goal history */}
          {settings.monthlyGoal > 0 && (
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">Monthly Goal Progress</p>
              <div className="space-y-1.5">
                {goalProgress.map(m => (
                  <div key={m.month} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 w-10">{m.month}</span>
                    <div className="flex-1 progress-bar">
                      <div className="progress-fill" style={{
                        width: `${Math.min(m.pct, 100)}%`,
                        background: m.pct >= 100 ? '#00FF88' : m.pct >= 60 ? '#FF9500' : '#0088FF',
                      }} />
                    </div>
                    <span className="text-[10px] text-white/30 w-8 text-right">{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
