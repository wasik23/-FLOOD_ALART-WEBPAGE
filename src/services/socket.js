import { io } from 'socket.io-client'

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export function createSocket(namespace = '/') {
  const normalizedNamespace = namespace === '/' ? '' : namespace

  return io(`${socketUrl}${normalizedNamespace}`, {
    autoConnect: false,
    transports: ['websocket'],
  })
}
