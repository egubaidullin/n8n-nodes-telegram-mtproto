# Changelog

## 0.2.0

- add `Telegram MTPROTO API` action node for sending and replying as the Telegram client account
- add optional inbound photo download support to `Telegram MTPROTO API Trigger`
- add helper logic for preserving and reusing Telegram input peer references across downstream nodes
- send Telegram replies with `parseMode: false` to avoid formatting-related failures on masked card numbers and similar text
- update package metadata and README for the forked client-account automation scope
