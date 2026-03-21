import os
import requests as r

question = "1+1等于几"

# 通过环境变量读取敏感信息，避免写入仓库
# PowerShell 示例：
#   $env:ANYTHINGLLM_API_KEY="your_key"
#   $env:ANYTHINGLLM_WORKSPACE="your_workspace_slug_or_id"
#   $env:ANYTHINGLLM_BASE_URL="http://127.0.0.1:3001"
api_key = os.getenv("ANYTHINGLLM_API_KEY", "S0AAAM1-RYCM4K5-N8JDMD6-YS3SCR0").strip()
workspace = os.getenv("ANYTHINGLLM_WORKSPACE", "5d269246-42f9-4ab3-a0e2-0199c1334cc5").strip()
base_url = os.getenv("ANYTHINGLLM_BASE_URL", "http://127.0.0.1:3001").strip().rstrip("/")

if not api_key or not workspace:
    raise RuntimeError("请先设置环境变量 ANYTHINGLLM_API_KEY 和 ANYTHINGLLM_WORKSPACE")

url = f"{base_url}/api/v1/workspace/{workspace}/chat"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "accept": "application/json",
}
data = {
    "message": question,
    "mode": "chat",
    "max_token": 512,
}

resp = r.post(url, headers=headers, json=data, timeout=30)
resp.raise_for_status()
body = resp.json()
print(body.get("textResponse", body))