import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Link, useSearchParams } from 'react-router-dom'
import useDashboard from '../../hooks/useDashboard.js'
import DonationLedger from '../DonationLedger.jsx'
import { requestJson } from '../../services/api.js'
import { age, caseId, exportReport, money, number } from './format.js'
import DashIcon from './DashIcon.jsx'
import { AccountsPanel, AvailableVolunteers, FieldUpdates, RequestQueue, VolunteerRoster } from './DashboardPanels.jsx'
import { CreateRecord, RequestEditor } from './DashboardForms.jsx'
import { Button, DashboardError, DonationTrend, FloodOverview, Metric, PageHeading, Panel, RecentDonations, Tag } from './DashWidgets.jsx'

function Outcome({requests,token,canWrite,onDone}) {
 const options=requests.filter((request)=>request.status==='Assigned');const [id,setId]=useState('');const [families,setFamilies]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const selected=options.find((request)=>request.id===id)||options[0]
 const complete=async(event)=>{event.preventDefault();if(!selected||!canWrite)return;setBusy(true);setError('');try{await requestJson(`/api/help-requests/${selected.id}`,{token,method:'PATCH',body:JSON.stringify({status:'Completed',familiesHelped:Number(families)})});setFamilies('');setId('');onDone('Support outcome recorded. The families-helped total has been updated.')}catch(err){setError(err.message)}finally{setBusy(false)}}
 return <Panel title="Record support outcome" subtitle="Close a case with a confirmed family count" className="outcome-box"><div className="outcome-description">Mark a request complete once support is delivered.</div><form onSubmit={complete}><div className="outcome-fields"><div className="form-row"><label htmlFor="outcome-request">Request</label><select id="outcome-request" value={selected?.id||''} disabled={!canWrite||busy} onChange={(event)=>{setId(event.target.value);setFamilies('')}}>{options.length===0&&<option value="">No assigned cases in this queue</option>}{options.map((request)=><option key={request.id} value={request.id}>{caseId(request.id)} · {request.needType}</option>)}</select></div><div className="form-row"><label htmlFor="outcome-families">Families helped</label><input id="outcome-families" type="number" min={1} max={10000} step={1} required value={families} disabled={!canWrite||busy} onChange={(event)=>setFamilies(event.target.value)}/></div></div>{error&&<p className="modal-status" style={{padding:'0 20px'}} role="alert">{error}</p>}<Button primary icon="check" type="submit" disabled={!canWrite||busy||!selected}>{busy?'Saving…':'Complete & save'}</Button></form></Panel>
}
Outcome.propTypes={requests:PropTypes.array.isRequired,token:PropTypes.string.isRequired,canWrite:PropTypes.bool.isRequired,onDone:PropTypes.func.isRequired}

function FieldTasks({token,canWrite}) {
 const [tasks,setTasks]=useState([]);const [error,setError]=useState('')
 useEffect(()=>{if(!canWrite)return;const controller=new AbortController();requestJson('/api/tasks',{token,signal:controller.signal}).then((payload)=>{if(!controller.signal.aborted)setTasks(payload.tasks||[])}).catch((err)=>{if(!controller.signal.aborted)setError(err.message)});return()=>controller.abort()},[token,canWrite])
 return <Panel title="Field task board" subtitle="Persisted tasks created by coordinators"><div className="table-header"/>{error&&<p className="message error">{error}</p>}<div className="table-wrap"><table className="priority-table"><thead><tr><th>Task</th><th>District</th><th>Priority</th><th>Status</th><th>Assigned volunteer</th></tr></thead><tbody>{tasks.slice(0,50).map((task)=><tr key={task.id}><td>{task.title}</td><td>{task.district?.name||'Unassigned'}</td><td>{task.priority}</td><td>{task.status}</td><td>{task.assignedTo?.name||'Unassigned'}</td></tr>)}</tbody></table>{tasks.length===0&&<div className="muted-empty">{canWrite?'No field tasks yet.':'Connect the backend to view field tasks.'}</div>}</div></Panel>
}
FieldTasks.propTypes={token:PropTypes.string.isRequired,canWrite:PropTypes.bool.isRequired}

