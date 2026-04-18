import {
  ApplicationError,
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow'
import { TelegramConnectionManager, TelegramCredentials } from '../TelegramApiTrigger/TelegramConnectionManager'
import {
  buildInputPeerFromRef,
  buildPeerFromRef,
  SerializedInputPeerRef,
  SerializedPeerRef,
  serializePeerRef,
} from './peerHelpers'

function extractInputPeerRef(inputJson: IDataObject): SerializedInputPeerRef | undefined {
  const directInputPeerRef = inputJson.inputChatRef
  if (directInputPeerRef && typeof directInputPeerRef === 'object') {
    const peerRef = directInputPeerRef as SerializedInputPeerRef
    if (typeof peerRef.type === 'string' && typeof peerRef.id === 'string') {
      return peerRef
    }
  }

  return undefined
}

function parseInputPeerRefJson(rawValue: string): SerializedInputPeerRef | undefined {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const parsed = JSON.parse(trimmed) as SerializedInputPeerRef
    if (parsed && typeof parsed.type === 'string' && typeof parsed.id === 'string') {
      return parsed
    }
  } catch {
    throw new ApplicationError('Input Peer Ref JSON is not valid JSON')
  }

  throw new ApplicationError('Input Peer Ref JSON must contain at least type and id fields')
}

function extractPeerRef(inputJson: IDataObject): SerializedPeerRef | undefined {
  const directPeerRef = inputJson.peerRef
  if (directPeerRef && typeof directPeerRef === 'object') {
    const peerRef = directPeerRef as SerializedPeerRef
    if (typeof peerRef.type === 'string' && typeof peerRef.id === 'string') {
      return peerRef
    }
  }

  const nestedPeerId = inputJson.message && typeof inputJson.message === 'object'
    ? serializePeerRef((inputJson.message as IDataObject).peerId)
    : undefined

  return nestedPeerId
}

function readNestedNumber(data: IDataObject, path: string[]): number | undefined {
  let current: unknown = data

  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    current = (current as IDataObject)[key]
  }

  if (typeof current === 'number') {
    return current
  }

  if (typeof current === 'string' && current.trim() !== '' && !Number.isNaN(Number(current))) {
    return Number(current)
  }

  return undefined
}

function readProperty(data: unknown, key: string): string | number | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const candidate: unknown = (data as IDataObject)[key]
  if (typeof candidate === 'number' || typeof candidate === 'string') {
    return candidate
  }

  if (typeof candidate === 'bigint') {
    return String(candidate)
  }

  return null
}

export class TelegramApi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Telegram MTPROTO API',
    name: 'telegramApi',
    icon: { light: 'file:TelegramApi.svg', dark: 'file:TelegramApi.svg' },
    group: ['output'],
    version: 1,
    description: 'Send messages as the Telegram user account through MTPROTO',
    defaults: {
      name: 'Telegram MTPROTO API',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'telegramMTPROTOApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        default: 'sendMessage',
        options: [
          {
            name: 'Send Message',
            value: 'sendMessage',
          },
        ],
        noDataExpression: true,
      },
      {
        displayName: 'Target',
        name: 'targetMode',
        type: 'options',
        default: 'incomingMessagePeer',
        options: [
          {
            name: 'Incoming Message Peer',
            value: 'incomingMessagePeer',
            description: 'Reply to the chat represented by the current input item',
          },
          {
            name: 'Username or Phone Number',
            value: 'usernameOrPhone',
            description: 'Send directly to a username or phone number known to the Telegram account',
          },
        ],
      },
      {
        displayName: 'Username or Phone Number',
        name: 'target',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            targetMode: ['usernameOrPhone'],
          },
        },
        description: 'Telegram username (for example @username) or phone number in international format',
      },
      {
        displayName: 'Reply to Incoming Message',
        name: 'replyToIncomingMessage',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            targetMode: ['incomingMessagePeer'],
          },
        },
        description: 'Whether to reply to the current incoming message instead of sending a standalone message',
      },
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        typeOptions: {
          rows: 6,
        },
        default: '',
        required: true,
        description: 'Message text to send',
      },
      {
        displayName: 'Input Peer Ref JSON',
        name: 'inputPeerRefJson',
        type: 'string',
        typeOptions: {
          rows: 3,
        },
        default: '',
        displayOptions: {
          show: {
            targetMode: ['incomingMessagePeer'],
          },
        },
        description: 'Optional JSON representation of an InputPeer target. Use this when the current item no longer contains inputChatRef, for example after an AI node.',
      },
    ],
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = (await this.getCredentials('telegramMTPROTOApi')) as TelegramCredentials
    const connectionManager = TelegramConnectionManager.getInstance()
    const client = await connectionManager.getClient(credentials)
    const items = this.getInputData()
    const returnData: INodeExecutionData[] = []

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const operation = this.getNodeParameter('operation', itemIndex) as string

      if (operation !== 'sendMessage') {
        throw new ApplicationError(`Unsupported Telegram MTPROTO operation: ${operation}`)
      }

      const targetMode = this.getNodeParameter('targetMode', itemIndex) as string
      const text = this.getNodeParameter('text', itemIndex) as string
      const inputJson = items[itemIndex].json as IDataObject
      let target: string | object
      let replyTo: number | undefined
      let peerRef: SerializedPeerRef | undefined

      if (targetMode === 'incomingMessagePeer') {
        const explicitInputPeerRefJson = this.getNodeParameter('inputPeerRefJson', itemIndex, '') as string
        const inputPeerRef = extractInputPeerRef(inputJson) ?? parseInputPeerRefJson(explicitInputPeerRefJson)
        peerRef = extractPeerRef(inputJson)

        if (!inputPeerRef && !peerRef) {
          throw new ApplicationError(
            'Incoming item does not contain a supported Telegram peer reference. Expected json.inputChatRef, json.peerRef, or json.message.peerId.'
          )
        }

        target = inputPeerRef ? buildInputPeerFromRef(inputPeerRef) : buildPeerFromRef(peerRef as SerializedPeerRef)

        const shouldReply = this.getNodeParameter('replyToIncomingMessage', itemIndex) as boolean
        if (shouldReply) {
          const directMessageId = typeof inputJson.messageId === 'number'
            ? inputJson.messageId
            : typeof inputJson.messageId === 'string' && inputJson.messageId.trim() !== '' && !Number.isNaN(Number(inputJson.messageId))
              ? Number(inputJson.messageId)
              : undefined
          const replyToCandidate = directMessageId ?? readNestedNumber(inputJson, ['message', 'id'])
          if (replyToCandidate !== undefined) {
            replyTo = replyToCandidate
          }
        }
      } else {
        target = this.getNodeParameter('target', itemIndex) as string
      }

      const response = await client.sendMessage(target as never, {
        message: text,
        replyTo,
        parseMode: false,
      })

      returnData.push({
        json: {
          ok: true,
          text,
          replyToMessageId: replyTo ?? null,
          peerRef: peerRef ?? null,
          sentMessageId: readProperty(response, 'id'),
          sentAt: readProperty(response, 'date') ?? null,
        },
      })
    }

    return [returnData]
  }
}
