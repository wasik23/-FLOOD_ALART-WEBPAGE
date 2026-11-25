import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import useDashboard from '../hooks/useDashboard.js'
import DonationLedger from '../components/DonationLedger.jsx'
import HelpRequestRecords from '../components/HelpRequestRecords.jsx'
import DonationAccounts from '../components/dashboard/DonationAccounts.jsx'
import { DashboardError, PageHeading, RecentDonations } from '../components/dashboard/DashWidgets.jsx'

export default function RecordsPage() {
 const {user}=useAuth();const {data,mode,error,refresh,token,canWrite}=useDashboard()
 if(mode==='error')return <DashboardError error={error}/>
 return <><PageHeading title="Relief records and donations" subtitle="Record confirmed receipts, track families supported, and manage donation destinations." mode={mode} refresh={refresh} updatedAt={mode==='ready'?data.updatedAt:undefined}/><div className="mode-bar">Volunteer approvals and suspension are managed in the <Link className="text-link" to={`${user.role==='admin'?'/admin/dashboard':'/coordinator'}?view=volunteers`}>volunteer roster</Link>.</div>{canWrite?<><HelpRequestRecords/><DonationLedger/><DonationAccounts token={token}/></>:<RecentDonations donations={data.recentDonations}/>}</>
}
