/**
 * AI 调用配置（禁止在此文件存放 API Key）
 * AnythingLLM 的密钥仅配置在云函数环境变量中，见 docs/ANYTHINGLLM_SETUP.md
 */
module.exports = {
  /** 与 cloudfunctions 目录下云函数文件夹名一致 */
  CLOUD_FUNCTION_NAME: 'anythingllmChat',
  /**
   * true：不调云函数，使用本地模拟（无密钥、无网络）
   * false：通过云函数调用 AnythingLLM（需已上传云函数并配置环境变量）
   */
  USE_MOCK_AI: false
}
