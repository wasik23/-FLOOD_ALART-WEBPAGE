import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { mockDashboard } from '../data/mockDashboard.js'
import { requestJson } from '../services/api.js'

export default function useDashboard() {
  const { user, token } = useAuth()
  const [params] = useSearchParams()
  const query = ['districtId','status','page','q'].map((key) => params.has(key) ? `${key}=${encodeURIComponent(params.get(key))}` : '').filter(Boolean).join('&')
  const [data,setData] = useState(() => mockDashboard(user.role))
  const [mode,setMode] = useState('demo')
  const [error,setError] = useState('')
  const controllerRef = useRef(null)
  const timerRef = useRef(null)
  const refresh = useCallback(async () => {
    window.clearTimeout(timerRef.current)
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const payload = await requestJson(`/api/dashboard/overview?${query}`, {token,signal:controller.signal,cache:'no-store'})
      if (!payload.metrics || !['donationsTaka','familiesHelped','pending','assigned','activeVolunteers','availableVolunteers','reliefCampsOpen','nearingCapacity'].every((key)=>typeof payload.metrics[key]==='number'&&Number.isFinite(payload.metrics[key])&&payload.metrics[key]>=0) || !['requests','ngos','profiles','donationDays','districts','availableVolunteers','recentDonations','alerts','activity'].every((key)=>Array.isArray(payload[key]))) throw new Error('Invalid dashboard response.')
      if(controller.signal.aborted)return
      setData(payload);setMode('ready');setError('')
      timerRef.current=window.setTimeout(refresh,30000)
    } catch(err) {
      if(controller.signal.aborted)return
      if(err.status && err.status<500 && err.status!==404) {setMode('error');setError(err.message)}
      else {setData(mockDashboard(user.role));setMode('demo');setError('');timerRef.current=window.setTimeout(refresh,15000)}
    }
  },[query,token,user.role])
  useEffect(()=>{
    const debounce=window.setTimeout(refresh,200)
    window.addEventListener('focus',refresh)
    return()=>{window.clearTimeout(debounce);window.clearTimeout(timerRef.current);controllerRef.current?.abort();window.removeEventListener('focus',refresh)}
  },[refresh])
  return {data,mode,error,refresh,token,canWrite:mode==='ready'}
}
