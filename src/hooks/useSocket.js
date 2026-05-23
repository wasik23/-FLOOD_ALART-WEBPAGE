import { useEffect, useMemo, useState } from 'react'
import { createSocket } from '../services/socket.js'

const emptyEventHandlers = {}

function useSocket(eventHandlersOrNamespace = emptyEventHandlers, namespace = '/') {
  const [isConnected, setIsConnected] = useState(false)
  const { eventHandlers, socketNamespace } = useMemo(
    () => {
      const isNamespaceOnly = typeof eventHandlersOrNamespace === 'string'

      return {
        eventHandlers: isNamespaceOnly
          ? emptyEventHandlers
          : eventHandlersOrNamespace,
        socketNamespace: isNamespaceOnly ? eventHandlersOrNamespace : namespace,
      }
    },
    [eventHandlersOrNamespace, namespace],
  )

  const socket = useMemo(() => createSocket(socketNamespace), [socketNamespace])

  useEffect(() => {
    function handleConnect() {
      setIsConnected(true)
    }

    function handleDisconnect() {
      setIsConnected(false)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.disconnect()
    }
  }, [socket])

  useEffect(() => {
    const listeners = Object.entries(eventHandlers)

    listeners.forEach(([eventName, handler]) => {
      socket.on(eventName, handler)
    })

    return () => {
      listeners.forEach(([eventName, handler]) => {
        socket.off(eventName, handler)
      })
    }
  }, [eventHandlers, socket])

  return { socket, isConnected }
}

export default useSocket
