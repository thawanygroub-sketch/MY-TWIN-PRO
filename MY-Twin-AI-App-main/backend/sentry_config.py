import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration

def init_sentry():
    dsn = os.getenv("SENTRY_DSN", "")
    if not dsn:
        print("⚠️ SENTRY_DSN غير مضبوط – المراقبة معطلة")
        return

    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            FastApiIntegration(
                transaction_style="endpoint"
            ),
            AsyncioIntegration(),
        ],
        traces_sample_rate=1.0 if os.getenv("ENVIRONMENT") == "development" else 0.3,
        profiles_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "production"),
        release=f"mytwin@{os.getenv('APP_VERSION', '1.0.0')}",
        send_default_pii=False,
        _experiments={
            "continuous_profiling_auto_start": True,
        },
    )
    print("✅ Sentry مهيأ للمراقبة")
