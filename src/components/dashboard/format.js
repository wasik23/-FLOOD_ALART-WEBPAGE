export const money = (value) => `৳ ${Number(value)>=100000 ? `${(Number(value)/100000).toFixed(1)}L` : new Intl.NumberFormat('en-BD',{maximumFractionDigits:2}).format(Number(value)||0)}`
export const number = (value) => new Intl.NumberFormat('en-BD').format(Number(value)||0)
export const day = (value) => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Dhaka'}).format(new Date(value))
export const age = (value) => { if(!value||Number.isNaN(new Date(value).getTime()))return 'Time not provided';const minutes=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000)); return minutes<1?'Just now':minutes<60?`${minutes} min ago`:minutes<1440?`${Math.floor(minutes/60)} hr ago`:`${Math.floor(minutes/1440)} days ago` }
export const priority = (request) => { const score=Number(request.priorityScore ?? (Math.min(Number(request.peopleCount)||1,50)+({Rescue:40,Medicine:30,Shelter:24,'Clean water':20,Food:18}[request.needType]||10)+(request.status==='Pending'?15:0))); return score>=75?'Critical':score>=55?'High':score>=35?'Medium':'Low' }
export const caseId = (id) => id.startsWith('demo-request-')?`RQ-${id.slice(-4)}`:`RQ-${id.slice(0,8).toUpperCase()}`
export const initials = (name='') => name.split(/\s+/).filter(Boolean).map((part)=>part[0]).slice(0,2).join('').toUpperCase()
export function exportReport(data) {
  const escape=(value)=>{const text=String(value??'');return `"${(/^[=+\-@]/.test(text)?"'":"")+text.replaceAll('"','""')}"`}
  const rows=[['Request','Name','District','Upazila','Need','People','Status','Families helped'],...data.requests.map((request)=>[request.id,request.name,request.district,request.upazila,request.needType,request.peopleCount,request.status,request.familiesHelped])]
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map((row)=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download='reliefops-request-report.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
