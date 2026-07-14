import { createServiceClient } from '@/lib/supabase/service'
import TripFormModal from '@/components/TripFormModal'
import TripRowActions from '@/components/TripRowActions'
import TripDateFilter from '@/components/TripDateFilter'
import TripImportExport from '@/components/TripImportExport'
import SortableTh from '@/components/SortableTh'
import Pagination from '@/components/Pagination'
import { resolvePageWindow } from '@/lib/pagination'
import { Check } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { loadScopeFor } from '@/lib/rolePermissions.server'
import DriverFilter from '@/components/DriverFilter' 

export default async function TripsPage({ searchParams }: { searchParams: Promise<any> }) {
  const supabase = createServiceClient()
  const { from, to, vendor, driver: driverId, sort, dir, page: pageRaw, pageSize: pageSizeRaw } = await searchParams

  const sortField = (sort as string) || 'departed_at'
  const ascending = dir === 'asc'

  const fromIso = from ? new Date(`${from}T00:00:00+08:00`).toISOString() : null
  const toIso   = to   ? new Date(`${to}T23:59:59.999+08:00`).toISOString() : null

  const profile = await getCurrentProfile()
  const scope = profile ? await loadScopeFor(profile.role, 'trips') : 'all'
  const scopedToSelf = scope === 'self'
  const ownDriverId = profile?.driver_id ?? null

  let tripsQuery = supabase
    .from('trips')
    .select(`
      id, departed_at, trip_count, destination_area, actual_stops,
      final_fare, notes, status, vendor_id, rate_rule_id, driver_id, vehicle_id, 
      is_kpi_achieved, is_special, surcharge_name, surcharge_rate,
      vendors(name, warehouse),
      drivers(name),
      vehicles(plate_number),
      vendor_rate_rules!rate_rule_id(service_type, rule_area:destination_area, pricing_mode)
    `)
    .order('departed_at', { ascending: false })

  if (fromIso) tripsQuery = tripsQuery.gte('departed_at', fromIso)
  if (toIso)   tripsQuery = tripsQuery.lte('departed_at', toIso)
  if (vendor)  tripsQuery = tripsQuery.eq('vendor_id', vendor)
  if (driverId) tripsQuery = tripsQuery.eq('driver_id', driverId)
  
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
    { data: surcharges },
  ] = await Promise.all([
    tripsQuery,
    supabase.from('vendors').select('id, name, warehouse').order('name'),
    supabase.from('vendor_rate_rules').select('*').eq('is_active', true),
    supabase.from('drivers').select('id, name').eq('status', 'active').order('name'),
    supabase.from('vehicles').select('id, plate_number').order('plate_number'),
    supabase.from('vendor_surcharges').select('id, vendor_id, name, rate').eq('is_active', true), 
  ])

  // 排序邏輯與統計
  const totalRows = trips?.length ?? 0
  const totalTrips = trips?.reduce((s: number, t: any) => s + Number(t.trip_count ?? 0), 0) ?? 0
  const totalFare  = trips?.reduce((s: number, t: any) => s + Number(t.final_fare  ?? 0), 0) ?? 0

  const win = resolvePageWindow(totalRows, pageRaw, pageSizeRaw)
  const pageTrips = trips?.slice(win.startIdx, win.endIdx) ?? []

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <TripDateFilter vendors={vendors ?? []} />
        {/* 🌟 司機篩選器 */}
        <DriverFilter drivers={drivers ?? []} /> 
        
        <div style={{ flex: 1 }} />
        {!scopedToSelf && (
          <>
            <TripImportExport />
            <TripFormModal
              vendors={vendors ?? []}
              rateRules={rateRules ?? []}
              drivers={drivers ?? []}
              vehicles={vehicles ?? []}
              surcharges={surcharges ?? []} // 🌟 記得傳入！
              mode="create"
            />
          </>
        )}
      </div>

      {/* 🌟 補回統計資訊欄位 */}
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
        <table style={{ width: '100%', minWidth: '1000px' }}>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>日期</th>
              <th style={{ width: '100px' }}>司機</th>
              <th style={{ width: '120px' }}>廠商</th>
              <th style={{ width: '80px' }}>業務</th>
              <th style={{ width: '60px' }}>趟數</th>
              <th style={{ width: '80px' }}>區域</th>
              <th style={{ width: '80px' }}>店點/籃件</th>
              <th style={{ width: '100px', textAlign: 'right' }}>運費</th>
              <th style={{ width: '50px' }}>KPI</th>
              <th style={{ width: '120px' }}>特殊加成</th>
              <th>備註</th>
              <th style={{ width: '80px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {!pageTrips.length ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>
                  尚無資料
                </td>
              </tr>
            ) : pageTrips.map((t: any) => (
              <tr key={t.id}>
                <td style={{ textAlign: 'center' }}>
                  {new Date(t.departed_at).toLocaleDateString('zh-TW', { 
                    timeZone: 'Asia/Taipei', 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                  })}
                </td>
                <td>{t.drivers?.name ?? '-'}</td>
                <td>{t.vendors?.name ?? ''}</td>
                <td>{t.vendor_rate_rules?.service_type ?? ''}</td>
                <td style={{ textAlign: 'center' }}>{t.trip_count}</td>
                <td>{t.destination_area ?? '-'}</td>
                <td style={{ textAlign: 'center' }}>{t.actual_stops ?? ''}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{t.final_fare?.toLocaleString()}</td>
                <td style={{ textAlign: 'center' }}>{t.is_kpi_achieved ? <Check size={16} color="green" /> : ''}</td>
                <td>
                  {/* 🌟 顯示資料庫存進去的特殊加成名稱 */}
                  {t.surcharge_name ? (
                    <span className="badge badge-amber">{t.surcharge_name}</span>
                  ) : '-'}
                </td>
                <td style={{ fontSize: 12 }}>{t.notes}</td>
                <td>
                  <TripRowActions 
                    trip={t} 
                    vendors={vendors ?? []} 
                    rateRules={rateRules ?? []} 
                    drivers={drivers ?? []} 
                    vehicles={vehicles ?? []}
                    surcharges={surcharges ?? []} // 🌟 記得傳入！
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 🌟 補回分頁元件 */}
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
