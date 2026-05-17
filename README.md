# slack-approval-gate

GitHub Action that gates a workflow on Slack approval. Two modes:

- **Threaded**: pass `base-message-ts` and the action posts the approval reply in that message's thread. No main message is posted or updated.
- **Standalone**: omit `base-message-ts` and the action posts `base-message-payload` (or a default GitHub-context block) as the main message, then posts the approval reply in its thread.

The main message is **never** updated after creation. All approval state (in-progress, approved, rejected, canceled, timed-out) is reflected on the approval reply itself.

## Slack app setup

Create a Slack App in your workspace with this manifest:

```json
{
  "display_information": { "name": "ApproveApp" },
  "features": {
    "bot_user": { "display_name": "ApproveApp", "always_online": false }
  },
  "oauth_config": {
    "scopes": {
      "bot": ["app_mentions:read", "channels:join", "chat:write", "users:read"]
    }
  },
  "settings": {
    "interactivity": { "is_enabled": true },
    "org_deploy_enabled": false,
    "socket_mode_enabled": true,
    "token_rotation_enabled": false
  }
}
```

## Required env

| Variable | Description |
|----------|-------------|
| `SLACK_APP_TOKEN` | App-level token from Basic Information (`xapp-…`). |
| `SLACK_BOT_TOKEN` | Bot token from OAuth & Permissions (`xoxb-…`). |
| `SLACK_CHANNEL_ID` | Default channel ID (overridable by `channel-id` input). |

> **Note:** `SLACK_SIGNING_SECRET` is not required when using Socket Mode (the default).

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `channel-id` | no | env `SLACK_CHANNEL_ID` | Slack channel ID. |
| `base-message-ts` | no | — | Enables threaded mode. |
| `base-message-payload` | no | `{}` (uses built-in GH-context block when empty) | Standalone-mode main message JSON. |
| `approvers` | yes | — | Comma-separated Slack user IDs. |
| `minimum-approval-count` | no | `1` | Approvals needed. |
| `success-message-payload` | no | rendered block | Replaces approval reply on full approval. |
| `fail-message-payload` | no | rendered block | Replaces approval reply on reject/cancel/timeout. |
| `timeout-minutes` | no | `30` | Internal timeout. |

## Outputs

| Output | Description |
|--------|-------------|
| `main-message-ts` | Main message ts. In threaded mode, equals the input. |
| `approval-message-ts` | Approval reply ts. |
| `result` | `approved`, `rejected`, `canceled`, or `timed-out`. |
| `approvers-json` | JSON array of user IDs who approved. |

## Usage

### Standalone mode

```yaml
jobs:
  approval:
    runs-on: ubuntu-latest
    steps:
      - name: gate
        uses: alexremn/slack-approval-gate@v1
        env:
          SLACK_APP_TOKEN: ${{ secrets.SLACK_APP_TOKEN }}
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
        with:
          approvers: U12345,U67890
          minimum-approval-count: 2
```

### Threaded mode

```yaml
- name: post context
  id: post
  uses: slackapi/slack-github-action@v1
  with:
    channel-id: ${{ secrets.SLACK_CHANNEL_ID }}
    payload: |
      { "text": "Deploy requested for ${{ github.sha }}" }

- name: gate
  uses: alexremn/slack-approval-gate@v1
  env:
    SLACK_APP_TOKEN: ${{ secrets.SLACK_APP_TOKEN }}
    SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
    SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
  with:
    base-message-ts: ${{ steps.post.outputs.ts }}
    approvers: U12345,U67890
```

## Behavior

- Approve / reject buttons live on the approval reply.
- Non-approver click → ephemeral "not authorized" reply to that user.
- Double-approve click → ephemeral "already approved".
- Reject by any user with button access fails the job.
- SIGTERM/SIGINT/SIGBREAK → reply is updated with the cancel block, job fails.
- Timeout → reply is updated with the timed-out block, job fails.
