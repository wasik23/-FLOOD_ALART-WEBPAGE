import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth.js'
import DashIcon from './DashIcon.jsx'
import '../../styles/dashboard.css'

function DashboardShell() {
  const { user, logout } = useAuth()
  const { i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [menu, setMenu] = useState(false)
  useEffect(() => { if (!menu) return undefined; const close = (event) => { if (event.key === 'Escape') setMenu(false) }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [menu])
  const signOut = () => { logout(); navigate(user.role === 'admin' ? '/admin' : '/ngo') }
  const admin = user.role === 'admin'
  const home = admin ? '/admin/dashboard' : '/coordinator'
  const view = params.get('view') || 'overview'
  const nav = admin ? [['overview','Overview','overview'],['org','NGO organizations','ngos'],['people','Volunteers','volunteers'],['requests','Help requests','requests'],['wallet','Donation ledger','ledger'],['home','Shelter network','/shelters'],['alert','Flood alerts','alerts']]
    : [['overview','Response overview','overview'],['requests','Request queue','requests'],['people','Volunteers','volunteers'],['home','Shelters','/shelters'],['wallet','Donation ledger','ledger'],['activity','Field updates','reports'],['report','Situation reports','/situation-report']]
  const pathFor = (section) => section.startsWith('/') ? section : `${home}${section === 'overview' ? '' : `?view=${section}`}`
  const active = (section) => section.startsWith('/') ? location.pathname === section : location.pathname === home && view === section
  const navItem = (name, label, section) => <Link title={label} aria-label={label} className={`nav-item ${active(section) ? 'active' : ''}`} to={pathFor(section)} key={section} onClick={() => setMenu(false)}><DashIcon name={name}/><span>{label}</span></Link>
  const initials = user.name.split(/\s+/).map((name) => name[0]).slice(0,2).join('').toUpperCase()
  return <div className="dash-shell">
    {menu && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <aside className={`sidebar ${menu ? 'is-open' : ''}`}><Link to="/" className="brand"><img src="/reliefops-icon.svg" alt=""/><b>ReliefOps</b></Link><div className="brand-caption">RESPONSE NETWORK</div><div className="nav-label">WORKSPACE</div><nav>{nav.map((item) => navItem(...item))}</nav>
      <div className="sidebar-bottom"><div className="nav-label">{admin ? 'PLATFORM' : 'WORKSPACE TOOLS'}</div><nav>{navItem('activity',admin ? 'Activity log' : 'Records',admin ? 'activity' : '/records')}{navItem('settings',admin ? 'Platform settings' : 'Workspace records','/records')}</nav><div className="sidebar-note"><strong>Bangladesh flood response</strong>One workspace. Coordinated action.</div><div className="account"><div className="avatar">{initials}</div><div><b>{user.name}</b><small>{admin ? 'Platform oversight' : 'NGO coordination'}</small><button className="signout-button" onClick={signOut}>Sign out</button></div></div></div>
    </aside>
    <div className="shell"><header className="topbar"><button className="menu-toggle" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}><DashIcon name="overview"/></button><div className="crumb">Workspace /<strong>{admin ? 'Admin' : 'NGO coordination'}</strong></div><div className="top-right"><label className="search"><DashIcon name="search"/><input aria-label="Search dashboard" maxLength={80} placeholder="Search requests, teams, districts..." value={params.get('q') || ''} onChange={(event) => { const next = new URLSearchParams(params); next.set('q',event.target.value); next.delete('page'); if (location.pathname !== home) navigate(`${home}?${next}`); else setParams(next,{replace:true}) }}/></label><span className="preview live">{admin ? 'ADMIN' : 'NGO'} WORKSPACE</span><button className="language-button" onClick={() => i18n.changeLanguage(i18n.language === 'bn-BD' ? 'en' : 'bn-BD')}>{i18n.language === 'bn-BD' ? 'EN' : 'বাংলা'}</button><button className="language-button" onClick={signOut}>Sign out</button><span className="separator"/><Link className="notification" to={`${home}?view=alerts`} aria-label="View active alerts"><DashIcon name="bell"/></Link><div className="avatar role-avatar">{initials}</div></div></header><main className="main"><Outlet/></main></div>
  </div>
}
export default DashboardShell
