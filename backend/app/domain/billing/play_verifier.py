"""Google Play server-side verification. Fail-closed by design."""
import os, json, time, asyncio, logging
logger = logging.getLogger("play_verifier")
_client = None

def _get_client():
    global _client
    if _client is not None: return _client
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        logger.error("GOOGLE_SERVICE_ACCOUNT_JSON not set")
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        info = json.loads(raw)
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/androidpublisher"])
        _client = build("androidpublisher", "v3", credentials=creds)
        return _client
    except Exception as e:
        logger.error(f"play client init failed: {e}")
        return None

async def verify_subscription(product_id: str, purchase_token: str) -> bool:
    package = os.getenv("ANDROID_PACKAGE_NAME", "com.soulsync.mytwin")
    client = _get_client()
    if not client: return False
    try:
        resp = await asyncio.to_thread(
            client.purchases().subscriptions()
            .get(packageName=package, subscriptionId=product_id, token=purchase_token)
            .execute)
        return int(resp.get("expiryTimeMillis", 0)) > int(time.time() * 1000)
    except Exception as e:
        logger.warning(f"verify failed: {e}")
        return False
