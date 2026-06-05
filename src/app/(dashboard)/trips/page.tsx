import { createServiceClient } from '@/lib/supabase/service'
import TripFormModal from '@/components/TripFormModal'
import TripRowActions from '@/components/TripRowActions'
import TripDateFilter from '@/components/TripDateFilter'
import TripImportExport from '@/components/TripImportExport'
import SortableTh from '@/components/SortableTh'
import Pagination, { resolvePageWindow } from '@/components/Pagination'
import { Check } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { loadScopeFor } from '@/lib/rolePermissions.server'

type SortField =
  | 'departed_at' | 'vendor' | 'area' | 'service' | 'driver' | 'vehicle'
  | 'trip_count' | 'destination_area' | 'actual_stops' | 'final_fare'

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string; to?: string; vendor?: string;
    sort?: string; dir?: string;
    page?: string; pageSize?: string;
  }>
}) {
  const supabase = createServiceClient()
  const { from, to, vendor, sort, dir, page: pageRaw, pageSize: pageSizeRaw } = await searchParams

  const sortField: SortField = (sort as SortField) || 'departed_at'
  const ascending = dir === 'asc'

  const fromIso = from ? new Date(`${from}T00:00:00+08:00`).toISOString() : null
  const toIso   = to   ? new Date(`${to}T23:59:59.999+08:00`).toISOString() : null

  // Resource scope: 'self' restricts the query (and mutations) to the
  // current user's linked driver_id. If scoped but no driver_id is linked,
  // the query is forced empty so partial leaks are impossible.
  const profile = await getCurrentProfile()
  const scope = profile ? await loadScopeFor(profile.role, 'trips') : 'all'
  const scopedToSelf = scope === 'self'
  const ownDriverId = profile?.driver_id ?? null

  let tripsQuery = supabase
    .from('trips')
    .select(`
      id, departed_at, trip_count, destination_area, actual_stops,
      final_fare, notes, status, vendor_id, rate_rule_id, driver_id, vehicle_id, is_kpi_achieved, is_special,
      vendors(name, warehouse),
      drivers(name),
      vehicles(plate_number),
      vendor_rate_rules!rate_rule_id(service_type, rule_area:destination_area, pricing_mode)
    `)
    .order('departed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (fromIso) tripsQuery = tripsQuery.gte('departed_at', fromIso)
  if (toIso)   tripsQuery = tripsQuery.lte('departed_at', toIso)
  if (vendor)  tripsQuery = tripsQuery.eq('vendor_id', vendor)
  if (scopedToSelf) {
    if (!ownDriverId) tripsQuery = tripsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    else              tripsQuery = tripsQuery.eq('driver_id', ownDriverId)
  }

  const [
    { data: trips },
    { data: vendors },
    { data: rateRules },
    { data: drivers },
    { data: vehicles },
  ] = await Promise.all([
    tripsQuery,
    supabase.from('vendors').select('id, name, warehouse').order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase
      .from('vendor_rate_rules')
      .select('id, vendor_id, service_type, destination_area, base_trips, base_fare, kpi_fare, base_stops, surcharge_per_stop, pricing_mode, special_rate, special_rate_note, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('service_type'),
    supabase.from('drivers').select('id, name').eq('status', 'active').order('display_order', { ascending: true, nullsFirst: false }).order('name'),
    supabase.from('vehicles').select('id, plate_number').order('display_order', { ascending: true, nullsFirst: false }).order('plate_number'),
  ])

  const getSortKey = (t: any): string | number | null => {
    switch (sortField) {
      case 'departed_at':      return t.departed_at ?? ''
      case 'vendor':           return t.vendors ? `${t.vendors.name ?? ''}${t.vendors.warehouse ?? ''}` : ''
      case 'area':             return t.vendor_rate_rules?.rule_area ?? ''
      case 'service':          return t.vendor_rate_rules?.service_type ?? ''
      case 'driver':           return t.drivers?.name ?? ''
      case 'vehicle':          return t.vehicles?.plate_number ?? ''
      case 'trip_count':       return t.trip_count ?? 0
      case 'destination_area': return t.destination_area ?? ''
      case 'actual_stops':     return t.actual_stops ?? -1
      case 'final_fare':       return t.final_fare ?? -1
      default:                 return ''
    }
  }

  const sortedTrips = [...(trips ?? [])].sort((a, b) => {
    const av = getSortKey(a)
    const bv = getSortKey(b)
    if (av === bv) return 0
    if (typeof av === 'number' && typeof bv === 'number') {
      return ascending ? av - bv : bv - av
    }
    const cmp = String(av).localeCompare(String(bv), 'zh-Hant')
    return ascending ? cmp : -cmp
  })

  // Aggregate stats over the full filtered set (not just the visible page).
  const totalRows  = sortedTrips.length
  const totalTrips = sortedTrips.reduce((s: number, t: any) => s + Number(t.trip_count ?? 0), 0)
  const totalFare  = sortedTrips.reduce((s: number, t: any) => s + Number(t.final_fare  ?? 0), 0)

  // Resolve page window from the URL.
  const win = resolvePageWindow(totalRows, pageRaw, pageSizeRaw)
  const pageTrips = sortedTrips.slice(win.startIdx, win.endIdx)

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <TripDateFilter vendors={vendors ?? []} />
        <div style={{ flex: 1 }} />
        {!scopedToSelf && (
          <>
            <TripImportExport />
            <TripFormModal
              vendors={vendors ?? []}
              rateRules={rateRules ?? []}
              drivers={drivers ?? []}
              vehicles={vehicles ?? []}
              mode="create"
            />
          </>
        )}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12,
        padding: '8px 14px',
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 13, color: 'var(--text2)',
      }}>
        <span>
          車趟：<span style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', fontWeight: 700 }}>
            {totalTrips.toLocaleString()}
          </span> 趟
        </span>
        <span style={{ color: 'var(--text3)' }}>|</span>
        <span>
          運費小計：<span style={{ fontFamily: 'var(--mono)', color: 'var(--accent2)', fontWeight: 700 }}>
            ${totalFare.toLocaleString()}
          </span>
        </span>
        <span style={{ color: 'var(--text3)' }}>|</span>
        <span style={{ color: 'var(--text3)' }}>
          紀錄筆數 {totalRows.toLocaleString()}
        </span>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '3%' }} />
            <col style={{ width: '4%' }} />
            <col />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr>
              <SortableTh field="departed_at" align="center">日期</SortableTh>
              <SortableTh field="vendor" align="left">廠商</SortableTh>
              <SortableTh field="service" align="left">業務</SortableTh>
              <SortableTh field="trip_count" align="center">趟數</SortableTh>
              <SortableTh field="destination_area" align="left">配送區域</SortableTh>
              <SortableTh field="actual_stops" align="center">店點數</SortableTh>
              <SortableTh field="actual_stops" align="center">籃件數</SortableTh>
              <SortableTh field="final_fare" align="right">運費</SortableTh>
              <th>KPI</th>
              <th>加成</th>
              <th>備註</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!sortedTrips.length ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>
                  尚無資料
                </td>
              </tr>
            ) : pageTrips.map((t: any) => {
              const rule      = t.vendor_rate_rules
              const isPerStop = rule?.pricing_mode === 'per_stop_count'
              return (
                <tr key={t.id}>
                  <td className="mono" style={{ textAlign: 'center' }}>
                    {t.departed_at
                      ? new Date(t.departed_at).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Taipei' })
                      : ''}
                  </td>
                  <td className="name" style={{ textAlign: 'left' }}>
                    {t.vendors
                      ? `${t.vendors.name}${t.vendors.warehouse ? `／${t.vendors.warehouse}` : ''}`
                      : ''}
                  </td>
                  <td style={{ textAlign: 'left' }}>{rule?.service_type ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'center' }}>{t.trip_count ?? ''}</td>
                  <td style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'left' }}>{t.destination_area ?? ''}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {!isPerStop && t.actual_stops != null ? t.actual_stops : ''}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {isPerStop && t.actual_stops != null ? t.actual_stops : ''}
                  </td>
                  <td className="mono" style={{ color: 'var(--accent2)', textAlign: 'right' }}>
                    {t.final_fare != null ? t.final_fare.toLocaleString() : ''}
                  </td>
                  <td style={{ padding: '11px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {t.is_kpi_achieved ? <Check size={14} style={{ color: 'var(--accent2)' }} /> : null}
                    </div>
                  </td>
                  <td style={{ padding: '11px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {t.is_special ? <Check size={14} style={{ color: 'var(--accent2)' }} /> : null}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-word' }}>{t.notes ?? ''}</td>
                  <td style={{ textAlign: 'right', padding: '11px 8px' }}>
                    {!scopedToSelf && (
                      <TripRowActions
                        trip={{
                          id: t.id,
                          vendor_id: t.vendor_id,
                          rate_rule_id: t.rate_rule_id,
                          driver_id: t.driver_id ?? null,
                          vehicle_id: t.vehicle_id ?? null,
                          destination_area: t.destination_area ?? null,
                          departed_at: t.departed_at ?? null,
                          actual_stops: t.actual_stops ?? null,
                          is_kpi_achieved: t.is_kpi_achieved ?? null,
                          is_special: t.is_special ?? null,
                          trip_count: t.trip_count ?? 1,
                          notes: t.notes ?? null,
                        }}
                        vendors={vendors ?? []}
                        rateRules={rateRules ?? []}
                        drivers={drivers ?? []}
                        vehicles={vehicles ?? []}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalRows > 0 && (
        <Pagination
          page={win.page}
          totalPages={win.totalPages}
          total={totalRows}
          pageSize={win.pageSizeStr}
        />
      )}
    </div>
  )
}
