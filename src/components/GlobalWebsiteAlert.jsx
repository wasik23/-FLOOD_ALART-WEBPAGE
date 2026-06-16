import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import useSocket from '../hooks/useSocket.js'
import {
  getCurrentAlertsSnapshot,
  loadCurrentAlerts,
  subscribeCurrentAlerts,
} from '../services/currentAlerts.js'

const importantSeverities = new Set(['High', 'Critical'])
const alarmDurations = {
  High: 90_000,
  Critical: 180_000,
}

function normalizeAlert(alert) {
  const severity = alert.severity || alert.riskLevel || 'Medium'

  return {
    id: String(alert.id || `${severity}-${alert.district || Date.now()}`),
    district: alert.district?.name || alert.district || alert.districtName || 'Bangladesh',
    message: alert.message || `Water level is ${alert.riverWaterLevel || 'rising'}.`,
    severity,
    timestamp: alert.issuedAt || alert.timestamp || new Date().toISOString(),
    title: alert.title || `${severity} water level alert`,
  }
}

function createAlarmController(severity) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null

  const context = new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  let highTone = true

  oscillator.type = severity === 'Critical' ? 'sawtooth' : 'sine'
  oscillator.frequency.setValueAtTime(880, context.currentTime)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.08)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()

  const intervalId = window.setInterval(() => {
    const frequency = highTone ? 620 : 980
    oscillator.frequency.setTargetAtTime(frequency, context.currentTime, 0.05)
    highTone = !highTone
  }, 520)

  return {
    stop() {
      window.clearInterval(intervalId)
      gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.05)
      window.setTimeout(() => {
        oscillator.stop()
        context.close()
      }, 180)
    },
  }
}

function severityClasses(severity) {
  if (severity === 'Critical') {
    return 'border-red-300/70 bg-red-950/95 text-red-50 shadow-red-950/35'
  }

  if (severity === 'High') {
    return 'border-orange-300/70 bg-orange-950/95 text-orange-50 shadow-orange-950/35'
  }

  return 'border-yellow-300/70 bg-yellow-950/95 text-yellow-50 shadow-yellow-950/35'
}

