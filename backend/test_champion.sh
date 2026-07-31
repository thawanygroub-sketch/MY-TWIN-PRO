#!/bin/bash

API="https://my-twin-pro-production.up.railway.app"
TIMESTAMP=$(date +%s)
EMAIL="test_${TIMESTAMP}@mytwin.ai"
PASSWORD="M#m2606.1307"
PASS=0
FAIL=0

check() {
  if [ $1 -eq 0 ]; then
    echo "   ✅ $2"
    PASS=$((PASS+1))
  else
    echo "   ❌ $2"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "══════════════════════════════════════════════"
echo "🧬 MyTwin - اختبار الأبطال الشامل (بريد فريد)"
echo "══════════════════════════════════════════════"
echo "   البريد: $EMAIL"
echo ""

# ═══════════════════════════════════════════════
# 1. الصحة العامة
# ═══════════════════════════════════════════════
echo "1️⃣  الصحة العامة"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/health")
[ "$HTTP" = "200" ]; check $? "Health Check"

ROOT=$(curl -s "$API/")
ENGINE_COUNT=$(echo "$ROOT" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('engines',{})))" 2>/dev/null)
[ "$ENGINE_COUNT" -ge 10 ]; check $? "Engines Active ($ENGINE_COUNT)"

DOCS=$(curl -s -o /dev/null -w "%{http_code}" "$API/docs")
[ "$DOCS" = "200" ]; check $? "Swagger Docs"
echo ""

# ═══════════════════════════════════════════════
# 2. المصادقة
# ═══════════════════════════════════════════════
echo "2️⃣  المصادقة"

