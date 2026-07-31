#!/bin/bash
API="https://my-twin-pro-production.up.railway.app"
EMAIL="sir.market7@gmail.com"
PASSWORD="M#m2606.1307"

echo "══════════════════════════════════════════"
echo "🧪 اختبار باستخدام بريد إلكتروني حقيقي"
echo "══════════════════════════════════════════"
echo ""

# محاولة التسجيل
echo "1. محاولة إنشاء الحساب..."
SIGNUP=$(curl -s -X POST $API/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"twin_name\":\"RealTwin\",\"lang\":\"ar\"}")
echo "$SIGNUP" | python3 -m json.tool 2>/dev/null || echo "$SIGNUP"
TOKEN=$(echo $SIGNUP | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
USER_ID=$(echo $SIGNUP | python3 -c "import sys,json; print(json.load(sys.stdin).get('user_id',''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo "✅ تم التسجيل واستلام التوكن مباشرة"
elif echo "$SIGNUP" | grep -q "already registered"; then
    echo "ℹ️ الحساب موجود مسبقاً، ننتقل إلى تسجيل الدخول"
fi

# محاولة تسجيل الدخول
echo ""
echo "2. محاولة تسجيل الدخول..."
LOGIN=$(curl -s -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN" | python3 -m json.tool 2>/dev/null || echo "$LOGIN"
TOKEN=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
USER_ID=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('user_id',''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo "✅ تم تسجيل الدخول بنجاح"
    echo ""
    echo "3. اختبار المحادثة..."
    CHAT=$(curl -s -X POST $API/api/chat \
      -H "Content-Type: application/json" \
      -d "{\"user_id\":\"$USER_ID\",\"message\":\"أهلاً، كيف حالك؟\",\"lang\":\"ar\",\"tier\":\"free\"}")
    REPLY=$(echo $CHAT | python3 -c "import sys,json; print(json.load(sys.stdin).get('reply','')[:80])" 2>/dev/null)
    echo "الرد: $REPLY"

    echo ""
    echo "4. اختبار البصمة الرقمية..."
    FP_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" $API/api/v1/fingerprint)
    echo "حالة البصمة: HTTP $FP_HTTP"

    echo ""
    echo "5. اختبار جواز السفر..."
    PP_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" $API/api/v1/passport)
    echo "حالة الجواز: HTTP $PP_HTTP"

    echo ""
    echo "6. اختبار حالة الفوترة..."
    BS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" $API/api/billing/status)
    echo "حالة الفوترة: HTTP $BS_HTTP"
else
    echo "❌ فشل تسجيل الدخول"
    if echo "$LOGIN" | grep -q "Email not confirmed"; then
        echo "السبب: البريد الإلكتروني لم يتم تأكيده بعد"
        echo "الحل: قم بتأكيد البريد الإلكتروني المرسل إلى $EMAIL"
        echo "أو عطّل خيار تأكيد البريد في Supabase Dashboard"
    fi
fi
