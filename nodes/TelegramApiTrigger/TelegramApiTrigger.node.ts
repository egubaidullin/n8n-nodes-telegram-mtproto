import {
  ApplicationError,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
} from 'n8n-workflow'
import { TelegramConnectionManager, TelegramCredentials } from './TelegramConnectionManager'
import { NewMessage, NewMessageEvent } from 'telegram/events'
import { hasPhotoMedia, serializeInputPeerRef } from '../TelegramApi/peerHelpers'

// https://docs.n8n.io/integrations/creating-nodes/build/
export class TelegramApiTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Telegram MTPROTO API Trigger',
    // eslint-disable-next-line n8n-nodes-base/node-class-description-name-miscased
    name: 'telegramApiTrigger',
    icon: { light: 'file:TelegramApiTrigger.svg', dark: 'file:TelegramApiTrigger.svg' },
    group: ['trigger'],
    version: 1,
    description: 'Listens for new messages from Telegram using MTPROTO API',
    defaults: {
      name: 'Telegram MTPROTO API Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'telegramMTPROTOApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Download Incoming Photos',
        name: 'downloadPhoto',
        type: 'boolean',
        default: false,
        description: 'Whether to download photo media from incoming messages into n8n binary data',
      },
      {
        displayName: 'Binary Property Name',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        displayOptions: {
          show: {
            downloadPhoto: [true],
          },
        },
        description: 'The name of the binary field that will contain the downloaded photo',
      },
    ],
  }

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const credentials = (await this.getCredentials('telegramMTPROTOApi')) as TelegramCredentials
    const downloadPhoto = this.getNodeParameter('downloadPhoto', false) as boolean
    const binaryPropertyName = this.getNodeParameter('binaryPropertyName', 'data') as string
    // const selectedEvents = this.getNodeParameter('events', []) as string[]

    const connectionManager = TelegramConnectionManager.getInstance()
    let client

    try {
      client = await connectionManager.getClient(credentials)
    } catch (error) {
      throw new ApplicationError(
        `Failed to connect to Telegram: ${error}. Please ensure your credentials are correct and you have authorized this application.`
      )
    }

    const emit = (item: INodeExecutionData) => {
      this.emit([[item]])
    }

    // Event handler for new messages
    const handleNewMessage = async (event: NewMessageEvent) => {
      try {
        let inputChat: unknown = event.message.inputChat
        if (!inputChat && typeof (event.message as { getInputChat?: () => Promise<unknown> }).getInputChat === 'function') {
          try {
            inputChat = await (event.message as { getInputChat: () => Promise<unknown> }).getInputChat()
          } catch {
            inputChat = undefined
          }
        }

        const inputChatRef = serializeInputPeerRef(inputChat)
        const messageData = {
          peer: event.chat ?? null,
          peerRef: undefined,
          inputChatRef,
          message: event.message,
          messageId: event.message.id,
          text: event.message.message ?? '',
          hasMedia: Boolean(event.message.media),
          hasPhoto: hasPhotoMedia(event.message),
          isGroup: event.isGroup ?? false,
          isChannel: event.isChannel,
          isPrivate: event.isPrivate ?? false,
          chat: event.chat,
        }

        if (downloadPhoto && messageData.hasPhoto) {
          const downloaded = await client.downloadMedia(event.message)
          if (downloaded) {
            const buffer = Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded)
            const binaryData = await this.helpers.prepareBinaryData(
              buffer,
              `telegram-photo-${event.message.id}.jpg`,
              'image/jpeg'
            )

            emit({
              json: messageData,
              binary: {
                [binaryPropertyName]: binaryData,
              },
            })
            return
          }
        }

        emit({ json: messageData })
      } catch (error) {
        console.error('Error processing new message:', error)
      }
    }

    let eventHandlerAdded = false
    let newMessageEvent: NewMessage | null = null

    // Start listening for updates
    if (this.getMode() !== 'manual') {
      try {
        newMessageEvent = new NewMessage({})
        client.addEventHandler(handleNewMessage, newMessageEvent)
        eventHandlerAdded = true
      } catch (error) {
        console.error('Error adding event handler:', error)
      }
    }

    // Cleanup function
    const closeFunction = async () => {
      try {
        if (eventHandlerAdded && newMessageEvent) {
          client.removeEventHandler(handleNewMessage, newMessageEvent)
        }
      } catch (error) {
        console.error('Error removing event handler:', error)
      }
    }

    // Manual trigger function (for testing)
    const manualTriggerFunction = async () => {
      return new Promise<void>((resolve, reject) => {
        const timeoutHandler = setTimeout(() => {
          try {
            if (manualEvent) {
              client.removeEventHandler(manualTestHandler, manualEvent)
            }
          } catch (error) {
            console.error('Error removing manual handler:', error)
          }
          reject(new Error('Timeout: No message received within 30 seconds'))
        }, 30000)

        const manualTestHandler = async (event: NewMessageEvent) => {
          try {
            handleNewMessage(event)
            clearTimeout(timeoutHandler)
            try {
              if (manualEvent) {
                client.removeEventHandler(manualTestHandler, manualEvent)
              }
            } catch (error) {
              console.error('Error removing manual handler:', error)
            }
            resolve()
          } catch (error) {
            clearTimeout(timeoutHandler)
            reject(error)
          }
        }

        const manualEvent = new NewMessage({})
        client.addEventHandler(manualTestHandler, manualEvent)
      })
    }

    return {
      closeFunction,
      manualTriggerFunction,
    }
  }
}