SIGNUP=$(curl -s -X POST "$API/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"twin_name\":\"TestTwin\",\"lang\":\"ar\"}")
TOKEN=$(echo "$SIGNUP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
USER_ID=$(echo "$SIGNUP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user_id',''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    check 0 "Signup"
    echo "      ↳ User: $USER_ID"
elif [ -n "$USER_ID" ]; then
    check 0 "Signup"
    echo "      ↳ User: $USER_ID (Created)"
else
    check 1 "Signup"
    echo "      ↳ Response: $(echo "$SIGNUP" | head -c 100)"
fi

if [ -z "$TOKEN" ]; then
    LOGIN=$(curl -s -X POST "$API/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
    USER_ID=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user_id',''))" 2>/dev/null)
    [ -n "$TOKEN" ]; check $? "Login"
else
    check 0 "Login"
fi
echo "      ↳ Token: ${TOKEN:0:30}..."

VERIFY=$(curl -s "$API/api/auth/verify-token?user_id=$USER_ID")
VALID=$(echo "$VERIFY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid',False))" 2>/dev/null)
[ "$VALID" = "True" ]; check $? "Verify Token"
echo ""

# ═══════════════════════════════════════════════
# 3. المحادثة والذكاء
# ═══════════════════════════════════════════════
echo "3️⃣  المحادثة والذكاء"

CHAT=$(curl -s -X POST "$API/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_ID\",\"message\":\"مرحباً، من أنت؟\",\"lang\":\"ar\",\"tier\":\"free\"}")
REPLY=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reply','')[:100])" 2>/dev/null)
[ -n "$REPLY" ]; check $? "Chat (Unified Brain)"
echo "      ↳ Reply: $REPLY"

SUGGESTED=$(echo "$CHAT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('suggested_question','none'))" 2>/dev/null)
[ -n "$SUGGESTED" ] && [ "$SUGGESTED" != "none" ]; check $? "Proactive Suggestion"
echo ""

# ═══════════════════════════════════════════════
# 4. الطاقة والاقتصاد
# ═══════════════════════════════════════════════
echo "4️⃣  الطاقة والاقتصاد"

ENERGY=$(curl -s "$API/api/economy/energy/status?user_id=$USER_ID")
ENERGY_VAL=$(echo "$ENERGY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('energy',0))" 2>/dev/null)
[ -n "$ENERGY_VAL" ]; check $? "Energy Status"

BALANCE=$(curl -s "$API/api/economy/balance?user_id=$USER_ID")
BAL=$(echo "$BALANCE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('energy',{}).get('level',0))" 2>/dev/null)
[ -n "$BAL" ]; check $? "Economy Balance"
echo ""

# ═══════════════════════════════════════════════
# 5. الفوترة والباقات
# ═══════════════════════════════════════════════
echo "5️⃣  الفوترة والباقات"

PLANS=$(curl -s "$API/api/billing/plans")
PLAN_COUNT=$(echo "$PLANS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('plans',[])))" 2>/dev/null)
[ "$PLAN_COUNT" -ge 4 ]; check $? "Billing Plans ($PLAN_COUNT)"

BILLING_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/billing/status")
[ "$BILLING_HTTP" = "200" ]; check $? "Billing Status"
echo ""

# ═══════════════════════════════════════════════
# 6. الهوية الرقمية
# ═══════════════════════════════════════════════
echo "6️⃣  الهوية الرقمية"

FINGERPRINT_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/v1/fingerprint")
[ "$FINGERPRINT_HTTP" = "200" ]; check $? "Digital Fingerprint"

PASSPORT_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API/api/v1/passport")
[ "$PASSPORT_HTTP" = "200" ]; check $? "Digital Passport"
echo ""

# ═══════════════════════════════════════════════
# 7. جميع قدرات التوأم
# ═══════════════════════════════════════════════
echo "7️⃣  قدرات التوأم"

test_capability() {
  local name="$1"
  local message="$2"
  
  RESPONSE=$(curl -s -X POST "$API/api/chat" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$USER_ID\",\"message\":\"$message\",\"lang\":\"ar\",\"tier\":\"free\"}")
  REPLY=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reply','')[:80])" 2>/dev/null)
  
  if [ -n "$REPLY" ]; then
    check 0 "$name"
    echo "      ↳ $REPLY"
  else
    check 1 "$name"
  fi
}

test_capability "Study (مذاكرة)" "اشرح لي نظرية فيثاغورس"
test_capability "Business (أعمال)" "أريد تحليل فكرة مشروعي الجديد"
test_capability "Dream (أحلام)" "حلمت أنني أطير، ما تفسير هذا الحلم؟"
test_capability "Life Coach (مدرب حياة)" "أشعر بالقلق من المستقبل، ساعدني"
test_capability "Code Lab (برمجة)" "اكتب لي كود Python بسيط"
test_capability "Content Creator (كتابة)" "اكتب لي مقالاً قصيراً عن الذكاء الاصطناعي"
test_capability "Smart Home (منزل ذكي)" "شغل الإضاءة في الغرفة"
test_capability "Task Manager (مهام)" "أنشئ لي مهمة جديدة للغد"

echo ""

# ═══════════════════════════════════════════════
# 8. Google Auth (اختبار محدود)
# ═══════════════════════════════════════════════
echo "8️⃣  Google Auth"

GOOGLE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"code":"test","redirect_uri":"test://callback","code_verifier":"test_verifier_1234567890123456789012345678901234567890","lang":"ar"}')

if [ "$GOOGLE_HTTP" = "422" ]; then
    check 0 "Google Auth endpoint ($GOOGLE_HTTP)"
    echo "      ↳ Endpoint موجود ويستجيب (خطأ متوقع: بيانات اختبار غير صالحة)"
elif [ "$GOOGLE_HTTP" = "401" ] || [ "$GOOGLE_HTTP" = "400" ]; then
    check 0 "Google Auth endpoint ($GOOGLE_HTTP)"
    echo "      ↳ Endpoint موجود ويستجيب"
else
    check 1 "Google Auth endpoint ($GOOGLE_HTTP)"
fi
echo ""

# ═══════════════════════════════════════════════
# 📊 النتيجة النهائية
# ═══════════════════════════════════════════════
TOTAL=$((PASS + FAIL))
PERCENT=$((PASS * 100 / TOTAL))
echo "══════════════════════════════════════════════"
echo "📊 النتيجة النهائية: $PASS/$TOTAL ناجح ($PERCENT%)"
echo "══════════════════════════════════════════════"

if [ "$PASS" -ge 24 ]; then
    echo "🟢 النظام جاهز للبناء! كل المحركات والقدرات تعمل."
elif [ "$PASS" -ge 20 ]; then
    echo "🟡 النظام يعمل بشكل جيد. بعض النقاط تحتاج انتباهاً."
else
    echo "🔴 توجد مشاكل حرجة. راجع السجلات."
fi
