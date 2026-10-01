import { ArrowLeft } from 'lucide-react';
import { CurrencyControls } from './Currency';
import React from 'react';
import { MenuItem, SettingsSection } from './AppChrome';
import { useGmail } from '../hooks/useGmail';
import { Avatar } from './ui';

interface Props {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  userEmail: string | null;
  onLanguage: (language: 'en' | 'zh') => void;
  onTheme: (theme: 'light' | 'dark') => void;
  dataItems: MenuItem[];
  onBack: () => void;
}
export default function SettingsPage({ section, onSection, language, theme, userEmail, onLanguage, onTheme, dataItems, onBack }: Props) {
  const zh = language === 'zh';
  const gmail = useGmail();
  const sections: [SettingsSection, string][] = [['account', zh ? '帳號資訊' : 'Account'], ['preferences', zh ? '外觀與語言' : 'Appearance & language'], ['integrations', zh ? '整合服務' : 'Integrations'], ['data', zh ? '資料管理' : 'Data management']];
  return <div className="h-full overflow-y-auto pb-8 max-w-5xl mx-auto">
    <button onClick={onBack} className="btn btn-ghost mb-4"><ArrowLeft className="w-4 h-4" />{zh ? '返回工作區' : 'Back to workspace'}</button>
    <p className="text-sm text-text-secondary mb-6">{zh ? '管理你的使用偏好、整合與客戶資料。' : 'Manage your preferences, integrations, and customer data.'}</p>
    <div className="flex flex-col md:flex-row gap-6">
      <nav aria-label={zh ? '設定分類' : 'Settings sections'} className="flex md:flex-col overflow-x-auto gap-1 md:w-44 flex-shrink-0">
        {sections.map(([key, label]) => <button key={key} onClick={() => onSection(key)} aria-current={key === section ? 'page' : undefined} className={'btn justify-start ' + (key === section ? 'bg-secondary text-primary' : 'btn-ghost')}>{label}</button>)}
      </nav>
      <section className="card p-5 md:p-7 flex-grow min-w-0 space-y-5" aria-label={sections.find(([key]) => key === section)?.[1]}>
        <h3 className="text-lg font-semibold">{sections.find(([key]) => key === section)?.[1]}</h3>
        {section === 'account' && <>
          {userEmail ? <div className="flex items-center gap-3"><Avatar name={userEmail} /><div><p className="font-medium">{userEmail.split('@')[0]}</p><p className="text-sm text-text-secondary">{userEmail}</p></div></div> : <div className="rounded-lg bg-secondary p-4"><p className="font-medium">{zh ? '本機模式 · 尚未登入' : 'Local mode · Not signed in'}</p><p className="text-sm text-text-secondary mt-2">{zh ? '客戶資料只儲存在目前瀏覽器。匯出備份可避免更換裝置時遺失資料。' : 'Customer data is saved only in this browser. Export a backup before changing devices.'}</p></div>}
          <p className="text-sm text-text-secondary">{userEmail ? (zh ? '目前使用已驗證的登入 Email 辨識帳號。' : 'Your verified sign-in email identifies your account.') : (zh ? '雲端登入尚未在此環境啟用；啟用後登入頁會自動顯示。' : 'Cloud sign-in is not enabled in this environment.')}</p>
        </>}
        {section === 'preferences' && <><CurrencyControls language={language} />
          <div><label htmlFor="settings-language" className="block text-sm font-medium mb-2">{zh ? '介面語言' : 'Language'}</label><select id="settings-language" value={language} onChange={e => onLanguage(e.target.value as 'en' | 'zh')} className="input max-w-xs"><option value="zh">繁體中文</option><option value="en">English</option></select></div>
          <div><label htmlFor="settings-theme" className="block text-sm font-medium mb-2">{zh ? '外觀' : 'Theme'}</label><select id="settings-theme" value={theme} onChange={e => onTheme(e.target.value as 'light' | 'dark')} className="input max-w-xs"><option value="light">{zh ? '淺色' : 'Light'}</option><option value="dark">{zh ? '深色' : 'Dark'}</option></select></div>
          <p role="status" className="text-xs text-text-secondary">{zh ? '變更會立即套用並自動儲存。' : 'Changes apply immediately and save automatically.'}</p>
        </>}
        {section === 'integrations' && <div className="rounded-lg border border-border p-4"><h4 className="font-medium">Gmail</h4><p className="text-sm text-text-secondary my-3">{gmail.status.connected ? gmail.status.email : zh ? '連結信箱，在客戶頁查看往來郵件。' : 'Connect your inbox to view customer emails.'}</p>{gmail.status.available ? <button className="btn btn-secondary" onClick={gmail.status.connected ? gmail.disconnect : gmail.connect}>{gmail.status.connected ? (zh ? '解除連結' : 'Disconnect') : (zh ? '連結 Gmail' : 'Connect Gmail')}</button> : <p className="text-sm text-text-secondary">{zh ? '此環境尚未啟用 Gmail 整合。' : 'Gmail integration is not enabled in this environment.'}</p>}</div>}
        {section === 'data' && <>
          <p className="text-sm text-text-secondary">{userEmail ? (zh ? '客戶資料使用雲端儲存。' : 'Customer data uses cloud storage.') : (zh ? '客戶資料儲存在此瀏覽器，建議定期匯出 JSON 備份。' : 'Data is stored in this browser. Export JSON backups regularly.')}</p>
          <div className="flex flex-wrap gap-2">{dataItems.filter(item => !item.danger).map(item => <button key={item.label} onClick={item.onClick} className="btn btn-secondary">{item.label}</button>)}</div>
          <div className="border border-rose-300 dark:border-rose-900 rounded-lg p-4 mt-6"><h4 className="font-semibold text-rose-600">{zh ? '危險操作' : 'Danger zone'}</h4><p className="text-sm text-text-secondary my-2">{zh ? '重設會取代目前的客戶資料，請先匯出備份。執行前會再次確認。' : 'Reset replaces current customer data. Export a backup first. Confirmation is required.'}</p>{dataItems.filter(item => item.danger).map(item => <button key={item.label} onClick={item.onClick} className="btn btn-danger">{item.label}</button>)}</div>
        </>}
      </section>
    </div>
  </div>;
}
