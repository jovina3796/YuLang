'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, MessageSquare, Users, User } from 'lucide-react'
import ReminderTimePicker from './ReminderTimePicker'

import { 
  updateSystemSetting, 
  updateGroupName, 
  updateGroupReminderSettings, 
  updateDriverReminderSettings 
} from '@/app/(dashboard)/people/reminders/actions'

interface Props {
  initialWelcomeMsg: string
  groups: any[]
  drivers: any[]
}

export default function ReminderManagementClient({ initialWelcomeMsg, groups, drivers }: Props) {
  const router = useRouter()
  const [welcomeMsg, setWelcomeMsg] = useState(initialWelcomeMsg)
  const [savingMsg, setSavingMsg] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')

  // 儲存歡迎詞
  async function handleSaveWelcomeMsg() {
    setSavingMsg(true)
    const { error } = await updateSystemSetting('group_welcome_msg', welcomeMsg)
    setSavingMsg(false)
    if (error) alert(`儲存失敗：${error}`)
    else alert('✅ 歡迎訊息範本已成功更新！')
  }

  // 修改群組名稱
  async function handleSaveGroupName(id: string) {
    if (!editGroupName.trim()) return
    setBusyId(id)
    const { error } = await updateGroupName(id, editGroupName)
    setBusyId(null)
    if (error) alert(`修改失敗：${error}`)
    else {
      setEditingGroupId(null)
      router.refresh()
    }
  }

  // 🌟 包裝給 ReminderTimePicker 使用的儲存函式，儲存成功後自動重整畫面
  const handleSaveGroupTime = async (id: string, enabled: boolean, time: string) => {
    const res = await updateGroupReminderSettings(id, enabled, time)
    if (!res.error) router.refresh()
    return res
  }

  const handleSaveDriverTime = async (id: string, enabled: boolean, time: string) => {
    const res = await updateDriverReminderSettings(id, enabled, time)
    if (!res.error) router.refresh()
    return res
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1400 }}>
      
      {/* 1. 系統設定：管理提醒語句 */}
      <div className="card">
        <div className="card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} style={{ color: 'var(--blue2)' }} />
            <div className="card-title">LINE 官方帳號系統訊息設定</div>
          </div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>群組綁定成功歡迎詞</span>
            <textarea
              className="input"
              rows={4}
              style={{ width: '100%', fontFamily: 'inherit', padding: 10, boxSizing: 'border-box', resize: 'vertical' }}
              value={welcomeMsg}
              onChange={e => setWelcomeMsg(e.target.value)}
              placeholder="請輸入歡迎詞範本..."
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>💡 提示：訊息中的 <code>{'{GroupName}'}</code> 將會被自動替換為真實的 LINE 群組名稱。</span>
            <button className="btn btn-primary" onClick={handleSaveWelcomeMsg} disabled={savingMsg} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} /> {savingMsg ? '儲存中...' : '儲存訊息設定'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* 2. 群組管理列表與開關 */}
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} style={{ color: 'var(--green2)' }} />
              <div className="card-title">LINE 聊天群組提醒管理</div>
            </div>
          </div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>群組名稱 (雙擊可修改)</th>
                <th style={{ width: 350, textAlign: 'right' }}>每日報趟提醒</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>目前尚無綁定任何群組</td></tr>
              ) : groups.map(g => {
                // 相容舊欄位與新欄位
                const isEnabled = g.is_reminder_enabled ?? g.reminder_enabled ?? true
                return (
                  <tr key={g.id} style={{ opacity: isEnabled ? 1 : 0.6 }}>
                    <td>
                      {editingGroupId === g.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="text" className="input" style={{ padding: '2px 6px', fontSize: 13 }} value={editGroupName} onChange={e => setEditGroupName(e.target.value)} />
                          <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => handleSaveGroupName(g.id)}>儲存</button>
                          <button className="btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setEditingGroupId(null)}>取消</button>
                        </div>
                      ) : (
                        <span 
                          style={{ cursor: 'pointer', fontWeight: 450 }} 
                          title="點擊兩下可修改備註名稱"
                          onDoubleClick={() => {
                            setEditingGroupId(g.id)
                            setEditGroupName(g.name)
                          }}
                        >
                          {g.name}
                        </span>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>ID: {g.line_group_id.slice(0, 12)}...</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {/* 🌟 換上新的時間選擇器元件 */}
                      <ReminderTimePicker
                        targetId={g.id}
                        initialEnabled={isEnabled}
                        initialTime={g.reminder_time?.slice(0, 5) || '20:00'}
                        onSave={handleSaveGroupTime}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* 3. 個別司機提醒開關 */}
        <div className="card">
          <div className="card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} style={{ color: 'var(--amber2)' }} />
              <div className="card-title">個別司機私訊提醒管理</div>
            </div>
          </div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>司機姓名</th>
                <th style={{ width: 350, textAlign: 'right' }}>每日報趟提醒</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>無任何在職司機資料</td></tr>
              ) : drivers.map(d => {
                const isEnabled = d.is_daily_reminder_enabled ?? d.daily_reminder_enabled ?? true
                return (
                  <tr key={d.id} style={{ opacity: isEnabled ? 1 : 0.6 }}>
                    <td>
                      <span style={{ fontWeight: 450 }}>{d.name}</span>
                      {d.line_user_id ? (
                        <span style={{ fontSize: 11, color: 'var(--green2)', marginLeft: 8 }}>● 已綁定</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>○ 未綁定</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {d.line_user_id ? (
                        <ReminderTimePicker
                          targetId={d.id}
                          initialEnabled={isEnabled}
                          initialTime={d.daily_reminder_time?.slice(0, 5) || '20:00'}
                          onSave={handleSaveDriverTime}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>無法設定</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
