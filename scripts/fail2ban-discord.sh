#!/bin/bash
# Script to send Fail2Ban alerts to the Noxhime Bot monitoring server
# Usage: fail2ban-discord.sh <jail_name> <ip_address>

# Check if we have the right number of arguments
if [ $# -ne 2 ]; then
  echo "Usage: $0 <jail_name> <ip_address>"
  exit 1
fi

JAIL="$1"
IP="$2"
TIME=$(date +"%Y-%m-%d %H:%M:%S")
HOSTNAME=$(hostname)

# Send to monitoring server
curl -s -X POST "http://localhost:5000/fail2ban" \
  -H "Content-Type: application/json" \
  -d "{
    \"service\": \"$JAIL\",
    \"ip\": \"$IP\",
    \"time\": \"$TIME\",
    \"hostname\": \"$HOSTNAME\"
  }"

exit 0
