# Discord Welcome Action [![Node.js CI](https://github.com/lolPants/discord-welcome-action/actions/workflows/ci.yml/badge.svg)](https://github.com/lolPants/discord-welcome-action/actions/workflows/ci.yml) [![Action Test](https://github.com/lolPants/discord-welcome-action/actions/workflows/test.yml/badge.svg)](https://github.com/lolPants/discord-welcome-action/actions/workflows/test.yml)
> Action to keep channel content in-sync with Markdown based templates

## Prerequisites
* A Discord Bot with `Manage Webhooks` and `Manage Messages` permissions in the target server(s)
* One or more Markdown template documents using the extended syntax (see below)

## Usage
### Action Inputs
| Name | Type | Required | Default | Description |
| - | - | - | - | - |
| `discord-token` | String | `true` | n/a | Discord Bot Login Token |
| `content` | String | `true` | `./content` | Path to a directory containing template documents |

### Markdown Syntax
Template documents can make use of any Markdown syntax that Discord directly supports, as templates are sent almost verbatim to the target channels. You can also use `---` (horizontal rules) to break up the document into multiple messages, otherwise messages will be split automatically.

Images will also be embedded correctly, however **these must use absolute URLs, relative image URLs are currently unsupported.** Images must also be in a message of their own to be parsed correctly.

Finally, bulleted lists will be transformed to use the Unicode bullet character.

_You can see an example of the syntax [here](https://raw.githubusercontent.com/lolPants/discord-welcome-action/master/test-content/welcome.md)._

#### Frontmatter
All Markdown templates must have YAML frontmatter to denote the channel target and allow you to pass additional per-template configuration.

| Name | Type | Required | Default | Description |
| - | - | - | - | - |
| `channel` | String | `true` | n/a | Snowflake ID of the target channel |
| `senderName` | String | `false` | Server Name | Name of the user sending the message(s) |
| `senderImage` | String | `false` | Server Icon | Icon for the user sending the message(s) |

### Example Workflow
```yml
name: Update Welcome
on: [push]

jobs:
  execute:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Update Welcome
        uses: lolPants/discord-welcome-action@v0
        with:
          content: ./content
          discord-token: ${{ secrets.DISCORD_TOKEN }}
```
