import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { Alert, AuditEntry, District, DonationReceipt, HelpRequest, Shelter, User, VolunteerProfile, sequelize } from '../models/index.js'
import { signToken } from '../middleware/auth.js'
import { errorHandler } from '../middleware/errorHandler.js'
import dashboardRouter from '../routes/dashboard.js'
import authRouter from '../routes/auth.js'
import volunteersRouter from '../routes/volunteers.js'
import { migrateDashboard } from '../migrations/dashboard.js'

test('dashboard records and approval boundaries', async (t) => {
 const users=['admin','coordinator','volunteer'].map((role,index)=>User.build({id:index+1,name:`Test ${role}`,role,email:`${role}@example.test`,passwordHash:'not-a-live-credential'}))
 const events=[];const transaction={LOCK:{UPDATE:'UPDATE'}}
 const prepare=(user)=>{user.update=async(values,options)=>{assert.equal(options.transaction,transaction);user.set(values);return user};user.verifyPassword=async()=>true;return user};users.forEach(prepare)
 t.mock.method(sequelize,'transaction',async(callback)=>callback(transaction))
 t.mock.method(User,'findByPk',async(id)=>users.find((user)=>user.id===Number(id)))
 t.mock.method(User,'findOne',async(options)=>users.find((user)=>Object.entries(options.where).every(([key,value])=>user[key]===value)))
 t.mock.method(User,'findAll',async()=>users.filter((user)=>user.role==='coordinator').map((user)=>user.toSafeJSON()))
 t.mock.method(User,'create',async(values,options)=>{assert.equal(options.transaction,transaction);const user=prepare(User.build({id:users.length+1,...values}));await User.runHooks('beforeSave',user);users.push(user);return user})
 t.mock.method(AuditEntry,'create',async(values,options)=>{assert.equal(options.transaction,transaction);events.push(values);return values})
 t.mock.method(AuditEntry,'findAll',async()=>events)
 const districts=[{id:1,name:'Sylhet',riskLevel:'High'}]
 t.mock.method(District,'findAll',async()=>districts);t.mock.method(District,'findByPk',async(id)=>districts.find((district)=>district.id===id))
 t.mock.method(DonationReceipt,'findOne',async()=>({total:'125000.25'}))
 t.mock.method(DonationReceipt,'findAll',async(options)=>options.group?[{date:new Date(Date.now()+6*3600000).toISOString().slice(0,10),amount:'125000.25',count:'2'}]:[{id:'receipt',amount:'500',donorName:'Private full name',isAnonymous:true,receivedAt:new Date()}])
 t.mock.method(HelpRequest,'sum',async()=>7)
 t.mock.method(HelpRequest,'count',async(options)=>options.where.status==='Pending'?2:1)
 t.mock.method(HelpRequest,'findAndCountAll',async()=>({count:0,rows:[]}))
 const profile={userId:3,name:'Test volunteer',isActive:true,verified:true,availability:'Available',fieldReports:[],user:users[2]}
 profile.update=async(values,options)=>{assert.equal(options.transaction,transaction);Object.assign(profile,values);return profile}
 t.mock.method(VolunteerProfile,'findAll',async(options)=>{if(options.where){assert.equal(options.where.isActive,true);assert.equal(options.where.verified,true);assert.equal(options.where.availability,'Available');assert.equal(options.include[0].where.isActive,true)}return[profile]})
 t.mock.method(VolunteerProfile,'findOne',async()=>profile)
 t.mock.method(VolunteerProfile,'count',async()=>1)
 t.mock.method(Shelter,'findAll',async()=>[{capacity:100,occupancy:90},{capacity:100,occupancy:30}])
 t.mock.method(Alert,'findAll',async()=>[])
 const app=express();app.use(express.json());app.use('/api/dashboard',dashboardRouter);app.use('/auth',authRouter);app.use('/api/volunteers',volunteersRouter);app.use(errorHandler)
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)))
 const base=`http://127.0.0.1:${server.address().port}`
 const send=async(path,{actor=users[0],method='GET',body}={})=>{const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(actor&&{Authorization:`Bearer ${signToken(actor)}`})},...(body&&{body:JSON.stringify(body)})});return{status:response.status,body:await response.json()}}

 await t.test('overview uses datastore aggregates and protects the operator workspace',async()=>{
  assert.equal((await send('/api/dashboard/overview',{actor:null})).status,401)
  assert.equal((await send('/api/dashboard/overview',{actor:users[2]})).status,403)
  const result=await send('/api/dashboard/overview?districtId=1');assert.equal(result.status,200)
  assert.equal(result.body.metrics.donationsTaka,125000.25);assert.equal(result.body.metrics.familiesHelped,7);assert.equal(result.body.metrics.pending,2);assert.equal(result.body.metrics.assigned,1);assert.equal(result.body.metrics.nearingCapacity,1);assert.equal(result.body.donationDays.length,7);assert.equal(result.body.recentDonations[0].displayName,'Anonymous')
  const ngo=await send('/api/dashboard/overview',{actor:users[1]});assert.deepEqual(ngo.body.ngos,[]);assert.deepEqual(ngo.body.activity,[])
  assert.equal((await send('/api/dashboard/overview?districtId=999')).status,400)
 })
 await t.test('registration details require operator access and disable caching',async(subtest)=>{
  subtest.mock.method(VolunteerProfile,'findOne',async(options)=>{
   assert.ok(!options.include[0].attributes.includes('passwordHash'))
   return options.where.userId===3?{...profile,user:users[2].toSafeJSON()}:null
  })
  assert.equal((await send('/api/dashboard/volunteers/3',{actor:null})).status,401)
  assert.equal((await send('/api/dashboard/volunteers/3',{actor:users[2]})).status,403)
  const response=await fetch(`${base}/api/dashboard/volunteers/3`,{headers:{Authorization:`Bearer ${signToken(users[1])}`}})
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
  const payload=await response.json();assert.equal(payload.profile.userId,3);assert.equal(payload.profile.user.passwordHash,undefined)
  assert.equal((await send('/api/dashboard/volunteers/999')).status,404)
 })
 await t.test('NGO accounts are pending, hashed, and never expose passwords',async()=>{
  const body={name:'Review NGO',email:'newngo@example.test',password:'ReviewOnlyPassword',role:'admin',isActive:false}
  assert.equal((await send('/api/dashboard/ngos',{actor:users[1],method:'POST',body})).status,403)
  const result=await send('/api/dashboard/ngos',{method:'POST',body});assert.equal(result.status,201)
  assert.equal(result.body.user.role,'coordinator');assert.equal(result.body.user.approvalStatus,'Pending');assert.equal(result.body.user.isActive,true);assert.equal(result.body.user.passwordHash,undefined)
  assert.match(users.at(-1).passwordHash,/^\$2/);assert.ok(!JSON.stringify(events).includes(body.password))
 })
 await t.test('approval and suspension apply to login and existing JWTs',async()=>{
  const user=users.at(-1)
  assert.equal((await send('/api/dashboard/overview',{actor:user})).status,403)
  assert.equal((await send('/auth/login',{actor:null,method:'POST',body:{email:user.email,password:'ReviewOnlyPassword'}})).status,403)
  assert.equal((await send(`/api/dashboard/ngos/${user.id}`,{method:'PATCH',body:{approvalStatus:'Approved',role:'admin'}})).status,200)
  assert.equal(user.role,'coordinator');assert.equal((await send('/api/dashboard/overview',{actor:user})).status,200)
  assert.equal((await send(`/api/dashboard/ngos/${user.id}`,{method:'PATCH',body:{isActive:false}})).status,200)
  assert.equal((await send('/api/dashboard/overview',{actor:user})).status,403)
  assert.equal((await send('/auth/login',{actor:null,method:'POST',body:{email:user.email,password:'ReviewOnlyPassword'}})).status,403)
  assert.equal((await send(`/api/dashboard/ngos/${users[0].id}`,{method:'PATCH',body:{isActive:false}})).status,404)
 })
 await t.test('profile owners cannot self-verify or reactivate operator-controlled flags',async(subtest)=>{
  let values
  subtest.mock.method(VolunteerProfile,'findOrCreate',async(options)=>{values=options.defaults;return[values,true]})
  const result=await send('/api/volunteers/me',{actor:users[2],method:'PUT',body:{name:'Test volunteer',email:'spoof@example.test',verified:true,isActive:true,id:999,fieldReports:[]}})
  assert.equal(result.status,201);assert.equal(values.verified,undefined);assert.equal(values.isActive,undefined);assert.equal(values.id,undefined);assert.equal(values.email,users[2].email)
 })
 await t.test('volunteer suspension updates profile and login access together',async()=>{
  assert.equal((await send('/api/dashboard/volunteers/3',{method:'PATCH',body:{isActive:false}})).status,200)
  assert.equal(profile.isActive,false);assert.equal(users[2].isActive,false)
  assert.equal((await send('/api/dashboard/overview',{actor:users[2]})).status,403)
 })
 await t.test('migration preserves existing accounts and adds account state once',async(subtest)=>{
  const query=sequelize.getQueryInterface();const columns={id:{}};const added=[]
  subtest.mock.method(User,'sync',async()=>{});subtest.mock.method(AuditEntry,'sync',async()=>{});subtest.mock.method(query,'describeTable',async()=>columns);subtest.mock.method(query,'addColumn',async(table,name,definition)=>{added.push({table,name,definition});columns[name]=definition})
  await migrateDashboard();await migrateDashboard();assert.equal(added.length,2);assert.equal(added[0].definition.defaultValue,true);assert.equal(added[1].definition.defaultValue,'Approved')
 })
})
