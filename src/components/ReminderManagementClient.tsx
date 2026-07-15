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
  initialReminderMsg: string // 🌟 新增：接收每日提醒詞
  groups: any[]
  drivers: any[]
}

export default function ReminderManagementClient({ initialWelcomeMsg, initialReminderMsg, groups, drivers }: Props) {
  const router = useRouter()
  
  // 🌟 狀態管理：同時管理兩個訊息
  const [welcomeMsg, setWelcomeMsg] = useState(initialWelcomeMsg)
  const [reminderMsg, setReminderMsg] = useState(initialReminderMsg)
  
  const [savingMsg, setSavingMsg] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')

  // 🌟 合併儲存：一次把兩個系統設定都寫入資料庫
  async function handleSaveMessages() {
    setSavingMsg(true)
    const res1 = await updateSystemSetting('group_welcome_msg', welcomeMsg)
    const res2 = await updateSystemSetting('daily_reminder_msg', reminderMsg)
    setSavingMsg(false)
    
    if (res1.error || res2.error) {
      alert(`儲存失敗：${res1.error || res2.error}`)
    } else {
      alert('✅ 系統訊息範本已成功更新！')
      router.refresh()
    }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      
      {/* 1. 系統設定：管理提醒語句 */}
      <div className="card">
        <div className="card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} style={{ color: 'var(--blue2)' }} />
            <div className="card-title">LINE 官方帳號系統訊息設定</div>
          </div>
        </div>
        
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* 左側：綁定歡迎詞 */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>🔗 群組綁定成功歡迎詞</span>
              <textarea
                className="input"
                rows={4}
                style={{ width: '100%', fontFamily: 'inherit', padding: 10, boxSizing: 'border-box', resize: 'vertical' }}
                value={welcomeMsg}
                onChange={e => setWelcomeMsg(e.target.value)}
                placeholder="請輸入群組綁定成功的歡迎詞範本..."
              />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>💡 提示：輸入 <code>{'{GroupName}'}</code> 將自動替換為真實群組名稱。</span>
            </label>

            {/* 右側：定時提醒詞 (🌟 新增) */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>⏰ 每日報趟定時提醒詞</span>
              <textarea
                className="input"
                rows={4}
                style={{ width: '100%', fontFamily: 'inherit', padding: 10, boxSizing: 'border-box', resize: 'vertical' }}
                value={reminderMsg}
                onChange={e => setReminderMsg(e.target.value)}
                placeholder="請輸入每日提醒司機報趟的推播內容... (例如：大家辛苦了！請記得回報今日車趟喔 🚛)"
              />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>💡 此訊息將依照下方設定的時間，自動推播至群組或私訊。</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button className="btn btn-primary" onClick={handleSaveMessages} disabled={savingMsg} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} /> {savingMsg ? '儲存中...' : '儲存系統訊息設定'}
            </button>
          </div>

        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* 2. 群組管理列表與開關 (保持不變) */}
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
                <th style={{ width: 400, textAlign: 'right' }}>每日報趟提醒</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>目前尚無綁定任何群組</td></tr>
              ) : groups.map(g => {
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
                          style={{ cursor: 'pointer', fontWeight: 600 }} 
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

        {/* 3. 個別司機提醒開關 (保持不變) */}
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
                <th style={{ width: 400, textAlign: 'right' }}>每日報趟提醒</th>
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
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
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
