import { IDataObject } from 'n8n-workflow'
import { Api } from 'telegram'

type PeerType = 'user' | 'chat' | 'channel'

export interface SerializedPeerRef extends IDataObject {
  type: PeerType
  id: string
}

export interface SerializedInputPeerRef extends IDataObject {
  type: PeerType
  id: string
  accessHash?: string
}

function stringifyId(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return String(value)
  }

  if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    const stringValue = value.toString()
    if (stringValue && stringValue !== '[object Object]') {
      return stringValue
    }
  }

  throw new Error('Unsupported Telegram peer identifier value')
}

export function serializePeerRef(peerId: unknown): SerializedPeerRef | undefined {
  if (!peerId || typeof peerId !== 'object') {
    return undefined
  }

  const candidate = peerId as Record<string, unknown>

  if (candidate.userId !== undefined) {
    return { type: 'user', id: stringifyId(candidate.userId) }
  }

  if (candidate.chatId !== undefined) {
    return { type: 'chat', id: stringifyId(candidate.chatId) }
  }

  if (candidate.channelId !== undefined) {
    return { type: 'channel', id: stringifyId(candidate.channelId) }
  }

  return undefined
}

export function buildPeerFromRef(peerRef: SerializedPeerRef): Api.TypePeer {
  const peerId = BigInt(peerRef.id) as never

  if (peerRef.type === 'user') {
    return new Api.PeerUser({ userId: peerId })
  }

  if (peerRef.type === 'chat') {
    return new Api.PeerChat({ chatId: peerId })
  }

  return new Api.PeerChannel({ channelId: peerId })
}

export function serializeInputPeerRef(inputPeer: unknown): SerializedInputPeerRef | undefined {
  if (!inputPeer || typeof inputPeer !== 'object') {
    return undefined
  }

  const candidate = inputPeer as Record<string, unknown>
  const className = candidate.className

  if (className === 'InputPeerUser' && candidate.userId !== undefined) {
    return {
      type: 'user',
      id: stringifyId(candidate.userId),
      accessHash: candidate.accessHash !== undefined ? stringifyId(candidate.accessHash) : undefined,
    }
  }

  if (className === 'InputPeerChat' && candidate.chatId !== undefined) {
    return {
      type: 'chat',
      id: stringifyId(candidate.chatId),
    }
  }

  if (className === 'InputPeerChannel' && candidate.channelId !== undefined) {
    return {
      type: 'channel',
      id: stringifyId(candidate.channelId),
      accessHash: candidate.accessHash !== undefined ? stringifyId(candidate.accessHash) : undefined,
    }
  }

  return undefined
}

export function buildInputPeerFromRef(peerRef: SerializedInputPeerRef): Api.TypeInputPeer {
  const peerId = BigInt(peerRef.id) as never

  if (peerRef.type === 'user') {
    if (!peerRef.accessHash) {
      throw new Error('InputPeerUser requires accessHash')
    }

    return new Api.InputPeerUser({
      userId: peerId,
      accessHash: BigInt(peerRef.accessHash) as never,
    })
  }

  if (peerRef.type === 'chat') {
    return new Api.InputPeerChat({ chatId: peerId })
  }

  if (!peerRef.accessHash) {
    throw new Error('InputPeerChannel requires accessHash')
  }

  return new Api.InputPeerChannel({
    channelId: peerId,
    accessHash: BigInt(peerRef.accessHash) as never,
  })
}

export function hasPhotoMedia(message: unknown): boolean {
  if (!message || typeof message !== 'object') {
    return false
  }

  const candidate = message as Record<string, unknown>
  if (candidate.photo) {
    return true
  }

  const media = candidate.media
  if (!media || typeof media !== 'object') {
    return false
  }

  const mediaRecord = media as Record<string, unknown>
  return Boolean(mediaRecord.photo) || mediaRecord.className === 'MessageMediaPhoto'
}
