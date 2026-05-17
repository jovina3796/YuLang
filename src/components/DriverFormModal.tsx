'use client'
import { useState } from 'react'
import { PencilLine, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createDriver, updateDriver, type DriverInput } from '@/app/(dashboard)/drivers/actions'

export type DriverRow = {
  id:                   string
  employee_no:          string | null
  name:                 string
  birth_date:           string | null
  id_number:            string | null
  phone:                string | null
  household_address:    string | null
  mail_address:         string | null
  email:                string | null
  license_type:         string | null
  license_renewal_date: string | null
  hire_date:            string | null
  leave_date:           string | null
  labor_insurance:      string | null
  health_insurance:     string | null
  line_user_id:         string | null
  bank_name:            string | null
  bank_account:         string | null
  default_vehicle_id:   string | null
  status:               string
  display_order:        number | null
  show_in_dashboard:    boolean
  show_in_schedule:     boolean
}

interface Props {
  vehicles: { id: string; plate_number: string }[]
  mode:     'create' | 'edit'
  initial?: DriverRow
  trigger?: React.ReactNode
}

export default function DriverFormModal({ vehicles, mode, initial, trigger }: Props) {
  const router = useRouter()

  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)

  const [employeeNo, setEmployeeNo] = useState(initial?.employee_no ?? '')
  const [name,       setName]       = useState(initial?.name ?? '')
  const [birthDate,  setBirthDate]  = useState(initial?.birth_date ?? '')
  const [idNumber,   setIdNumber]   = useState(initial?.id_number ?? '')
  const [phone,      setPhone]      = useState(initial?.phone ?? '')
  const [householdAddress, setHouseholdAddress] = useState(initial?.household_address ?? '')
  const [mailAddress, setMailAddress] = useState(initial?.mail_address ?? '')
  const [email,      setEmail]      = useState(initial?.email ?? '')
  const [licenseType,setLicenseType]= useState(initial?.license_type ?? '')
  const [licenseRenewal, setLicenseRenewal] = useState(initial?.license_renewal_date ?? '')
  const [hireDate,   setHireDate]   = useState(initial?.hire_date ?? '')
  const [leaveDate,  setLeaveDate]  = useState(initial?.leave_date ?? '')
  const [laborIns,   setLaborIns]   = useState(initial?.labor_insurance ?? '')
  const [healthIns,  setHealthIns]  = useState(initial?.health_insurance ?? '')
  const [lineId,     setLineId]     = useState(initial?.line_user_id ?? '')
  const [bankName,   setBankName]   = useState(initial?.bank_name ?? '')
  const [bankAccount,setBankAccount]= useState(initial?.bank_account ?? '')
  const [defaultVehicleId, setDefaultVehicleId] = useState(initial?.default_vehicle_id ?? '')
  const [status,     setStatus]     = useState(initial?.status ?? 'active')
  const [displayOrder, setDisplayOrder] = useState<number | ''>(initial?.display_order ?? '')
  const [showDashboard, setShowDashboard] = useState<boolean>(initial?.show_in_dashboard ?? true)
  const [showSchedule,  setShowSchedule]  = useState<boolean>(initial?.show_in_schedule  ?? true)

  // 離職時自動關閉兩個顯示開關（與 DB trigger 行為對齊）
  const inactive = status === 'inactive'

  function resetForm() {
    if (mode === 'create') {
      setEmployeeNo(''); setName(''); setBirthDate(''); setIdNumber(''); setPhone('')
      setHouseholdAddress(''); setMailAddress(''); setEmail('')
      setLicenseType(''); setLicenseRenewal(''); setHireDate(''); setLeaveDate('')
      setLaborIns(''); setHealthIns(''); setLineId('')
      setBankName(''); setBankAccount('')
      setDefaultVehicleId('')
      setStatus('active'); setDisplayOrder('')
      setShowDashboard(true); setShowSchedule(true)
    }
  }

  async function handleSubmit() {
    if (!name.trim()) return
    const payload: DriverInput = {
      employee_no:          employeeNo.trim() || null,
      name:                 name.trim(),
      birth_date:           birthDate || null,
      id_number:            idNumber.trim() || null,
      phone:                phone.trim() || null,
      household_address:    householdAddress.trim() || null,
      mail_address:         mailAddress.trim() || null,
      email:                email.trim() || null,
      license_type:         licenseType.trim() || null,
      license_renewal_date: licenseRenewal || null,
      hire_date:            hireDate || null,
      leave_date:           leaveDate || null,
      labor_insurance:      laborIns.trim() || null,
      health_insurance:     healthIns.trim() || null,
      line_user_id:         lineId.trim() || null,
      bank_name:            bankName.trim() || null,
      bank_account:         bankAccount.trim() || null,
      default_vehicle_id:   defaultVehicleId || null,
      status,
      display_order: displayOrder === '' ? null : Number(displayOrder),
      show_in_dashboard: inactive ? false : showDashboard,
      show_in_schedule:  inactive ? false : showSchedule,
    }
    setSaving(true)
    const { error } = mode === 'create'
      ? await createDriver(payload)
      : await updateDriver(initial!.id, payload)
    setSaving(false)
    if (error) { alert(`儲存失敗：${error}`); return }
    setOpen(false); resetForm(); router.refresh()
  }

  const L: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 5 }
  const LT: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', textAlign: 'left' }
  const G2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  const defaultTrigger = mode === 'create'
    ? <button className="btn btn-primary" onClick={() => setOpen(true)} title="新增司機" style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 12px' }}><Plus size={16} /></button>
    : <button className="icon-btn" onClick={() => setOpen(true)} title="編輯"><PencilLine size={14} /></button>

  return (
    <>
      {trigger
        ? <span onClick={() => setOpen(true)} style={{ display: 'inline-flex' }}>{trigger}</span>
        : defaultTrigger}

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => e.target === e.currentTarget && (setOpen(false), resetForm())}
        >
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 14, width: '100%', maxWidth: 640,
            padding: '28px 28px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {mode === 'create' ? '新增人員' : '編輯人員'}
            </div>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>員工編號</span>
                <input type="text" className="input" value={employeeNo}
                       onChange={e => setEmployeeNo(e.target.value)} placeholder="例：EMP001" />
              </label>
              <label style={L}>
                <span style={LT}>姓名</span>
                <input type="text" className="input" value={name}
                       onChange={e => setName(e.target.value)} placeholder="必填" />
              </label>
            </div>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>生日</span>
                <input type="date" className="input" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>身分證字號</span>
                <input type="text" className="input" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
              </label>
            </div>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>手機號碼</span>
                <input type="tel" className="input" value={phone}
                       onChange={e => setPhone(e.target.value)} placeholder="例：0912-345-678" />
              </label>
              <label style={L}>
                <span style={LT}>E-Mail</span>
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
              </label>
            </div>

            <label style={L}>
              <span style={LT}>戶籍地址</span>
              <input type="text" className="input" value={householdAddress}
                     onChange={e => setHouseholdAddress(e.target.value)} />
            </label>
            <label style={L}>
              <span style={LT}>通訊地址</span>
              <input type="text" className="input" value={mailAddress}
                     onChange={e => setMailAddress(e.target.value)} />
            </label>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>駕照類別</span>
                <input type="text" className="input" value={licenseType}
                       onChange={e => setLicenseType(e.target.value)} placeholder="例：職業大貨車" />
              </label>
              <label style={L}>
                <span style={LT}>駕照審驗日期</span>
                <input type="date" className="input" value={licenseRenewal}
                       onChange={e => setLicenseRenewal(e.target.value)} />
              </label>
            </div>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>入職日期</span>
                <input type="date" className="input" value={hireDate} onChange={e => setHireDate(e.target.value)} />
              </label>
              <label style={L}>
                <span style={LT}>離職日期</span>
                <input type="date" className="input" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
              </label>
            </div>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>勞保</span>
                <input type="text" className="input" value={laborIns}
                       onChange={e => setLaborIns(e.target.value)} placeholder="例：投保金額 / 投保單位" />
              </label>
              <label style={L}>
                <span style={LT}>健保</span>
                <input type="text" className="input" value={healthIns}
                       onChange={e => setHealthIns(e.target.value)} placeholder="例：投保金額 / 投保單位" />
              </label>
            </div>

            <div style={G2}>
              <label style={L}>
                <span style={LT}>LINE 綁定 ID</span>
                <input type="text" className="input" value={lineId}
                       onChange={e => setLineId(e.target.value)} placeholder="LINE userId" />
              </label>
              <label style={L}>
                <span style={LT}>狀態</span>
                <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">在職</option>
                  <option value="inactive">離職</option>
                </select>
              </label>
            </div>

            <label style={L}>
              <span style={LT}>預設車輛（LINE 加油快速回報用，當天無排班車輛時使用）</span>
              <select className="input" value={defaultVehicleId} onChange={e => setDefaultVehicleId(e.target.value)}>
                <option value="">— 未設定 —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
              </select>
            </label>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 2 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 10, textAlign: 'left' }}>薪資轉帳資訊</div>
              <div style={G2}>
                <label style={L}>
                  <span style={LT}>銀行名稱（代碼）</span>
                  <input type="text" className="input" value={bankName}
                         onChange={e => setBankName(e.target.value)} placeholder="例：玉山銀行 (808)" />
                </label>
                <label style={L}>
                  <span style={LT}>銀行帳號</span>
                  <input type="text" className="input" value={bankAccount}
                         onChange={e => setBankAccount(e.target.value)} placeholder="例：1234-5678-9012" />
                </label>
              </div>
            </div>

            <label style={L}>
              <span style={LT}>顯示順序（選填）</span>
              <input type="number" className="input" value={displayOrder}
                     onChange={e => setDisplayOrder(e.target.value === '' ? '' : Number(e.target.value))} />
            </label>

            <div style={{
              borderTop: '1px solid var(--border)', paddingTop: 12,
              display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
              opacity: inactive ? 0.5 : 1,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>顯示範圍</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: inactive ? 'not-allowed' : 'pointer' }}>
                <input type="checkbox" checked={inactive ? false : showDashboard} disabled={inactive}
                       onChange={e => setShowDashboard(e.target.checked)} />
                <span>儀表板人員管理</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: inactive ? 'not-allowed' : 'pointer' }}>
                <input type="checkbox" checked={inactive ? false : showSchedule} disabled={inactive}
                       onChange={e => setShowSchedule(e.target.checked)} />
                <span>排班設定</span>
              </label>
              {inactive && <span style={{ fontSize: 11, color: 'var(--text3)' }}>離職司機自動隱藏</span>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => { setOpen(false); resetForm() }}>取消</button>
              <button
                className="btn btn-primary"
                disabled={!name.trim() || saving}
                onClick={handleSubmit}
              >
                {saving ? '儲存中…' : mode === 'create' ? '確認新增' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
