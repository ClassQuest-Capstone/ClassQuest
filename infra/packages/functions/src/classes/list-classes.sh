#!/bin/bash
# List all classes in DynamoDB
echo "=== Classes in DynamoDB ==="
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'Classes')] | [0]" --output text)
echo "Table: $TABLE_NAME"
echo ""
aws dynamodb scan --table-name "$TABLE_NAME" --query "Items[*].{JoinCode:join_code.S,ClassName:name.S,ClassID:class_id.S,IsActive:is_active.BOOL,SchoolID:school_id.S}" --output table
