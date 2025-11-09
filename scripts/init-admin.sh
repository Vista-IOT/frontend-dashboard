#!/bin/bash

# Script to initialize the admin system with a default root user

echo "🔐 Initializing Admin System..."
echo ""

# Run Prisma migration to create Admin table
echo "📦 Running database migration..."
cd /home/rohan/Public/APM/frontend-dashboard
npx prisma migrate dev --name add_admin_model --skip-generate

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Initialize admin user via API
echo "👤 Creating default admin user..."
curl -X POST http://localhost:8000/api/admin/initialize \
  -H "Content-Type: application/json" \
  | jq .

echo ""
echo "✅ Admin system initialized!"
echo ""
echo "📝 Default credentials:"
echo "   Username: root"
echo "   Password: 00000000 (8 zeros)"
echo ""
echo "⚠️  IMPORTANT: Please change the default password immediately!"
echo ""
echo "🌐 Access the dashboard at: http://localhost:3000"
echo "   You will be prompted for credentials when accessing the dashboard."