function GlobalWebsiteAlert() {
  const currentAlertSnapshot = useSyncExternalStore(
    subscribeCurrentAlerts,
    getCurrentAlertsSnapshot,
  )
  const [alert, setAlert] = useState(null)
  const [alarmActive, setAlarmActive] = useState(false)
  const seenAlertsRef = useRef(new Set())
  const hideTimerRef = useRef(null)
  const alarmTimerRef = useRef(null)
  const alarmControllerRef = useRef(null)
  const alarmArmedRef = useRef(false)
  const activeAlertRef = useRef(null)

  const stopAlarm = useCallback(() => {
    window.clearTimeout(alarmTimerRef.current)
    alarmControllerRef.current?.stop()
    alarmControllerRef.current = null
    setAlarmActive(false)
  }, [])

  const startAlarm = useCallback(
    (severity) => {
      if (!alarmArmedRef.current || alarmControllerRef.current) return

      try {
        alarmControllerRef.current = createAlarmController(severity)
        setAlarmActive(Boolean(alarmControllerRef.current))
      } catch {
        alarmControllerRef.current = null
        setAlarmActive(false)
      }

      window.clearTimeout(alarmTimerRef.current)
      alarmTimerRef.current = window.setTimeout(
        stopAlarm,
        alarmDurations[severity] || alarmDurations.High,
      )
    },
    [stopAlarm],
  )

  const showBrowserNotification = useCallback((nextAlert) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const notification = new Notification(nextAlert.title, {
      body: nextAlert.message,
      icon: '/reliefops-icon.svg',
      tag: nextAlert.id,
    })

    window.setTimeout(() => notification.close(), 30_000)
  }, [])

  const showAlert = useCallback(
    (incomingAlert) => {
      const nextAlert = normalizeAlert(incomingAlert)
      if (!importantSeverities.has(nextAlert.severity)) return
      if (seenAlertsRef.current.has(nextAlert.id)) return

      seenAlertsRef.current.add(nextAlert.id)
      setAlert(nextAlert)
      startAlarm(nextAlert.severity)
      showBrowserNotification(nextAlert)

      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(
        () => setAlert(null),
        nextAlert.severity === 'Critical' ? 600_000 : 180_000,
      )
    },
    [showBrowserNotification, startAlarm],
  )

  const socketHandlers = useMemo(
    () => ({
      new_alert: showAlert,
      water_level_update: (update) => {
        if (!importantSeverities.has(update.riskLevel)) return
        showAlert({
          ...update,
          id: update.id || `water-${update.district || update.districtName}-${update.riskLevel}`,
          message: `Water level is ${update.riverWaterLevel || 'rising'} in ${
            update.district || update.districtName || 'your area'
          }. Move to a safe place.`,
          severity: update.riskLevel,
          title: `${update.riskLevel} water level warning`,
        })
      },
    }),
    [showAlert],
  )

  useSocket(socketHandlers)

  useEffect(() => {
    activeAlertRef.current = alert
  }, [alert])

  useEffect(() => {
    loadCurrentAlerts()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const demoEmergency = params.get('emergency')
    if (!demoEmergency) return

    const severity = demoEmergency.toLowerCase() === 'high' ? 'High' : 'Critical'
    const district = params.get('district') || 'Kurigram'
    const level = params.get('level') || (severity === 'Critical' ? '8.9 m' : '6.2 m')

    window.setTimeout(() => {
      showAlert({
        id: `local-emergency-${severity}-${district}-${Date.now()}`,
        district,
        message: `Frontend emergency test: water level is ${level}. Sudden flood situation. Move to high ground immediately.`,
        severity,
        title: `${severity} sudden flood warning`,
      })
    }, 600)
  }, [showAlert])

  useEffect(() => {
    currentAlertSnapshot.alerts.forEach(showAlert)
  }, [currentAlertSnapshot.alerts, showAlert])

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current)
      stopAlarm()
    },
    [stopAlarm],
  )

  const armAlarm = useCallback(async () => {
    if (alarmArmedRef.current) return

    alarmArmedRef.current = true

    try {
      const controller = createAlarmController('High')
      window.setTimeout(() => controller?.stop(), 260)
    } catch {
      // The visual alert and browser notification can still work without audio.
    }

    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    if (activeAlertRef.current) {
      startAlarm(activeAlertRef.current.severity)
    }
  }, [startAlarm])

  useEffect(() => {
    const options = { once: true, passive: true }
    window.addEventListener('pointerdown', armAlarm, options)
    window.addEventListener('keydown', armAlarm, { once: true })

    return () => {
      window.removeEventListener('pointerdown', armAlarm, options)
      window.removeEventListener('keydown', armAlarm)
    }
  }, [armAlarm])

  const dismissAlert = () => {
    setAlert(null)
    stopAlarm()
  }

  if (!alert) {
    return null
  }

  return (
    <aside
      aria-live="assertive"
      className={[
        'fixed inset-x-3 top-3 z-[1000] mx-auto max-w-3xl rounded-lg border p-4 shadow-2xl backdrop-blur sm:top-5',
        severityClasses(alert.severity),
      ].join(' ')}
      role="alert"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide">
            {alert.severity} Alert - {alert.district}
          </p>
          <h2 className="mt-1 text-lg font-black leading-tight">{alert.title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 opacity-95">
            {alert.message}
          </p>
          <p className="mt-3 text-xs font-black uppercase tracking-wide">
            {alarmActive ? 'Long alarm sounding' : 'Website alert active'}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            aria-label="Close website alert"
            className="grid h-9 w-9 place-items-center rounded-md border border-white/25 text-xl font-black leading-none text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
            onClick={dismissAlert}
            type="button"
          >
            x
          </button>
        </div>
      </div>
    </aside>
  )
}

export default GlobalWebsiteAlert
