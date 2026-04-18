# n8n-nodes-telegram-mtproto

Telegram MTProto client-account integration for `n8n`.

This fork extends the original package so `n8n` workflows can:

- listen for incoming Telegram messages as a real Telegram user account
- optionally download incoming photo media into `n8n` binary data
- send and reply to messages as the same Telegram user account

This is useful when you need a real Telegram client-account automation path instead of the standard Telegram bot path.

[Installation](#installation)
[What This Fork Adds](#what-this-fork-adds)
[Quick Start](#quick-start)
[Credentials](#credentials)
[Build Instructions](#build-instructions)
[Compatibility](#compatibility)

## Installation

Follow the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

If you are using this fork directly from GitHub, you can point your installation process at this repository.

The package name intentionally remains:

```bash
n8n-nodes-telegram-mtproto
```

This keeps existing workflow node types compatible with the original package prefix.

## What This Fork Adds

Compared with the original upstream package, this fork adds:

1. `Telegram MTPROTO API`
   - a send/reply action node for Telegram client-account workflows

2. Trigger-side photo download
   - the trigger can download incoming Telegram photos into `n8n` binary data

3. Better reply targeting support
   - supports preserving and reusing `inputChatRef` for reply flows after downstream transformations

4. Plain-text Telegram sends
   - replies are sent with `parseMode: false` to avoid markup parsing failures on masked values

## Quick Start

1. Get your Telegram API credentials from `https://my.telegram.org/apps`
2. Generate a session string using `bun run test:connection`
3. Create a `Personal Telegram MTPROTO API` credential in `n8n`
4. Add `Telegram MTPROTO API Trigger` to listen for inbound messages
5. Add `Telegram MTPROTO API` to send replies or direct messages

Typical pattern:

- trigger on inbound messages
- inspect message metadata
- optionally download photo binary
- process the message or image
- reply through `Telegram MTPROTO API`

## Nodes In This Fork

### Telegram MTPROTO API Trigger

Listens for inbound Telegram messages on the connected Telegram user account.

Useful outputs include:

- `inputChatRef`
- `messageId`
- `text`
- `hasMedia`
- `hasPhoto`
- `isPrivate`
- `message`

Optional trigger features:

- `Download Incoming Photos`
- configurable binary property name, default `data`

### Telegram MTPROTO API

Sends messages as the same Telegram user account.

Useful for:

- replying to inbound Telegram messages
- sending direct messages by username or phone number
- building MTProto-based client workflows in `n8n`

Important parameters:

- `targetMode=incomingMessagePeer`
- `replyToIncomingMessage`
- `inputPeerRefJson`

## Credentials

You need a Telegram user account and Telegram API credentials.

### Prerequisites

1. A Telegram account
2. Access to `https://my.telegram.org/apps`
3. Bun runtime installed for session string generation

### Setup Steps

1. Visit `https://my.telegram.org/apps`
2. Create an application
3. Save your `api_id` and `api_hash`
4. Run:

```bash
bun run test:connection
```

5. Follow the prompts to generate a Telegram session string
6. In `n8n`, create a `Personal Telegram MTPROTO API` credential using:
   - API ID
   - API Hash
   - phone number
   - session string

## Build Instructions

This project uses Bun as the primary build tool and package manager.

### Development Setup

1. Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Install dependencies:

```bash
bun install
```

3. Build the project:

```bash
bun run build
```

### Available Scripts

- `bun run build` - build the package
- `bun run dev` - watch mode
- `bun run test:connection` - generate session string / test Telegram connectivity
- `bun run lint` - run lint checks
- `bun run format` - format sources

## Compatibility

- Minimum `n8n` version: `1.82.0`
- Tested here with current `n8n 1.x`
- Bun: `>=1.00`
- Node.js can still be used at runtime by `n8n`, while Bun remains the intended build tool

## Fork Notes

This repository is maintained as a practical fork for Telegram client-account automation in `n8n`.

The local source of truth for the current deployment was originally maintained in:

- `vendor/n8n-nodes-telegram-mtproto/`

The next sensible maintenance steps are:

- keep this fork as the canonical source for further MTProto work
- decide later whether to publish it as a distinct public npm package name or keep it as a fork-compatible package identity

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Telegram API Documentation](https://core.telegram.org/api)
- [GramJS](https://github.com/gram-js/gramjs)
