#!/bin/bash
set -euo pipefail

if [[ $# != 2 || ! $1 =~ ^[0-9a-f-]{36}$ || ! $2 =~ ^i-[0-9a-f]+$ ]]; then
  echo "Usage: wait-for-command.sh COMMAND_ID INSTANCE_ID" >&2
  exit 2
fi

error_file=$(mktemp)
trap 'rm -f "$error_file"' EXIT

for ((attempt=0; attempt<280; attempt++)); do
  if status=$(aws ssm get-command-invocation \
    --command-id "$1" --instance-id "$2" \
    --query Status --output text --no-cli-pager 2>"$error_file"); then
    case "$status" in
      Success)
        echo "Ecommerce deployment succeeded through Systems Manager."
        exit 0
        ;;
      Pending|InProgress|Delayed)
        ;;
      *)
        echo "Systems Manager deployment ended with status: $status" >&2
        aws ssm get-command-invocation \
          --command-id "$1" --instance-id "$2" \
          --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' \
          --output json --no-cli-pager
        exit 1
        ;;
    esac
  elif ! grep -q 'InvocationDoesNotExist' "$error_file"; then
    cat "$error_file" >&2
    exit 1
  fi
  sleep 10
done

echo "Timed out waiting for deployment. The server command may still be running; inspect Systems Manager before retrying." >&2
exit 1