export default function DashboardView({admin=false}) {
 const dashboard=useDashboard();const {data,mode,error,refresh,token,canWrite}=dashboard;const [params,setParams]=useSearchParams();const view=params.get('view')||'overview';const [modal,setModal]=useState(null);const [editing,setEditing]=useState(null);const [message,setMessage]=useState('');const metrics=data.metrics
 const onDone=(text)=>{setMessage(text);setModal(null);setEditing(null);refresh()}
 const created=(text)=>{if(modal==='task'){const next=new URLSearchParams(params);next.set('view','reports');setParams(next)}onDone(text)}
 const selectDistrict=(value)=>{const next=new URLSearchParams(params);if(value)next.set('districtId',value);else next.delete('districtId');next.delete('page');setParams(next)}
 const districtSelect=<select className="district-select" aria-label="Response district" value={params.get('districtId')||''} onChange={(event)=>selectDistrict(event.target.value)}><option value="">All districts</option>{data.districts.map((district)=><option value={district.id} key={district.id}>{district.name}</option>)}</select>
 if(mode==='error')return <DashboardError error={error}/>
 const headerTitle=view==='overview'?admin?'Operational overview':'Response overview':({ngos:'NGO organizations',requests:'Request queue',volunteers:'Volunteer roster',ledger:'Donation ledger',alerts:'Flood alerts',activity:'Platform activity',reports:'Field updates'})[view]||'Operational overview'
 const pendingNgo=data.ngos.filter((account)=>account.approvalStatus==='Pending'&&account.isActive)
 const alertCount=data.districts.filter((district)=>['High','Critical'].includes(district.riskLevel)).length
 const accounts=(full)=><AccountsPanel accounts={data.ngos} districts={data.districts} token={token} canWrite={canWrite} onChange={refresh} onInvite={()=>setModal('ngo')} full={full}/>
 const queue=(full)=><RequestQueue data={data} canWrite={canWrite} onOpen={setEditing} full={full}/>
 return <>
  <PageHeading title={headerTitle} subtitle={admin?'A single view of flood response across Bangladesh.':'Prioritize requests, assign volunteers and track field support.'} mode={mode} refresh={refresh} updatedAt={mode==='ready'?data.updatedAt:undefined}>{!admin&&districtSelect}{admin&&<Button icon="download" disabled={!canWrite} onClick={()=>exportReport(data)}>Export report</Button>}<Button primary disabled={!canWrite} onClick={()=>setModal(view==='ngos'?'ngo':admin?'alert':'task')}>{view==='ngos'?'Add NGO':admin?'Issue alert':'New task'}</Button></PageHeading>
  {message&&<div className="message" role="status">{message}</div>}
  {view==='overview'&&<>
    <div className="alert-strip"><div><DashIcon name="alert"/><span><b>{admin?`${alertCount} districts need attention.`:`${metrics.pending} requests need assignment.`}</b> {admin?'Review current assessments and active warnings.':'Prioritize rescue and medical support in your area.'}</span></div><Link className="text-link" to={admin?'?view=alerts':'?view=requests&status=Pending'}>{admin?'Review alerts':'View request queue'}<DashIcon name="arrow"/></Link></div>
    <div className="metrics">{admin?<><Metric label="Donations received" value={money(metrics.donationsTaka)} caption={`${number(data.donationDays.reduce((sum,item)=>sum+item.count,0))} confirmed receipts this week`} icon="wallet"/><Metric label="Families helped" value={number(metrics.familiesHelped)} caption="Recorded support outcomes" icon="people"/><Metric label="Active volunteers" value={number(metrics.activeVolunteers)} caption={`${number(metrics.availableVolunteers)} available for assignment`} icon="people"/><Metric label="Open relief camps" value={number(metrics.reliefCampsOpen)} caption={`${metrics.nearingCapacity} nearing capacity`} icon="home"/></>:<><Metric label="Pending requests" value={number(metrics.pending)} caption="Awaiting triage and assignment" icon="requests"/><Metric label="Assigned requests" value={number(metrics.assigned)} caption="Volunteers responding in the field" icon="activity"/><Metric label="Available volunteers" value={number(metrics.availableVolunteers)} caption="Active, verified and ready" icon="people"/><Metric label="Families supported" value={number(metrics.familiesHelped)} caption="Completed cases in the selected area" icon="home"/></>}</div>
    {admin?<><div className="grid admin-upper"><DonationTrend days={data.donationDays}/><FloodOverview districts={data.districts}/></div><div className="grid admin-lower">{accounts(false)}<RecentDonations donations={data.recentDonations}/></div><div className="mode-bar">{pendingNgo.length} NGO accounts await review. <Link className="text-link" to="?view=activity">View platform activity<DashIcon name="arrow"/></Link></div></>:<div className="grid ngo-grid"><div className="ngo-left">{queue(false)}<FieldUpdates profiles={data.profiles}/></div><div className="ngo-right"><AvailableVolunteers profiles={data.availableVolunteers} total={metrics.availableVolunteers}/><Outcome requests={data.requests} token={token} canWrite={canWrite} onDone={onDone}/></div></div>}
  </>}
  {view==='ngos'&&admin&&accounts(true)}
  {view==='requests'&&<>{admin&&<div className="workspace-controls section-gap">{districtSelect}</div>}{queue(true)}</>}
  {view==='volunteers'&&<VolunteerRoster profiles={data.profiles} token={token} canWrite={canWrite} onChange={refresh}/>}
  {view==='ledger'&&(canWrite?<DonationLedger/>:<Panel title="Donation ledger" subtitle="Demo preview is read-only"><RecentDonations donations={data.recentDonations}/></Panel>)}
  {view==='reports'&&<div className="ngo-left section-gap"><FieldUpdates profiles={data.profiles}/><FieldTasks token={token} canWrite={canWrite}/></div>}
  {view==='activity'&&admin&&<Panel title="Platform activity" subtitle="Account and volunteer changes recorded by operators"><div className="notice-list">{data.activity.map((item)=><article className="notice" key={item.id}><strong>{item.action}</strong><p>{item.detail}</p><span className="cell-sub">{item.actor?.name||'Operator'} · {age(item.createdAt)}</span></article>)}{data.activity.length===0&&<div className="muted-empty">{canWrite?'No audit entries yet.':'Audit history is available when connected to the backend.'}</div>}</div></Panel>}
  {view==='alerts'&&<Panel title="Active flood alerts" subtitle="Issued warnings and district response instructions" action={<Button small primary disabled={!canWrite} onClick={()=>setModal('alert')}>Issue alert</Button>}><div className="notice-list">{data.alerts.map((alert)=><article className="notice" key={alert.id}><Tag color={alert.severity==='Critical'?'red':alert.severity==='High'?'amber':'blue'}>{alert.severity}</Tag><strong style={{marginLeft:10}}>{alert.title}</strong><p>{alert.message}</p><span className="cell-sub">{alert.district?.name||'Bangladesh'} · {age(alert.issuedAt)}</span></article>)}{data.alerts.length===0&&<div className="muted-empty">No active warnings.</div>}</div></Panel>}
  <footer className="footer" style={{marginTop:22}}><span><DashIcon name="check"/>{mode==='ready'?'Shared operational records':'Offline preview · mock data'}</span><span>ReliefOps / Bangladesh</span></footer>
  {modal&&canWrite&&<CreateRecord kind={modal} districts={data.districts} token={token} onClose={()=>setModal(null)} onDone={created}/>}
  {editing&&<RequestEditor request={editing} volunteers={data.availableVolunteers} token={token} canWrite={canWrite} onClose={()=>setEditing(null)} onDone={onDone}/>}
 </>
}
DashboardView.propTypes={admin:PropTypes.bool}
