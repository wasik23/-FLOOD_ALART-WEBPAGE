import { districts } from './upazilas.js'

export function mockDashboard(role, selectedId = '') {
  const now = Date.now()
  const allDistricts = districts.map((name,index) => ({ id:index+1, name, riskLevel:name==='Sylhet'||name==='Kurigram'?'Critical':name==='Sunamganj'?'High':'Low', lastAssessedAt:new Date(now).toISOString() }))
  const volunteers = [
    {userId:101,name:'Nusrat J.',location:'Sylhet Sadar',phone:'01700000001',skills:['Medical support'],availability:'Available',verified:true,isActive:true},
    {userId:102,name:'Rahim U.',location:'Kanaighat',phone:'01700000002',skills:['Water & sanitation'],availability:'Available',verified:true,isActive:true},
    {userId:103,name:'Amina K.',location:'Beanibazar',phone:'01700000003',skills:['Rescue support'],availability:'Available',verified:true,isActive:true},
  ].map((profile,index) => ({...profile,user:{id:profile.userId,role:'volunteer',name:profile.name,isActive:true},fieldReports:[{id:`demo-report-${index}`,taskLocation:profile.location,notes:['Medical supplies delivered. The case is ready for outcome review.','Water purification kits delivered to the Kanaighat shelter.','Rescue route confirmed; transport is needed for the next transfer.'][index],status:'Completed',createdAt:new Date(now-(12+index*15)*60000).toISOString()}]}))
  const requests=[['1024','Rescue','Kanaighat',36,'Pending',null],['1023','Medicine','Sylhet Sadar',15,'Pending',null],['1021','Food','Golapganj',12,'Assigned',volunteers[1]],['1019','Shelter','Beanibazar',8,'Pending',null],['1018','Food','Sylhet Sadar',24,'Assigned',volunteers[0]]].map(([id,needType,upazila,peopleCount,status,volunteer])=>({id:`demo-request-${id}`,name:`Household ${id}`,phone:'01700000000',district:'Sylhet',upazila,address:'Demo response area',needType,peopleCount,status,familiesHelped:0,assignedToId:volunteer?.userId||null,assignedTo:volunteer?{id:volunteer.userId,name:volunteer.name}:null,createdAt:new Date(now-30*60000).toISOString(),notes:'Example request for the offline dashboard preview.'}))
  return {
    updatedAt:new Date(now).toISOString(),districts:allDistricts,
    metrics:{donationsTaka:4820000,familiesHelped:role==='admin'?12430:148,pending:18,assigned:18,activeVolunteers:1284,availableVolunteers:role==='admin'?286:28,reliefCampsOpen:76,nearingCapacity:5},
    donationDays:[2.1,2.8,1.9,3.6,3,4.8,4.2].map((amount,index)=>({date:new Date(now-(6-index)*86400000+6*3600000).toISOString().slice(0,10),amount:amount*100000,count:[3,4,3,5,5,7,5][index]})),
    recentDonations:[['Rahim U.','500',2],['Anonymous','2000',5],['Nusrat J.','1000',8]].map(([displayName,amount,minutes],index)=>({id:`demo-donation-${index}`,displayName,amount,receivedAt:new Date(now-minutes*60000).toISOString()})),
    requests,requestCount:36,page:1,pages:1,
    ngos:[['Sylhet Relief Team','Sylhet'],['Kurigram Response','Kurigram'],['Sunamganj Support','Sunamganj']].map(([name,district],index)=>({id:`demo-ngo-${index}`,name,email:`coordinator${index+1}@example.test`,districtId:allDistricts.find((item)=>item.name===district)?.id,isActive:true,approvalStatus:'Pending'})),
    profiles:volunteers,availableVolunteers:volunteers,activity:[],alerts:allDistricts.filter((item)=>['High','Critical'].includes(item.riskLevel)).map((item,index)=>({id:`demo-alert-${index}`,title:`${item.riskLevel} flood warning`,severity:item.riskLevel,message:`Rising river levels in ${item.name}. Coordinate safe evacuation and shelter support.`,district:{name:item.name},districtId:item.id,issuedAt:new Date(now).toISOString()})),
    selectedDistrictId:selectedId,
  }
}
