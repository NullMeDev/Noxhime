#!/bin/bash
# Test script to send alerts to the Noxhime monitoring system

# Check if the monitoring server is running on port 5000
if ! curl -s localhost:5000 -o /dev/null; then
  echo "Error: Monitoring server is not running on localhost:5000"
  echo "Make sure the bot is running with MONIT_ENABLED=true"
  exit 1
fi

# Ask for the type of alert to send
echo "Select alert type to test:"
echo "1. System alert (general)"
echo "2. Fail2Ban alert (security)"
echo "3. Service status update"
read -p "Enter your choice (1-3): " choice

case $choice in
  1)
    # System alert
    read -p "Alert title [Test Alert]: " title
    title=${title:-"Test Alert"}
    
    read -p "Alert message [This is a test alert]: " message
    message=${message:-"This is a test alert"}
    
    read -p "Severity (info/warning/critical) [info]: " severity
    severity=${severity:-"info"}
    
    echo "Sending system alert..."
    curl -X POST "http://localhost:5000/alert" \
      -H "Content-Type: application/json" \
      -d "{\"title\": \"$title\", \"body\": \"$message\", \"severity\": \"$severity\"}"
    ;;
    
  2)
    # Fail2Ban alert
    read -p "Service name [ssh]: " service
    service=${service:-"ssh"}
    
    read -p "IP address [192.168.1.100]: " ip
    ip=${ip:-"192.168.1.100"}
    
    echo "Sending Fail2Ban alert..."
    curl -X POST "http://localhost:5000/fail2ban" \
      -H "Content-Type: application/json" \
      -d "{\"service\": \"$service\", \"ip\": \"$ip\", \"time\": \"$(date +'%Y-%m-%d %H:%M:%S')\"}"
    ;;
    
  3)
    # Service status update
    read -p "Service name [nginx]: " service
    service=${service:-"nginx"}
    
    read -p "Status (up/down/warning) [warning]: " status
    status=${status:-"warning"}
    
    read -p "Message [Service needs attention]: " message
    message=${message:-"Service needs attention"}
    
    echo "Sending service status update..."
    curl -X POST "http://localhost:5000/service-status" \
      -H "Content-Type: application/json" \
      -d "{\"service\": \"$service\", \"status\": \"$status\", \"message\": \"$message\"}"
    ;;
    
  *)
    echo "Invalid choice."
    exit 1
    ;;
esac

echo -e "\nAlert sent successfully!"
